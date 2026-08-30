import type { WebSocket } from 'ws';
import {
  hslFracToRgb, rgbToHex, hexToRgb, rgbToHslFrac,
} from '../../shared/color.ts';
import { calculateColorScore, calculateMasterScore, badgeFromDeltaE } from '../../shared/scoring.ts';
import { LOBBY_THEMES, AI_PHRASE_BANK, PLAYER_PALETTE, PLACING_SECONDS, NEXT_ROUND_READY_TIMEOUT_MS, SPEED_BONUS_MAX, ROUND_MVP_BONUS } from '../../shared/gameData.ts';
import { AI_QUESTIONS } from '../../shared/aiQuestions.ts';
import type { AiDifficulty } from '../../shared/aiQuestions.ts';
import type {
  RoomConfig, RoundPhase, ScreenState, HslColor, ChatEntry,
  RoundView, RoundResults, RoomStateView, PlayerPublic,
} from '../../shared/types.ts';
import { newChatId } from './id.ts';

const DEFAULT_COLOR: HslColor = { h: 260, s: 60, l: 55 };

interface InternalPlayer {
  id: string;
  ws: WebSocket | null;
  name: string;
  color: string;
  initial: string;
  score: number;
  connected: boolean;
  confirmed: boolean;
  readyNext: boolean;
  pickedColor: HslColor | null;
  colorHistory: string[];
  confirmedAtSeconds: number | null;
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
  round: RoundView | null = null;
  phase: RoundPhase | null = null;
  secondsLeft: number | null = null;
  results: RoundResults | null = null;
  lastThemeId: string | null = null;

  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private nextReadyFallback: ReturnType<typeof setTimeout> | null = null;
  private onEmpty: () => void;

  constructor(code: string, config: RoomConfig, onEmpty: () => void) {
    this.code = code;
    this.config = config;
    this.onEmpty = onEmpty;
  }

  private colorFor(index: number): string {
    return PLAYER_PALETTE[index % PLAYER_PALETTE.length];
  }

  addPlayer(id: string, name: string, ws: WebSocket): InternalPlayer {
    const idx = this.order.length;
    const player: InternalPlayer = {
      id, ws, name: name.slice(0, 20) || 'Jogador',
      color: this.colorFor(idx),
      initial: (name.trim()[0] || 'J').toUpperCase(),
      score: 0, connected: true, confirmed: false, readyNext: false,
      pickedColor: null, colorHistory: [], confirmedAtSeconds: null,
    };
    this.players.set(id, player);
    this.order.push(id);
    if (!this.hostId) this.hostId = id;
    this.chat.push(sysMsg('#94A3B8', `${player.name} entrou na sala`));
    return player;
  }

  reconnect(id: string, ws: WebSocket): boolean {
    const p = this.players.get(id);
    if (!p) return false;
    p.ws = ws;
    p.connected = true;
    return true;
  }

  disconnect(id: string) {
    const p = this.players.get(id);
    if (!p) return;
    p.connected = false;
    p.ws = null;
    if (this.screen === 'waiting') {
      // In the lobby a disconnect frees the slot entirely.
      this.players.delete(id);
      this.order = this.order.filter((pid) => pid !== id);
      if (this.hostId === id) this.hostId = this.order[0] ?? null;
      this.chat.push(sysMsg('#94A3B8', `${p.name} saiu da sala`));
    }
    if (this.players.size === 0 || this.order.every((pid) => !this.players.get(pid)?.connected)) {
      this.stopTimers();
      this.onEmpty();
      return;
    }
    if (this.screen === 'playing') this.maybeAdvanceFromPlacing();
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
    this.startRound();
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

    const guesses = base.map(({ id, p, hsl, de, baseScore }) => {
      const speedBonus = baseScore > 0 ? Math.round(SPEED_BONUS_MAX * ((p.confirmedAtSeconds ?? 0) / PLACING_SECONDS)) : 0;
      const isRoundMvp = id === mvpId;
      const score = baseScore + speedBonus + (isRoundMvp ? ROUND_MVP_BONUS : 0);
      const prevScore = p.score;
      p.score += score;
      return {
        playerId: id, name: p.name, color: p.color, initial: p.initial,
        hsl, deltaE: de, score, badge: badgeFromDeltaE(de), isRoundMvp,
        prevScore, newScore: p.score,
      };
    });

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

    this.results = {
      secretHsl, secretHex,
      guesses, masterId, masterName, masterPrevScore, masterNewScore, masterGain,
    };
    this.phase = 'reveal';
    this.secondsLeft = null;
    for (const p of this.players.values()) p.readyNext = false;
    this.broadcast();

    this.nextReadyFallback = setTimeout(() => this.startRound(), NEXT_ROUND_READY_TIMEOUT_MS + 6000);
  }

  readyNext(playerId: string) {
    const p = this.players.get(playerId);
    if (!p || this.phase !== 'reveal') return;
    p.readyNext = true;
    const active = this.connectedOrder();
    const allReady = active.length > 0 && active.every((id) => this.players.get(id)?.readyNext);
    this.broadcast();
    if (allReady) {
      if (this.nextReadyFallback) { clearTimeout(this.nextReadyFallback); this.nextReadyFallback = null; }
      this.startRound();
    }
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
    if (this.nextReadyFallback) { clearTimeout(this.nextReadyFallback); this.nextReadyFallback = null; }
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
