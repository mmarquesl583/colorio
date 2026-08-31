import type { WebSocket } from 'ws';
import {
  hslFracToRgb, rgbToHex, hexToRgb, rgbToHslFrac,
} from '../../shared/color.ts';
import { calculateColorScore, calculateMasterScore, badgeFromScore, roundOutcomeFromScore } from '../../shared/scoring.ts';
import {
  LOBBY_THEMES, AI_PHRASE_BANK, PLAYER_PALETTE, PLACING_SECONDS, NEXT_ROUND_READY_TIMEOUT_MS,
  SPEED_BONUS_MAX, ROUND_MVP_BONUS, AI_WIN_SCORE, AI_WIN_PERFECTS, LOBBY_RECONNECT_GRACE_MS,
} from '../../shared/gameData.ts';
import { AI_QUESTIONS } from '../../shared/aiQuestions.ts';
import type { AiDifficulty } from '../../shared/aiQuestions.ts';
import type {
  RoomConfig, RoundPhase, ScreenState, HslColor, ChatEntry,
  RoundView, RoundResults, RoomStateView, PlayerPublic, MatchWinner,
} from '../../shared/types.ts';
import { newChatId, newMatchId } from './id.ts';
import {
  openGameSession, closeGameSession, recordMatchResult, recordAbandonedMatch,
  type RoundOutcome, type ThemeTally, type MatchParticipantSummary,
} from './stats.ts';

const DEFAULT_COLOR: HslColor = { h: 260, s: 60, l: 55 };

export interface QuestionReport {
  roomCode: string;
  reporterName: string;
  themeId: string;
  themeName: string;
  phrase: string;
  aiDifficulty: AiDifficulty | null;
  aiSource: string | null;
  secretHex: string;
  note?: string;
  ts: number;
}

interface InternalPlayer {
  id: string;
  ws: WebSocket | null;
  name: string;
  color: string;
  initial: string;
  score: number;
  perfectCount: number;
  connected: boolean;
  confirmed: boolean;
  readyNext: boolean;
  pickedColor: HslColor | null;
  colorHistory: string[];
  confirmedAtSeconds: number | null;
  /** Real Supabase account id, when the client sent a valid access token —
   * null for a failed/missing token. Never sent to any client, only used
   * server-side to attribute stats. */
  userId: string | null;
  /** Open game_sessions row id for this player's current connection, or
   * null when not tracked (no userId, or the session hasn't opened yet /
   * already closed). */
  sessionId: string | null;
}

interface ThemeTallyEntry { correct: number; wrong: number; perfects: number; bestScore: number; }

function sysMsg(color: string, text: string): ChatEntry {
  return { id: newChatId(), type: 'sys', color, text, ts: Date.now() };
}

export class Room {
  code: string;
  hostId: string | null = null;
  config: RoomConfig;
  screen: ScreenState = 'waiting';
  players = new Map<string, InternalPlayer>();
  order: string[] = [];
  chat: ChatEntry[] = [];
  roundIdx = -1;
  round: RoundView | null = null;
  phase: RoundPhase | null = null;
  secondsLeft: number | null = null;
  results: RoundResults | null = null;
  lastThemeId: string | null = null;
  matchWinner: MatchWinner | null = null;
  createdAt = Date.now();
  readySecondsLeft: number | null = null;

  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private nextReadyFallback: ReturnType<typeof setTimeout> | null = null;
  private readyTickHandle: ReturnType<typeof setInterval> | null = null;
  private lobbyLeaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private onEmpty: () => void;
  private onReport: (report: QuestionReport) => void;

  // Per-match stats accumulators — built up round by round in
  // computeReveal()/startRound(), consumed once in finishMatch(), reset by
  // resetMatchAccumulators() on every startMatch(). Never persisted
  // mid-match, never read outside this class.
  private matchId = '';
  private matchStartedAt = Date.now();
  private matchOutcomes = new Map<string, RoundOutcome[]>();
  private matchThemeTally = new Map<string, Map<string, ThemeTallyEntry>>();
  private matchThemeIds = new Set<string>();
  private matchDifficultyTally = new Map<AiDifficulty, number>();

  constructor(code: string, config: RoomConfig, onEmpty: () => void, onReport: (report: QuestionReport) => void) {
    this.code = code;
    this.config = config;
    this.onEmpty = onEmpty;
    this.onReport = onReport;
  }

  private colorFor(index: number): string {
    return PLAYER_PALETTE[index % PLAYER_PALETTE.length];
  }

  addPlayer(id: string, name: string, ws: WebSocket, userId: string | null): InternalPlayer {
    const idx = this.order.length;
    const player: InternalPlayer = {
      id, ws, name: name.slice(0, 24) || 'Jogador',
      color: this.colorFor(idx),
      initial: (name.trim()[0] || 'J').toUpperCase(),
      score: 0, perfectCount: 0, connected: true, confirmed: false, readyNext: false,
      pickedColor: null, colorHistory: [], confirmedAtSeconds: null,
      userId, sessionId: null,
    };
    this.players.set(id, player);
    this.order.push(id);
    if (!this.hostId) this.hostId = id;
    this.chat.push(sysMsg('#94A3B8', `${player.name} entrou na sala`));
    if (userId) this.openSessionFor(id, userId);
    return player;
  }

  // Opens a game_sessions row asynchronously and stashes its id on the
  // player once it resolves — guarded against the player having already
  // disconnected (or somehow already gotten a session) by then, in which
  // case the just-opened session is closed right back out instead of
  // leaking open forever.
  private openSessionFor(id: string, userId: string) {
    openGameSession(userId, this.code).then((sessionId) => {
      const still = this.players.get(id);
      if (still && still.connected && !still.sessionId) {
        still.sessionId = sessionId;
      } else if (sessionId) {
        closeGameSession(sessionId);
      }
    });
  }

  reconnect(id: string, ws: WebSocket): boolean {
    const p = this.players.get(id);
    if (!p) return false;
    p.ws = ws;
    p.connected = true;
    const pending = this.lobbyLeaveTimers.get(id);
    if (pending) { clearTimeout(pending); this.lobbyLeaveTimers.delete(id); }
    if (p.userId && !p.sessionId) this.openSessionFor(id, p.userId);
    this.broadcast();
    return true;
  }

  disconnect(id: string) {
    const p = this.players.get(id);
    if (!p) return;
    p.connected = false;
    p.ws = null;
    if (p.sessionId) { closeGameSession(p.sessionId); p.sessionId = null; }
    if (this.screen === 'waiting') {
      // A dropped connection in the lobby (tab backgrounded, flaky signal)
      // gets a short grace period to reconnect before the slot actually
      // frees up — a quick trip away shouldn't bump someone from the room.
      this.chat.push(sysMsg('#94A3B8', `${p.name} está reconectando…`));
      this.broadcast();
      const timer = setTimeout(() => {
        this.lobbyLeaveTimers.delete(id);
        const still = this.players.get(id);
        if (!still || still.connected) return;
        this.players.delete(id);
        this.order = this.order.filter((pid) => pid !== id);
        if (this.hostId === id) this.hostId = this.order[0] ?? null;
        this.chat.push(sysMsg('#94A3B8', `${still.name} saiu da sala`));
        if (this.players.size === 0) { this.stopTimers(); this.onEmpty(); return; }
        this.broadcast();
      }, LOBBY_RECONNECT_GRACE_MS);
      this.lobbyLeaveTimers.set(id, timer);
      return;
    }
    if (this.players.size === 0 || this.order.every((pid) => !this.players.get(pid)?.connected)) {
      this.stopTimers();
      // The whole room is dying with a match still in progress (nobody left
      // to reach finishMatch()'s own abandoned-player handling) — everyone
      // who was in it counts as having abandoned that match.
      if (this.screen === 'playing') {
        const userIds = this.order
          .map((pid) => this.players.get(pid)?.userId)
          .filter((u): u is string => !!u);
        recordAbandonedMatch(userIds);
      }
      this.onEmpty();
      return;
    }
    if (this.screen === 'playing') this.maybeAdvanceFromPlacing();
    this.broadcast();
  }

  isEmpty(): boolean {
    return this.order.length === 0;
  }

  updateConfig(playerId: string, patch: Partial<RoomConfig>) {
    if (playerId !== this.hostId || this.screen !== 'waiting') return;
    this.config = { ...this.config, ...patch };
  }

  startMatch(playerId: string) {
    if (playerId !== this.hostId || this.screen !== 'waiting') return;
    const minPlayers = this.config.phraseMode === 'ai' ? 1 : 2;
    if (this.order.filter((id) => this.players.get(id)?.connected).length < minPlayers) return;
    this.screen = 'playing';
    this.resetMatchAccumulators();
    this.startRound();
  }

  // Called once per match (only entry point into 'playing') — restartMatch()
  // goes back through 'waiting' first, so startMatch() alone covers replays
  // too. Nothing here is persisted; it's discarded once finishMatch() reads
  // it, or overwritten wholesale on the next match.
  private resetMatchAccumulators() {
    this.matchId = newMatchId();
    this.matchStartedAt = Date.now();
    this.matchOutcomes = new Map();
    this.matchThemeTally = new Map();
    this.matchThemeIds = new Set();
    this.matchDifficultyTally = new Map();
  }

  private pickTheme(): { id: string; icon: string; name: string } {
    let pool = this.config.selectedThemes.length
      ? LOBBY_THEMES.filter((t) => this.config.selectedThemes.includes(t.id))
      : LOBBY_THEMES;
    if (this.config.phraseMode === 'ai') {
      const aiEligible = LOBBY_THEMES.filter((t) => AI_QUESTIONS[t.id]?.length);
      const inPool = pool.filter((t) => AI_QUESTIONS[t.id]?.length);
      pool = inPool.length ? inPool : aiEligible;
    }
    const candidates = pool.length > 1 ? pool.filter((t) => t.id !== this.lastThemeId) : pool;
    const list = candidates.length ? candidates : pool;
    const theme = list[Math.floor(Math.random() * list.length)] ?? LOBBY_THEMES[0];
    this.lastThemeId = theme.id;
    return theme;
  }

  private connectedOrder(): string[] {
    return this.order.filter((id) => this.players.get(id)?.connected);
  }

  private startRound() {
    this.stopTimers();
    this.roundIdx += 1;
    const theme = this.pickTheme();
    const isAi = this.config.phraseMode === 'ai';
    const activeOrder = this.connectedOrder();
    let masterId: string | null = null;
    let masterName = 'IA';
    if (!isAi && activeOrder.length > 0) {
      masterId = activeOrder[this.roundIdx % activeOrder.length];
      masterName = this.players.get(masterId)!.name;
    }

    for (const p of this.players.values()) {
      p.confirmed = false;
      p.readyNext = false;
      p.pickedColor = null;
      p.colorHistory = [];
      p.confirmedAtSeconds = null;
    }

    let phrase = '';
    let aiDifficulty: AiDifficulty | null = null;
    let aiSource: string | null = null;
    let secretHsl: HslColor = { h: Math.round(Math.random() * 360), s: Math.round(40 + Math.random() * 45), l: Math.round(22 + Math.random() * 45) };
    if (isAi) {
      const bank = AI_QUESTIONS[theme.id];
      const q = bank?.length ? bank[Math.floor(Math.random() * bank.length)] : null;
      if (q) {
        phrase = q.pergunta;
        aiDifficulty = q.dificuldade;
        aiSource = q.fonte ?? null;
        const rgb = hexToRgb(q.hex);
        secretHsl = rgbToHslFrac(rgb.r, rgb.g, rgb.b);
      } else {
        phrase = AI_PHRASE_BANK[Math.floor(Math.random() * AI_PHRASE_BANK.length)];
      }
    }

    const number = (this.roundIdx % this.config.numRounds) + 1;
    this.round = {
      idx: this.roundIdx, number,
      themeId: theme.id, themeIcon: theme.icon, themeName: theme.name,
      masterId, masterName,
      phrase, isAiPhrase: isAi, aiDifficulty, aiSource,
    };
    this.results = null;
    this.secretHsl = secretHsl;
    this.matchThemeIds.add(theme.id);
    if (aiDifficulty) this.matchDifficultyTally.set(aiDifficulty, (this.matchDifficultyTally.get(aiDifficulty) ?? 0) + 1);

    this.chat.push(sysMsg('#FF5C8A', `Tema da Rodada · ${theme.name}`));
    this.chat.push(sysMsg('#29E7FF', isAi ? '🤖 A IA escreveu a pista' : `✏️ Vez de ${masterName}`));

    if (isAi) {
      this.phase = 'placing';
      this.secondsLeft = PLACING_SECONDS;
      this.startTicking();
    } else {
      this.phase = 'master-writing';
      this.secondsLeft = null;
    }
    this.broadcast();
  }

  private secretHsl: HslColor = DEFAULT_COLOR;

  submitPhrase(playerId: string, text: string) {
    if (this.phase !== 'master-writing' || !this.round || playerId !== this.round.masterId) return;
    const clean = text.trim().slice(0, 80);
    if (!clean) return;
    this.round = { ...this.round, phrase: clean };
    this.chat.push(sysMsg('#A78BFA', `${this.players.get(playerId)!.name} enviou a pista`));
    this.phase = 'placing';
    this.secondsLeft = PLACING_SECONDS;
    this.startTicking();
    this.broadcast();
  }

  private eligibleGuessers(): string[] {
    const master = this.round?.masterId;
    return this.connectedOrder().filter((id) => id !== master);
  }

  pickColor(playerId: string, hsl: HslColor) {
    const p = this.players.get(playerId);
    if (!p || this.phase !== 'placing' || p.confirmed) return;
    if (this.round?.masterId === playerId) return;
    p.pickedColor = { h: clamp(hsl.h, 0, 360), s: clamp(hsl.s, 0, 100), l: clamp(hsl.l, 0, 100) };
    const rgb = hslFracToRgb(p.pickedColor.h, p.pickedColor.s / 100, p.pickedColor.l / 100);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    if (p.colorHistory[0] !== hex) p.colorHistory = [hex, ...p.colorHistory].slice(0, 5);
    this.broadcast();
  }

  confirmColor(playerId: string) {
    const p = this.players.get(playerId);
    if (!p || this.phase !== 'placing' || p.confirmed) return;
    if (this.round?.masterId === playerId) return;
    p.confirmed = true;
    p.confirmedAtSeconds = this.secondsLeft ?? 0;
    if (!p.pickedColor) p.pickedColor = { ...DEFAULT_COLOR };
    this.chat.push(sysMsg('#94A3B8', `${p.name} confirmou sua cor`));
    this.maybeAdvanceFromPlacing();
    this.broadcast();
  }

  private maybeAdvanceFromPlacing() {
    if (this.phase !== 'placing') return;
    const guessers = this.eligibleGuessers();
    if (guessers.length === 0) return;
    const allConfirmed = guessers.every((id) => this.players.get(id)?.confirmed);
    if (allConfirmed) this.computeReveal();
  }

  private startTicking() {
    this.tickHandle = setInterval(() => {
      if (this.phase !== 'placing' || this.secondsLeft === null) return;
      this.secondsLeft -= 1;
      if (this.secondsLeft <= 0) {
        for (const id of this.eligibleGuessers()) {
          const p = this.players.get(id)!;
          if (!p.confirmed) { p.confirmed = true; if (!p.pickedColor) p.pickedColor = { ...DEFAULT_COLOR }; }
        }
        this.computeReveal();
      }
      this.broadcast();
    }, 1000);
  }

  private computeReveal() {
    this.stopTicking();
    const secretHsl = this.secretHsl;
    const secretRgb = hslFracToRgb(secretHsl.h, secretHsl.s / 100, secretHsl.l / 100);
    const secretHex = rgbToHex(secretRgb.r, secretRgb.g, secretRgb.b);
    const guessers = this.eligibleGuessers();
    const byStanding = [...guessers].sort((a, b) => (this.players.get(b)!.score - this.players.get(a)!.score));
    const base = byStanding.map((id) => {
      const p = this.players.get(id)!;
      const hsl = p.pickedColor ?? { ...DEFAULT_COLOR };
      const rgb = hslFracToRgb(hsl.h, hsl.s / 100, hsl.l / 100);
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      const { score: baseScore, deltaE: de } = calculateColorScore(hex, secretHex);
      return { id, p, hsl, de, baseScore };
    });
    const mvpId = base.length >= 2
      ? base.reduce((best, g) => (g.de < best.de ? g : best), base[0]).id
      : null;

    // Master's gain reflects clue quality (pure accuracy) — untouched by the
    // speed/MVP bonuses below, which reward individual guessers, not the clue.
    const masterGain = calculateMasterScore(base.map((g) => g.baseScore));

    const themeId = this.round?.themeId ?? null;
    const guesses = base.map(({ id, p, hsl, de, baseScore }) => {
      const speedBonus = baseScore > 0 ? Math.round(SPEED_BONUS_MAX * ((p.confirmedAtSeconds ?? 0) / PLACING_SECONDS)) : 0;
      const isRoundMvp = id === mvpId;
      const score = baseScore + speedBonus + (isRoundMvp ? ROUND_MVP_BONUS : 0);
      const badge = badgeFromScore(baseScore);
      if (badge === 'PERFEITO') p.perfectCount += 1;
      const prevScore = p.score;
      p.score += score;

      // Stats accumulators for this match only — read once in
      // finishMatch(), reset by resetMatchAccumulators() on the next one.
      const outcome = roundOutcomeFromScore(baseScore);
      if (!this.matchOutcomes.has(id)) this.matchOutcomes.set(id, []);
      this.matchOutcomes.get(id)!.push(outcome);
      if (themeId) {
        if (!this.matchThemeTally.has(id)) this.matchThemeTally.set(id, new Map());
        const themeMap = this.matchThemeTally.get(id)!;
        const entry = themeMap.get(themeId) ?? { correct: 0, wrong: 0, perfects: 0, bestScore: 0 };
        if (outcome === 'wrong') entry.wrong += 1;
        else { entry.correct += 1; if (outcome === 'perfect') entry.perfects += 1; }
        entry.bestScore = Math.max(entry.bestScore, baseScore);
        themeMap.set(themeId, entry);
      }

      return {
        playerId: id, name: p.name, color: p.color, initial: p.initial,
        hsl, deltaE: de, score, badge, isRoundMvp,
        prevScore, newScore: p.score,
      };
    });

    // Frase da IA win condition: first to 10000 pontos or 5 acertos perfeitos.
    // Checked against guessers only (the master's average-of-guessers gain
    // below isn't a color match of their own, so it doesn't count).
    if (this.config.phraseMode === 'ai' && !this.matchWinner) {
      const qualifiers = guesses
        .map((g) => ({ g, p: this.players.get(g.playerId)! }))
        .filter(({ p }) => p.score >= AI_WIN_SCORE || p.perfectCount >= AI_WIN_PERFECTS);
      if (qualifiers.length > 0) {
        const winner = qualifiers.reduce((best, cur) => (cur.p.score > best.p.score ? cur : best), qualifiers[0]);
        this.matchWinner = {
          playerId: winner.g.playerId, name: winner.g.name, score: winner.p.score,
          reason: winner.p.score >= AI_WIN_SCORE ? 'points' : 'perfect',
          isDraw: false,
          winners: [{ playerId: winner.g.playerId, name: winner.g.name, score: winner.p.score }],
        };
      }
    }

    let masterId: string | null = null, masterName: string | null = null;
    let masterPrevScore = 0, masterNewScore = 0;
    if (this.round?.masterId) {
      masterId = this.round.masterId;
      const master = this.players.get(masterId)!;
      masterName = master.name;
      masterPrevScore = master.score;
      master.score += masterGain;
      masterNewScore = master.score;
    }

    // Frase dos jogadores has no score/perfect win threshold — it ends
    // after the configured number of rounds instead, decided by whoever
    // has the highest cumulative score at that point (tied top scores are
    // recorded as a draw, not resolved arbitrarily). Placed after the
    // master's own score update above so their final-round gain counts.
    if (this.config.phraseMode === 'players' && !this.matchWinner && this.roundIdx + 1 >= this.config.numRounds) {
      const standings = this.order
        .map((id) => this.players.get(id))
        .filter((p): p is InternalPlayer => !!p);
      if (standings.length > 0) {
        const topScore = Math.max(...standings.map((p) => p.score));
        const winners = standings.filter((p) => p.score === topScore);
        const top = winners[0];
        this.matchWinner = {
          playerId: top.id, name: top.name, score: top.score,
          reason: 'rounds',
          isDraw: winners.length > 1,
          winners: winners.map((p) => ({ playerId: p.id, name: p.name, score: p.score })),
        };
      }
    }

    this.results = {
      secretHsl, secretHex,
      guesses, masterId, masterName, masterPrevScore, masterNewScore, masterGain,
    };
    this.phase = 'reveal';
    this.secondsLeft = null;
    for (const p of this.players.values()) p.readyNext = false;
    this.broadcast();

    const totalReadyMs = NEXT_ROUND_READY_TIMEOUT_MS + 6000;
    this.nextReadyFallback = setTimeout(() => this.advanceAfterReveal(), totalReadyMs);
    this.readySecondsLeft = Math.round(totalReadyMs / 1000);
    this.readyTickHandle = setInterval(() => {
      if (this.readySecondsLeft === null) return;
      this.readySecondsLeft = Math.max(0, this.readySecondsLeft - 1);
      this.broadcast();
    }, 1000);
  }

  readyNext(playerId: string) {
    const p = this.players.get(playerId);
    if (!p || this.phase !== 'reveal') return;
    p.readyNext = true;
    const active = this.connectedOrder();
    const allReady = active.length > 0 && active.every((id) => this.players.get(id)?.readyNext);
    this.broadcast();
    if (allReady) {
      this.stopReadyWait();
      this.advanceAfterReveal();
    }
  }

  private stopReadyWait() {
    if (this.nextReadyFallback) { clearTimeout(this.nextReadyFallback); this.nextReadyFallback = null; }
    if (this.readyTickHandle) { clearInterval(this.readyTickHandle); this.readyTickHandle = null; }
    this.readySecondsLeft = null;
  }

  private advanceAfterReveal() {
    if (this.matchWinner) this.finishMatch();
    else this.startRound();
  }

  private finishMatch() {
    this.stopTimers();
    this.screen = 'finished';
    this.phase = null;
    this.secondsLeft = null;
    this.chat.push(sysMsg('#FFC93C', this.matchWinner!.isDraw ? '🤝 A partida terminou empatada!' : `🏆 ${this.matchWinner!.name} venceu a partida!`));
    this.recordMatchStats();
    this.broadcast();
  }

  // Snapshots everything the stats pipeline needs into plain objects before
  // any async call — restartMatch() can zero p.score/p.perfectCount on
  // these same InternalPlayer objects moments later if the host is quick,
  // so nothing here can be read lazily after this point.
  private recordMatchStats() {
    const winner = this.matchWinner;
    if (!winner) return;
    const playedAt = new Date().toISOString();
    const durationSeconds = Math.max(0, Math.round((Date.now() - this.matchStartedAt) / 1000));
    const themeIds = [...this.matchThemeIds];
    let difficulty: AiDifficulty | null = null;
    if (this.matchDifficultyTally.size > 0) {
      difficulty = [...this.matchDifficultyTally.entries()].reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
    }
    const winnerIds = new Set(winner.winners.map((w) => w.playerId));

    const summaries: MatchParticipantSummary[] = [];
    const abandonedUserIds: string[] = [];

    for (const id of this.order) {
      const p = this.players.get(id);
      if (!p || !p.userId) continue;
      if (!p.connected) { abandonedUserIds.push(p.userId); continue; }

      const result: 'won' | 'lost' | 'drawn' = winnerIds.has(id) ? (winner.isDraw ? 'drawn' : 'won') : 'lost';
      const themeTallies: ThemeTally[] = [...(this.matchThemeTally.get(id)?.entries() ?? [])]
        .map(([theme_id, t]) => ({ theme_id, correct: t.correct, wrong: t.wrong, perfects: t.perfects, best_score: t.bestScore }));

      summaries.push({
        userId: p.userId,
        matchId: this.matchId,
        roomCode: this.code,
        modeId: this.config.phraseMode,
        themeIds,
        difficulty,
        score: p.score,
        perfects: p.perfectCount,
        result,
        durationSeconds,
        playedAt,
        roundOutcomes: this.matchOutcomes.get(id) ?? [],
        themeTallies,
      });
    }

    recordMatchResult(summaries);
    recordAbandonedMatch(abandonedUserIds);
  }

  /** Host-only: replay in the same room with the same players, scores reset. */
  restartMatch(playerId: string) {
    if (playerId !== this.hostId || this.screen !== 'finished') return;
    this.stopTimers();
    for (const p of this.players.values()) {
      p.score = 0; p.perfectCount = 0; p.confirmed = false; p.readyNext = false;
      p.pickedColor = null; p.colorHistory = []; p.confirmedAtSeconds = null;
    }
    this.roundIdx = -1;
    this.round = null;
    this.phase = null;
    this.secondsLeft = null;
    this.results = null;
    this.matchWinner = null;
    this.screen = 'waiting';
    this.chat.push(sysMsg('#94A3B8', 'O anfitrião reiniciou a partida'));
    this.broadcast();
  }

  reportQuestion(playerId: string, note?: string) {
    const p = this.players.get(playerId);
    if (!p || !this.round || !this.round.isAiPhrase) return;
    const secretRgb = hslFracToRgb(this.secretHsl.h, this.secretHsl.s / 100, this.secretHsl.l / 100);
    this.onReport({
      roomCode: this.code,
      reporterName: p.name,
      themeId: this.round.themeId,
      themeName: this.round.themeName,
      phrase: this.round.phrase,
      aiDifficulty: this.round.aiDifficulty,
      aiSource: this.round.aiSource,
      secretHex: rgbToHex(secretRgb.r, secretRgb.g, secretRgb.b),
      note: note?.trim().slice(0, 200) || undefined,
      ts: Date.now(),
    });
    this.chat.push(sysMsg('#94A3B8', `${p.name} reportou esta pergunta`));
    this.broadcast();
  }

  sendChat(playerId: string, text: string) {
    const p = this.players.get(playerId);
    const clean = text.trim().slice(0, 200);
    if (!p || !clean) return;
    this.chat.push({ id: newChatId(), type: 'msg', color: p.color, name: p.name, text: clean, ts: Date.now() });
    if (this.chat.length > 200) this.chat = this.chat.slice(-200);
    this.broadcast();
  }

  private stopTicking() {
    if (this.tickHandle) { clearInterval(this.tickHandle); this.tickHandle = null; }
  }
  private stopTimers() {
    this.stopTicking();
    this.stopReadyWait();
    for (const t of this.lobbyLeaveTimers.values()) clearTimeout(t);
    this.lobbyLeaveTimers.clear();
  }

  private publicPlayer(p: InternalPlayer): PlayerPublic {
    return {
      id: p.id, name: p.name, color: p.color, initial: p.initial, score: p.score,
      connected: p.connected, isHost: p.id === this.hostId, confirmed: p.confirmed, readyNext: p.readyNext,
    };
  }

  private stateFor(playerId: string): RoomStateView {
    const me = this.players.get(playerId)!;
    const activeIds = this.connectedOrder();
    return {
      code: this.code,
      screen: this.screen,
      config: this.config,
      roomFull: activeIds.length >= this.config.numPlayers,
      you: {
        ...this.publicPlayer(me),
        isMaster: this.round?.masterId === playerId,
        pickedColor: me.pickedColor,
        colorHistory: me.colorHistory,
        masterSecret: this.round?.masterId === playerId ? this.secretHsl : null,
      },
      players: this.order.map((id) => this.players.get(id)).filter((p): p is InternalPlayer => !!p).map((p) => this.publicPlayer(p)),
      chat: this.chat.slice(-100),
      round: this.round,
      phase: this.phase,
      secondsLeft: this.secondsLeft,
      results: this.results,
      nextReady: {
        ready: activeIds.filter((id) => this.players.get(id)?.readyNext).length,
        total: activeIds.length,
      },
      matchWinner: this.matchWinner,
      readySecondsLeft: this.readySecondsLeft,
    };
  }

  broadcast() {
    for (const p of this.players.values()) {
      if (!p.ws || p.ws.readyState !== p.ws.OPEN) continue;
      const state = this.stateFor(p.id);
      p.ws.send(JSON.stringify({ type: 'state', state }));
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}
