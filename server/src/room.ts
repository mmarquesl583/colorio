import type { WebSocket } from 'ws';
import {
  hslFracToRgb, rgbToHex, hexToRgb, rgbToHslFrac,
} from '../../shared/color.ts';
import { calculateColorScore, calculateMasterScore, badgeFromScore, roundOutcomeFromScore } from '../../shared/scoring.ts';
import { RACE_MS, RACE_INTRO_MS, raceTimeMultiplier } from '../../shared/raceMode.ts';
import {
  LOBBY_THEMES, AI_PHRASE_BANK, PLAYER_PALETTE, PLACING_SECONDS, NEXT_ROUND_READY_TIMEOUT_MS,
  SPEED_BONUS_MAX, ROUND_MVP_BONUS, PERFECT_BONUS, AI_WIN_PERFECTS, LOBBY_RECONNECT_GRACE_MS,
} from '../../shared/gameData.ts';
import { levelForXp } from '../../shared/progression.ts';
import { AI_QUESTIONS } from '../../shared/aiQuestions.ts';
import type { AiDifficulty, AiQuestion } from '../../shared/aiQuestions.ts';
import type {
  RoomConfig, RoundPhase, ScreenState, HslColor, ChatEntry,
  RoundView, RoundResults, RoomStateView, PlayerPublic, MatchWinner, MatchPlayerSummary,
} from '../../shared/types.ts';
import { newChatId, newMatchId } from './id.ts';
import {
  openGameSession, closeGameSession, recordMatchResult, recordAbandonedMatch,
  recordRoundGuesses, isQuestionActive, fetchPlayerBests,
  type RoundOutcome, type ThemeTally, type MatchParticipantSummary, type RoundGuessRow, type PriorBests,
} from './stats.ts';

const DEFAULT_COLOR: HslColor = { h: 260, s: 60, l: 55 };

// Server-wide (all rooms, not just this one) recently-served question ids
// per theme — a plain random pick from a ~100-question bank has a real
// chance of two different rooms (or even the same room a few rounds apart,
// on top of the match-scoped exclusion below) drawing the same question
// back to back. Biasing the pick away from whatever was just served
// anywhere on this process spreads the rotation out without needing to
// persist per-player history in Postgres. Capped per theme so it never
// grows unbounded across a long-running server process.
const RECENTLY_SERVED_CAP = 25;
const recentlyServedGlobal = new Map<string, number[]>();

function markServedGlobally(themeId: string, questionId: number) {
  const list = recentlyServedGlobal.get(themeId) ?? [];
  list.unshift(questionId);
  if (list.length > RECENTLY_SERVED_CAP) list.length = RECENTLY_SERVED_CAP;
  recentlyServedGlobal.set(themeId, list);
}

export interface QuestionReport {
  roomCode: string;
  reporterName: string;
  reporterUserId: string | null;
  themeId: string;
  themeName: string;
  questionId: number | null;
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
  /** Cosmetic display only — sent by the client at join time, same trust
   * level as `name` (no ownership check against player_avatars/player_titles
   * here; equip-time ownership is already enforced where it matters: the
   * equip_title RPC and, for avatars, Supabase auth user_metadata). */
  avatarId: string | null;
  titleId: string | null;
  score: number;
  perfectCount: number;
  /** Consecutive good guesses within the current match — survives across
   * rounds (unlike pickedColor/confirmed/etc, never touched by the
   * per-round reset block in startRound()), zeroed on a 'wrong' outcome or
   * a match restart. Guessers only; the classic-mode clue-writing master
   * never accumulates this. */
  combo: number;
  /** This player's own player_stats snapshot from BEFORE the match in
   * progress, fetched asynchronously via loadPriorBests() at join time (and
   * again on restartMatch()) — lets recordMatchStats() tell "NOVO
   * RECORDE!" apart from "quase lá" without waiting on a DB round trip at
   * match end. Null until the fetch resolves, or forever for a guest
   * (no userId), or for anyone who joined so late the fetch hadn't
   * resolved before the match ended. */
  priorBests: PriorBests | null;
  connected: boolean;
  confirmed: boolean;
  readyNext: boolean;
  pickedColor: HslColor | null;
  colorHistory: string[];
  confirmedAtSeconds: number | null;
  /** gameMode:'race' only. null = hasn't confirmed yet / timed out (an
   * explicit sentinel — never fed into raceTimeMultiplier as RACE_MS,
   * which would land in the wrong bucket). A number 0..RACE_MS = confirmed
   * that many ms after the round's deadline was set. */
  raceResponseMs: number | null;
  /** Real Supabase account id, when the client sent a valid access token —
   * null for a failed/missing token. Never sent to any client, only used
   * server-side to attribute stats. */
  userId: string | null;
  /** Open game_sessions row id for this player's current connection, or
   * null when not tracked (no userId, or the session hasn't opened yet /
   * already closed). */
  sessionId: string | null;
  /** Rounds that finished while this player was disconnected (see
   * computeReveal()'s tally) — read and reset by reconnect()'s catch-up
   * bonus, and by restartMatch(). Master-round misses don't count here:
   * an absent master's masterGain still lands normally (see computeReveal),
   * only guesser rounds are truly skipped for a disconnected player. */
  missedRounds: number;
}

interface ThemeTallyEntry { correct: number; wrong: number; perfects: number; bestScore: number; }

interface RaceTallyEntry {
  scoreNormalTotal: number;
  responseMsSum: number;
  multiplierSum: number;
  timedRounds: number;
  bestResponseMs: number | null;
  bestCorrectResponseMs: number | null;
  bestMultiplier: number;
  multiplier2xCount: number;
  anyTimeout: boolean;
}

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
  /** Color Master rotation index — separate from roundIdx because "Com a
   * Galera" bonus rounds (see mastersSinceBonus below) interleave with
   * master rounds without a fixed 1-in-N cadence; indexing master picks
   * straight off roundIdx would skip players whenever a bonus round lands
   * between their turns. Only ever advances on an actual master round. */
  private masterTurnIdx = 0;
  /** "Com a Galera" only: player ids who've been Color Master since the
   * last bonus round. Once this covers every currently connected player,
   * the next round is AI-sourced instead (no master, double points) and
   * the set clears for the next cycle. Reset on restartMatch() too. */
  private mastersSinceBonus = new Set<string>();
  round: RoundView | null = null;
  phase: RoundPhase | null = null;
  secondsLeft: number | null = null;
  results: RoundResults | null = null;
  lastThemeId: string | null = null;
  matchWinner: MatchWinner | null = null;
  createdAt = Date.now();
  readySecondsLeft: number | null = null;

  /** gameMode:'race' round deadline (epoch ms) — server-internal only,
   * deliberately never sent on the wire (clients would have to compare it
   * against their own clock, a clock-skew hazard). Clients instead get a
   * freshly-computed raceMsLeft on every broadcast, see stateFor(). */
  private raceDeadlineAt: number | null = null;
  /** Links this round back to the specific shared/aiQuestions.ts entry, for
   * admin analytics (round_guesses.question_id) — never sent on the wire,
   * the client never needs to know a numeric question id. null in
   * 'players' mode (no fixed catalog) or when the AI bank fallback phrase
   * was used (no q at all — see startRound()). */
  private aiQuestionId: number | null = null;
  private raceIntroTimer: ReturnType<typeof setTimeout> | null = null;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private raceTickHandle: ReturnType<typeof setInterval> | null = null;
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
  // AI question ids already served this match, per theme — the random pick
  // in startRound() excludes these first, so the same room never repeats a
  // question until its theme's whole bank has actually been exhausted.
  private matchUsedQuestionIds = new Map<string, Set<number>>();
  private matchOutcomes = new Map<string, RoundOutcome[]>();
  private matchThemeTally = new Map<string, Map<string, ThemeTallyEntry>>();
  private matchThemeIds = new Set<string>();
  private matchDifficultyTally = new Map<AiDifficulty, number>();
  private matchRaceStats = new Map<string, RaceTallyEntry>();
  // Generic, all-modes per-round history (unlike matchRaceStats, which is
  // race-only) — raw baseScore and response time for every round the
  // player actually guessed in. Powers the newer global titles (Daltônico,
  // Relâmpago, Cirúrgico, etc.) without duplicating per-title counters in
  // TS; the SQL side derives whatever it needs from these two arrays.
  private matchRoundScores = new Map<string, number[]>();
  private matchRoundResponseMs = new Map<string, (number | null)[]>();
  // Progression (XP/combo) — same per-match-accumulator convention as the
  // fields above, populated in the same per-guesser loop inside
  // computeReveal(). matchNearPerfects counts CIRÚRGICO-badge rounds
  // ("quase perfeitos" on the match-end screen).
  private matchXp = new Map<string, number>();
  private matchComboBest = new Map<string, number>();
  private matchNearPerfects = new Map<string, number>();
  // Built once in recordMatchStats(), read by stateFor() as
  // RoomStateView.matchSummary — the match-end screen's record/level-up/
  // stat-breakdown data source, computed synchronously here instead of
  // waiting on recordMatchResult()'s fire-and-forget Postgres round trip.
  private matchSummaries: MatchPlayerSummary[] = [];

  constructor(code: string, config: RoomConfig, onEmpty: () => void, onReport: (report: QuestionReport) => void) {
    this.code = code;
    this.config = config;
    this.onEmpty = onEmpty;
    this.onReport = onReport;
  }

  private colorFor(index: number): string {
    return PLAYER_PALETTE[index % PLAYER_PALETTE.length];
  }

  addPlayer(id: string, name: string, ws: WebSocket, userId: string | null, avatarId: string | null, titleId: string | null): InternalPlayer {
    const idx = this.order.length;
    const player: InternalPlayer = {
      id, ws, name: name.slice(0, 24) || 'Jogador',
      color: this.colorFor(idx),
      initial: (name.trim()[0] || 'J').toUpperCase(),
      avatarId, titleId,
      score: 0, perfectCount: 0, combo: 0, priorBests: null, connected: true, confirmed: false, readyNext: false,
      pickedColor: null, colorHistory: [], confirmedAtSeconds: null, raceResponseMs: null,
      userId, sessionId: null, missedRounds: 0,
    };
    this.players.set(id, player);
    this.order.push(id);
    if (!this.hostId) this.hostId = id;
    this.chat.push(sysMsg('#94A3B8', `${player.name} entrou na sala`));
    if (userId) { this.openSessionFor(id, userId); this.loadPriorBests(id, userId); }
    return player;
  }

  // Non-blocking priming read (see PriorBests' own doc comment in
  // stats.ts) — guarded the same way openSessionFor() already is, against
  // the player having disconnected by the time the read resolves.
  private loadPriorBests(id: string, userId: string) {
    fetchPlayerBests(userId).then((bests) => {
      const still = this.players.get(id);
      if (still) still.priorBests = bests;
    });
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
    const wasDisconnected = !p.connected;
    p.ws = ws;
    p.connected = true;
    const pending = this.lobbyLeaveTimers.get(id);
    if (pending) { clearTimeout(pending); this.lobbyLeaveTimers.delete(id); }
    if (p.userId && !p.sessionId) this.openSessionFor(id, p.userId);
    if (wasDisconnected) {
      this.chat.push(sysMsg('#4ADE80', `${p.name} voltou`));
      this.applyReconnectCatchUp(p, id);
    }
    this.broadcast();
    return true;
  }

  // Pays out a capped catch-up bonus for rounds missed while disconnected
  // (see missedRounds' own doc comment) — only during an actual match, and
  // only up to just under whoever's currently in last place, so reconnecting
  // can never leapfrog someone who stayed and kept playing. Multiplies this
  // player's own average score-per-round-played (their skill/luck so far
  // this match, not a flat number) by rounds missed, then clamps.
  private applyReconnectCatchUp(p: InternalPlayer, id: string) {
    const missed = p.missedRounds;
    p.missedRounds = 0;
    if (this.screen !== 'playing' || missed <= 0) return;
    const roundsPlayed = this.matchRoundScores.get(id)?.length ?? 0;
    if (roundsPlayed === 0) return;
    const avgScore = p.score / roundsPlayed;
    const rawBonus = Math.round(avgScore * missed);
    if (rawBonus <= 0) return;
    const otherScores = this.order
      .filter((pid) => pid !== id && this.players.get(pid)?.connected)
      .map((pid) => this.players.get(pid)!.score);
    if (otherScores.length === 0) return;
    const lowestOther = Math.min(...otherScores);
    const bonus = Math.max(0, Math.min(rawBonus, lowestOther - 1 - p.score));
    if (bonus <= 0) return;
    p.score += bonus;
    this.chat.push(sysMsg('#4ADE80', `${p.name} recebeu +${bonus} pontos de compensação (${missed} ${missed === 1 ? 'rodada perdida' : 'rodadas perdidas'})`));
  }

  // Explicit leave (player clicked SAIR) — skips the reconnect grace period
  // entirely, since there's nothing to grace: they told us they're leaving,
  // unlike disconnect() below which can't tell a deliberate close from a
  // dropped connection and has to assume the latter. Only the 'waiting'
  // screen has a grace period to skip; disconnect() already removes nobody
  // once a match is in progress (their slot/score has to survive a
  // reconnect), so this just falls through to the same behavior there.
  leave(id: string) {
    if (this.screen !== 'waiting') { this.disconnect(id); return; }
    const pending = this.lobbyLeaveTimers.get(id);
    if (pending) { clearTimeout(pending); this.lobbyLeaveTimers.delete(id); }
    const p = this.players.get(id);
    if (!p) return;
    if (p.sessionId) { closeGameSession(p.sessionId); p.sessionId = null; }
    this.players.delete(id);
    this.order = this.order.filter((pid) => pid !== id);
    if (this.hostId === id) this.hostId = this.order[0] ?? null;
    this.chat.push(sysMsg('#94A3B8', `${p.name} saiu da sala`));
    if (this.players.size === 0) { this.stopTimers(); this.onEmpty(); return; }
    this.broadcast();
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
    // Mid-match (or post-match) drop — no grace period here, their slot/score
    // already survives a reconnect on its own, so this chat line is the only
    // signal anyone gets that they left. reconnect() announces the return.
    this.chat.push(sysMsg('#94A3B8', `${p.name} saiu da sala`));
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
    const minPlayers = this.usesAiQuestions() ? 1 : 2;
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
    this.masterTurnIdx = 0;
    this.mastersSinceBonus = new Set();
    this.matchOutcomes = new Map();
    this.matchThemeTally = new Map();
    this.matchThemeIds = new Set();
    this.matchDifficultyTally = new Map();
    this.matchRaceStats = new Map();
    this.matchRoundScores = new Map();
    this.matchRoundResponseMs = new Map();
    this.matchUsedQuestionIds = new Map();
    this.matchXp = new Map();
    this.matchComboBest = new Map();
    this.matchNearPerfects = new Map();
    this.matchSummaries = [];
  }

  // "Which question source" is orthogonal to "which win condition" — race
  // mode always pulls from the AI question bank (no clue-writing master,
  // same source as phraseMode:'ai') but keeps its own rounds-based win
  // condition, never the AI mode's score/perfect threshold — see the two
  // separate checks in computeReveal().
  private usesAiQuestions(): boolean {
    return this.config.phraseMode === 'ai' || this.config.gameMode === 'race';
  }

  // `forAi` is passed explicitly rather than read from usesAiQuestions()
  // internally — a "Com a Galera" bonus round is AI-sourced too (see
  // startRound()'s isVerbalBonus) even though the room's own phraseMode
  // isn't 'ai', so the caller decides per-round, not per-room.
  private pickTheme(forAi: boolean): { id: string; icon: string; name: string } {
    let pool = this.config.selectedThemes.length
      ? LOBBY_THEMES.filter((t) => this.config.selectedThemes.includes(t.id))
      : LOBBY_THEMES;
    if (forAi) {
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

  // Picks a question for `themeId` avoiding, in priority order: (1) anything
  // already asked THIS match for that theme, (2) anything served recently
  // by ANY room on this process. Either exclusion is dropped once it would
  // empty the pool (a long match on a small bank must still be able to
  // pick something, and a repeat after truly everything else has already
  // been asked is a reasonable fallback, not a bug).
  private pickQuestion(themeId: string, bank: AiQuestion[]): AiQuestion | null {
    if (bank.length === 0) return null;
    const usedThisMatch = this.matchUsedQuestionIds.get(themeId);
    const notUsedThisMatch = usedThisMatch ? bank.filter((q) => !usedThisMatch.has(q.id)) : bank;
    const pool = notUsedThisMatch.length ? notUsedThisMatch : bank;
    const recent = new Set(recentlyServedGlobal.get(themeId) ?? []);
    const notRecent = pool.filter((q) => !recent.has(q.id));
    const finalPool = notRecent.length ? notRecent : pool;
    const q = finalPool[Math.floor(Math.random() * finalPool.length)];
    if (!this.matchUsedQuestionIds.has(themeId)) this.matchUsedQuestionIds.set(themeId, new Set());
    this.matchUsedQuestionIds.get(themeId)!.add(q.id);
    markServedGlobally(themeId, q.id);
    return q;
  }

  private connectedOrder(): string[] {
    return this.order.filter((id) => this.players.get(id)?.connected);
  }

  private startRound() {
    this.stopTimers();
    this.roundIdx += 1;
    const isRace = this.config.gameMode === 'race';
    const activeOrder = this.connectedOrder();

    // "Com a Galera" bonus round: once every currently connected player has
    // been Color Master since the last bonus round (a full cycle), the next
    // round comes from the AI question bank instead — same shape as Frase
    // da IA (no master, everyone guesses), scored double in computeReveal().
    const isVerbalBonus = this.config.phraseMode === 'verbal'
      && activeOrder.length > 0
      && activeOrder.every((id) => this.mastersSinceBonus.has(id));

    const isAi = this.usesAiQuestions() || isVerbalBonus;
    const theme = this.pickTheme(isAi);
    let masterId: string | null = null;
    let masterName = isRace ? 'Corrida' : 'IA';
    if (!isAi && activeOrder.length > 0) {
      masterId = activeOrder[this.masterTurnIdx % activeOrder.length];
      this.masterTurnIdx += 1;
      masterName = this.players.get(masterId)!.name;
      if (this.config.phraseMode === 'verbal') this.mastersSinceBonus.add(masterId);
    }
    if (isVerbalBonus) this.mastersSinceBonus.clear();

    for (const p of this.players.values()) {
      p.confirmed = false;
      p.readyNext = false;
      p.pickedColor = null;
      p.colorHistory = [];
      p.confirmedAtSeconds = null;
      p.raceResponseMs = null;
    }

    let phrase = '';
    let aiDifficulty: AiDifficulty | null = null;
    let aiSource: string | null = null;
    this.aiQuestionId = null;
    let secretHsl: HslColor = { h: Math.round(Math.random() * 360), s: Math.round(40 + Math.random() * 45), l: Math.round(22 + Math.random() * 45) };
    if (isAi) {
      // Admin can deactivate individual questions (question_overrides,
      // polled into isQuestionActive()) without touching the static
      // catalog — filtered here, same random-pick logic otherwise.
      const bank = (AI_QUESTIONS[theme.id] ?? []).filter((cand) => isQuestionActive(theme.id, cand.id));
      const q = this.pickQuestion(theme.id, bank);
      if (q) {
        phrase = q.pergunta;
        aiDifficulty = q.dificuldade;
        aiSource = q.fonte ?? null;
        this.aiQuestionId = q.id;
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
      doublePoints: isVerbalBonus,
    };
    this.results = null;
    this.secretHsl = secretHsl;
    this.raceDeadlineAt = null;
    this.matchThemeIds.add(theme.id);
    if (aiDifficulty) this.matchDifficultyTally.set(aiDifficulty, (this.matchDifficultyTally.get(aiDifficulty) ?? 0) + 1);

    this.chat.push(sysMsg('#FF5C8A', `Tema da Rodada · ${theme.name}`));
    this.chat.push(sysMsg('#29E7FF', isRace ? '⏱️ Corrida contra o Tempo — responda rápido!' : isVerbalBonus ? '🎁 Rodada bônus da IA — pontos em dobro!' : isAi ? '🤖 A IA escreveu a pista' : `✏️ Vez de ${masterName}`));

    if (isRace) {
      // Read-the-phrase phase first, no clock pressure — the 10s answer
      // window only starts once beginRacePlacing() fires, so the 3s here
      // never eats into it. pickColor()/confirmColor() both require
      // phase==='placing', so nobody can act during this window either.
      this.phase = 'race-intro';
      this.secondsLeft = null;
      this.raceIntroTimer = setTimeout(() => this.beginRacePlacing(), RACE_INTRO_MS);
    } else if (isAi) {
      this.phase = 'placing';
      this.secondsLeft = PLACING_SECONDS;
      this.startTicking();
    } else {
      this.phase = 'master-writing';
      this.secondsLeft = null;
    }
    this.broadcast();
  }

  private beginRacePlacing() {
    this.raceIntroTimer = null;
    // Stale-timer guard: the round could have moved on (restart, room
    // teardown) between scheduling this and it firing — stopTimers() also
    // cancels the underlying setTimeout on every such path, but this check
    // is a cheap second line of defense against acting on old state.
    if (this.phase !== 'race-intro') return;
    this.phase = 'placing';
    this.raceDeadlineAt = Date.now() + RACE_MS;
    this.startRaceTicking();
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
    if (this.config.gameMode === 'race' && this.raceDeadlineAt !== null) {
      p.raceResponseMs = clamp(Date.now() - (this.raceDeadlineAt - RACE_MS), 0, RACE_MS);
    } else {
      p.confirmedAtSeconds = this.secondsLeft ?? 0;
    }
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

  // Deadline-based, not a decrementing counter — the actual remaining time
  // (raceMsLeft, computed in stateFor()) is always freshly derived from
  // Date.now() vs. raceDeadlineAt on every broadcast, so this 100ms tick is
  // just what keeps the countdown visibly moving and detects the deadline;
  // it never accumulates its own drift into the value clients see.
  private startRaceTicking() {
    this.raceTickHandle = setInterval(() => {
      if (this.phase !== 'placing' || this.raceDeadlineAt === null) return;
      if (Date.now() >= this.raceDeadlineAt) {
        for (const id of this.eligibleGuessers()) {
          const p = this.players.get(id)!;
          if (!p.confirmed) { p.confirmed = true; p.raceResponseMs = null; if (!p.pickedColor) p.pickedColor = { ...DEFAULT_COLOR }; }
        }
        this.computeReveal();
        return;
      }
      this.broadcast();
    }, 100);
  }

  private computeReveal() {
    this.stopTicking();
    const secretHsl = this.secretHsl;
    const secretRgb = hslFracToRgb(secretHsl.h, secretHsl.s / 100, secretHsl.l / 100);
    const secretHex = rgbToHex(secretRgb.r, secretRgb.g, secretRgb.b);
    const guessers = this.eligibleGuessers();
    // Anyone disconnected right now gets zero points for this round (they're
    // excluded from `guessers` above) — tallied here so reconnect() can pay
    // out a capped catch-up bonus later. A disconnected MASTER still earns
    // masterGain normally below (their absence doesn't stall a round once
    // they've already submitted their phrase), so only non-master misses
    // count as "missed" here.
    for (const id of this.order) {
      const p = this.players.get(id);
      if (p && !p.connected && id !== this.round?.masterId) p.missedRounds += 1;
    }
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
    const isRace = this.config.gameMode === 'race';
    const modeId = isRace ? 'race' : this.config.phraseMode;
    const guessRows: RoundGuessRow[] = [];
    const guesses = base.map(({ id, p, hsl, de, baseScore }) => {
      const isRoundMvp = id === mvpId;
      // Perfect is purely accuracy-driven (baseScore/ΔE) in every mode —
      // speed is a fully separate axis, so "perfeito, mas com multiplicador
      // baixo (até 0x)" is an intentional, valid outcome in race mode.
      // Computed up front so PERFECT_BONUS below can use it in both
      // branches — badgeFromScore/roundOutcomeFromScore/matchRoundScores
      // still key off the untouched baseScore, same as speed/MVP bonuses.
      const badge = badgeFromScore(baseScore);
      const perfectBonus = badge === 'PERFEITO' ? PERFECT_BONUS : 0;
      let score: number;
      let timeMultiplier: number | undefined;
      let raceResponseSeconds: number | null | undefined;
      if (isRace) {
        const responseMs = p.raceResponseMs;
        // Never confirming within the window gets the same 1.0x floor as
        // confirming at the very last instant — raceTimeMultiplier(12)
        // already floors at 1.0x, so feeding it the full window length on
        // timeout means 0x is no longer a reachable outcome. responseSeconds
        // itself stays null on timeout (still genuinely unknown/never
        // answered), only the scoring multiplier is affected.
        timeMultiplier = raceTimeMultiplier((responseMs ?? RACE_MS) / 1000);
        raceResponseSeconds = responseMs === null ? null : responseMs / 1000;
        // Perfect bonus is flat, added after the multiplier — the multiplier
        // rewards speed on the accuracy portion, the perfect bonus rewards
        // nailing the color exactly, so it isn't itself speed-scaled.
        score = Math.round(baseScore * timeMultiplier) + perfectBonus;
      } else {
        const speedBonus = baseScore > 0 ? Math.round(SPEED_BONUS_MAX * ((p.confirmedAtSeconds ?? 0) / PLACING_SECONDS)) : 0;
        score = baseScore + speedBonus + perfectBonus + (isRoundMvp ? ROUND_MVP_BONUS : 0);
        // "Com a Galera" bonus round — badge/perfectCount/matchRoundScores
        // below all key off baseScore, which stays untouched, same as speed
        // and MVP bonuses already do.
        if (this.round?.doublePoints) score *= 2;
      }
      if (badge === 'PERFEITO') p.perfectCount += 1;
      const prevScore = p.score;
      p.score += score;

      // Stats accumulators for this match only — read once in
      // finishMatch(), reset by resetMatchAccumulators() on the next one.
      const outcome = roundOutcomeFromScore(baseScore);
      if (!this.matchOutcomes.has(id)) this.matchOutcomes.set(id, []);
      this.matchOutcomes.get(id)!.push(outcome);

      // Progression: combo survives across rounds within the match (see
      // InternalPlayer.combo's own doc comment), zeroed on a wrong guess —
      // purely a streak stat now (own titles/achievements), no longer an XP
      // multiplier. Levels track real accumulated points (see
      // shared/progression.ts), so XP gained this round is just `score`
      // itself (floored at 0 — a single bad round should never claw back
      // level progress already earned).
      if (outcome === 'wrong') p.combo = 0; else p.combo += 1;
      this.matchComboBest.set(id, Math.max(this.matchComboBest.get(id) ?? 0, p.combo));
      if (badge === 'CIRÚRGICO') this.matchNearPerfects.set(id, (this.matchNearPerfects.get(id) ?? 0) + 1);
      const xpGained = Math.max(0, score);
      this.matchXp.set(id, (this.matchXp.get(id) ?? 0) + xpGained);

      // Generic all-modes history (see matchRoundScores/matchRoundResponseMs
      // field comments). responseMs null means "never confirmed" in both
      // modes — classic's own auto-confirm-on-timeout never sets
      // confirmedAtSeconds, so this stays consistent with race's sentinel.
      const responseMs = isRace
        ? p.raceResponseMs
        : (p.confirmedAtSeconds !== null ? Math.round((PLACING_SECONDS - p.confirmedAtSeconds) * 1000) : null);

      // Admin analytics raw material — one row per guesser per round, only
      // for accounts we can attribute (no userId = not signed in, same
      // guard used for match-level stats). Persisted after the loop.
      if (p.userId && this.round) {
        const guessRgb = hslFracToRgb(hsl.h, hsl.s / 100, hsl.l / 100);
        const guessHex = rgbToHex(guessRgb.r, guessRgb.g, guessRgb.b);
        guessRows.push({
          matchId: this.matchId, roomCode: this.code, userId: p.userId, modeId,
          themeId: this.round.themeId, questionId: this.aiQuestionId, phrase: this.round.phrase,
          secretHex, guessHex, deltaE: de, score: baseScore, badge, responseMs,
        });
      }

      if (!this.matchRoundScores.has(id)) this.matchRoundScores.set(id, []);
      this.matchRoundScores.get(id)!.push(baseScore);
      if (!this.matchRoundResponseMs.has(id)) this.matchRoundResponseMs.set(id, []);
      this.matchRoundResponseMs.get(id)!.push(responseMs);
      if (themeId) {
        if (!this.matchThemeTally.has(id)) this.matchThemeTally.set(id, new Map());
        const themeMap = this.matchThemeTally.get(id)!;
        const entry = themeMap.get(themeId) ?? { correct: 0, wrong: 0, perfects: 0, bestScore: 0 };
        if (outcome === 'wrong') entry.wrong += 1;
        else { entry.correct += 1; if (outcome === 'perfect') entry.perfects += 1; }
        entry.bestScore = Math.max(entry.bestScore, baseScore);
        themeMap.set(themeId, entry);
      }
      if (isRace) {
        const acc = this.matchRaceStats.get(id) ?? {
          scoreNormalTotal: 0, responseMsSum: 0, multiplierSum: 0, timedRounds: 0,
          bestResponseMs: null, bestCorrectResponseMs: null, bestMultiplier: 0,
          multiplier2xCount: 0, anyTimeout: false,
        };
        acc.scoreNormalTotal += baseScore;
        if (p.raceResponseMs === null) {
          acc.anyTimeout = true;
        } else {
          acc.responseMsSum += p.raceResponseMs;
          acc.multiplierSum += timeMultiplier ?? 0;
          acc.timedRounds += 1;
          acc.bestResponseMs = acc.bestResponseMs === null ? p.raceResponseMs : Math.min(acc.bestResponseMs, p.raceResponseMs);
          acc.bestMultiplier = Math.max(acc.bestMultiplier, timeMultiplier ?? 0);
          if (timeMultiplier === 2.0) acc.multiplier2xCount += 1;
          if ((outcome === 'correct' || outcome === 'perfect')) {
            acc.bestCorrectResponseMs = acc.bestCorrectResponseMs === null ? p.raceResponseMs : Math.min(acc.bestCorrectResponseMs, p.raceResponseMs);
          }
        }
        this.matchRaceStats.set(id, acc);
      }

      return {
        playerId: id, name: p.name, color: p.color, initial: p.initial, avatarId: p.avatarId,
        hsl, deltaE: de, score, badge, isRoundMvp,
        prevScore, newScore: p.score,
        xpGained, combo: p.combo,
        ...(isRace ? { baseScore, timeMultiplier, raceResponseSeconds } : {}),
      };
    });
    recordRoundGuesses(guessRows);

    // Alternate win condition, every mode: first to reach the host-set
    // maxScore wins outright, whatever round it happens on. Checked against
    // guessers only (the master's average-of-guessers gain below isn't a
    // color match of their own, so it doesn't count). Frase da IA keeps an
    // extra accuracy-based alt condition on top (5 acertos perfeitos).
    if (!this.matchWinner) {
      const qualifiers = guesses
        .map((g) => ({ g, p: this.players.get(g.playerId)! }))
        .filter(({ p }) => p.score >= this.config.maxScore || (this.config.phraseMode === 'ai' && p.perfectCount >= AI_WIN_PERFECTS));
      if (qualifiers.length > 0) {
        const winner = qualifiers.reduce((best, cur) => (cur.p.score > best.p.score ? cur : best), qualifiers[0]);
        this.matchWinner = {
          playerId: winner.g.playerId, name: winner.g.name, score: winner.p.score,
          reason: winner.p.score >= this.config.maxScore ? 'points' : 'perfect',
          isDraw: false,
          winners: [{ playerId: winner.g.playerId, name: winner.g.name, score: winner.p.score }],
        };
      }
    }

    let masterId: string | null = null, masterName: string | null = null, masterAvatarId: string | null = null;
    let masterPrevScore = 0, masterNewScore = 0;
    if (this.round?.masterId) {
      masterId = this.round.masterId;
      const master = this.players.get(masterId)!;
      masterName = master.name;
      masterAvatarId = master.avatarId;
      masterPrevScore = master.score;
      master.score += masterGain;
      masterNewScore = master.score;
    }

    // Round-count fallback for every mode. Reaching maxScore above normally
    // ends the match early, but casual play very often never reaches it —
    // without this fallback the match would just run past the configured
    // round count forever, only ever ending when the room empties and gets
    // recorded as *abandoned* instead of finished (which never bumps
    // games_played).
    // Decided by whoever has the highest cumulative score at that point
    // (tied top scores are recorded as a draw, not resolved arbitrarily).
    // Placed after the master's own score update above so their final-round
    // gain counts (race rounds have no master, so that's a no-op for them).
    if (!this.matchWinner && this.roundIdx + 1 >= this.config.numRounds) {
      this.finishByTopScore();
    }

    this.results = {
      secretHsl, secretHex,
      guesses, masterId, masterName, masterAvatarId, masterPrevScore, masterNewScore, masterGain,
      doublePoints: this.round?.doublePoints ?? false,
    };
    this.phase = 'reveal';
    this.secondsLeft = null;
    this.raceDeadlineAt = null;
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

  // Shared by the 'players' and 'race' rounds-exhausted win conditions —
  // whoever has the highest cumulative score wins; a tied top score is a
  // draw, never resolved arbitrarily.
  private finishByTopScore() {
    const standings = this.order
      .map((id) => this.players.get(id))
      .filter((p): p is InternalPlayer => !!p);
    if (standings.length === 0) return;
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
    const matchSummaries: MatchPlayerSummary[] = [];

    for (const id of this.order) {
      const p = this.players.get(id);
      if (!p) continue;
      if (!p.connected) { if (p.userId) abandonedUserIds.push(p.userId); continue; }

      const result: 'won' | 'lost' | 'drawn' = winnerIds.has(id) ? (winner.isDraw ? 'drawn' : 'won') : 'lost';
      const roundScores = this.matchRoundScores.get(id) ?? [];
      const roundResponseMsList = this.matchRoundResponseMs.get(id) ?? [];
      const comboBest = this.matchComboBest.get(id) ?? 0;
      const nearPerfects = this.matchNearPerfects.get(id) ?? 0;
      const avgPrecision = roundScores.length ? Math.round(roundScores.reduce((s, v) => s + v, 0) / roundScores.length) : 0;
      const validResponseMs = roundResponseMsList.filter((v): v is number => v !== null);
      const avgResponseMs = validResponseMs.length ? Math.round(validResponseMs.reduce((s, v) => s + v, 0) / validResponseMs.length) : null;

      // No flat played/win/draw bonuses anymore — XP is purely accumulated
      // points now (see shared/progression.ts), so it only ever holds real
      // score gained this match. Every connected player gets this on their
      // own match-end screen (even a guest with no userId), but only
      // signed-in players get it persisted below.
      const xpEarned = this.matchXp.get(id) ?? 0;

      let records: MatchPlayerSummary['records'] = null;
      let levelUp: MatchPlayerSummary['levelUp'] = null;
      if (p.priorBests) {
        const prior = p.priorBests;
        records = {
          scoreIsNewBest: p.score > prior.bestScore,
          comboIsNewBest: comboBest > prior.bestCombo,
          precisionIsNewBest: avgPrecision > prior.bestAvgPrecision,
          responseTimeIsNewBest: avgResponseMs !== null && (prior.bestAvgResponseMs === null || avgResponseMs < prior.bestAvgResponseMs),
          pointsToNextScoreRecord: p.score > prior.bestScore ? null : prior.bestScore - p.score,
        };
        const newLevel = levelForXp(prior.xp + xpEarned);
        if (newLevel > prior.level) levelUp = { from: prior.level, to: newLevel };
      }

      matchSummaries.push({
        playerId: id, xpEarned, comboBest, avgPrecision, avgResponseMs,
        perfects: p.perfectCount, nearPerfects, records, levelUp,
      });

      if (!p.userId) continue;

      const themeTallies: ThemeTally[] = [...(this.matchThemeTally.get(id)?.entries() ?? [])]
        .map(([theme_id, t]) => ({ theme_id, correct: t.correct, wrong: t.wrong, perfects: t.perfects, best_score: t.bestScore }));
      const raceAcc = this.matchRaceStats.get(id);

      summaries.push({
        userId: p.userId,
        matchId: this.matchId,
        roomCode: this.code,
        // A distinct mode_id from 'ai' even though race rounds source
        // questions the same way — it's a genuinely different ruleset
        // (10s deadline, multiplicative scoring), and every stats/
        // achievement table is already free-text mode_id by design.
        modeId: this.config.gameMode === 'race' ? 'race' : this.config.phraseMode,
        themeIds,
        difficulty,
        score: p.score,
        perfects: p.perfectCount,
        result,
        durationSeconds,
        playedAt,
        roundOutcomes: this.matchOutcomes.get(id) ?? [],
        themeTallies,
        roundScores,
        roundResponseMs: roundResponseMsList,
        race: raceAcc ? {
          scoreNormalTotal: raceAcc.scoreNormalTotal,
          responseMsSum: raceAcc.responseMsSum,
          multiplierSum: raceAcc.multiplierSum,
          timedRounds: raceAcc.timedRounds,
          bestResponseMs: raceAcc.bestResponseMs,
          bestCorrectResponseMs: raceAcc.bestCorrectResponseMs,
          bestMultiplier: raceAcc.bestMultiplier,
          multiplier2xCount: raceAcc.multiplier2xCount,
          noTimeout: !raceAcc.anyTimeout,
        } : undefined,
        xpEarned,
        comboBest,
      });
    }

    this.matchSummaries = matchSummaries;
    recordMatchResult(summaries);
    recordAbandonedMatch(abandonedUserIds);
  }

  /** Host-only: replay in the same room with the same players, scores reset. */
  restartMatch(playerId: string) {
    if (playerId !== this.hostId || this.screen !== 'finished') return;
    this.stopTimers();
    for (const p of this.players.values()) {
      p.score = 0; p.perfectCount = 0; p.combo = 0; p.confirmed = false; p.readyNext = false;
      p.pickedColor = null; p.colorHistory = []; p.confirmedAtSeconds = null; p.raceResponseMs = null;
      p.missedRounds = 0;
      // Prior bests go stale the moment the match that just ended wrote new
      // ones — reload so the replay's own record comparison is accurate,
      // not stuck comparing against pre-previous-match values.
      if (p.userId) this.loadPriorBests(p.id, p.userId);
    }
    this.roundIdx = -1;
    this.round = null;
    this.phase = null;
    this.secondsLeft = null;
    this.raceDeadlineAt = null;
    this.results = null;
    this.matchWinner = null;
    this.matchSummaries = [];
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
      reporterUserId: p.userId,
      themeId: this.round.themeId,
      themeName: this.round.themeName,
      questionId: this.aiQuestionId,
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
    if (this.raceTickHandle) { clearInterval(this.raceTickHandle); this.raceTickHandle = null; }
    if (this.raceIntroTimer) { clearTimeout(this.raceIntroTimer); this.raceIntroTimer = null; }
  }
  private stopTimers() {
    this.stopTicking();
    this.stopReadyWait();
    for (const t of this.lobbyLeaveTimers.values()) clearTimeout(t);
    this.lobbyLeaveTimers.clear();
  }

  private publicPlayer(p: InternalPlayer): PlayerPublic {
    return {
      id: p.id, name: p.name, color: p.color, initial: p.initial,
      avatarId: p.avatarId, titleId: p.titleId, score: p.score,
      connected: p.connected, isHost: p.id === this.hostId, confirmed: p.confirmed, readyNext: p.readyNext,
      combo: p.combo,
    };
  }

  private stateFor(playerId: string): RoomStateView {
    const me = this.players.get(playerId)!;
    const activeIds = this.connectedOrder();
    return {
      code: this.code,
      screen: this.screen,
      config: this.config,
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
      // Computed fresh on every single broadcast (never a ticker-only
      // field) — pickColor() alone can fire dozens of broadcasts/second
      // between raceTickHandle's own 100ms ticks, and every one of those
      // needs an accurate, non-stale remaining time.
      raceMsLeft: (this.phase === 'placing' && this.raceDeadlineAt !== null)
        ? Math.max(0, this.raceDeadlineAt - Date.now()) : null,
      results: this.results,
      nextReady: {
        ready: activeIds.filter((id) => this.players.get(id)?.readyNext).length,
        total: activeIds.length,
      },
      matchWinner: this.matchWinner,
      matchSummary: this.matchSummaries.length ? this.matchSummaries : null,
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
