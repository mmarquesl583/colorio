export type PhraseMode = 'players' | 'ai';
export type Privacy = 'public' | 'private';
// Orthogonal to PhraseMode — 'race' always sources questions from the AI
// bank and has no clue-writing master (see room.ts's usesAiQuestions()),
// but is a distinct timing/scoring ruleset, not a 3rd clue source.
export type GameMode = 'classic' | 'race';

export interface RoomConfig {
  numPlayers: number;
  numRounds: number;
  phraseMode: PhraseMode;
  gameMode: GameMode;
  privacy: Privacy;
  selectedThemes: string[];
}

export type RoundPhase = 'master-writing' | 'placing' | 'reveal';
export type ScreenState = 'waiting' | 'playing' | 'finished';

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export interface PlayerPublic {
  id: string;
  name: string;
  color: string;
  initial: string;
  avatarId: string | null;
  titleId: string | null;
  score: number;
  connected: boolean;
  isHost: boolean;
  confirmed: boolean;
  readyNext: boolean;
}

export interface ChatEntry {
  id: string;
  type: 'sys' | 'msg';
  color: string;
  text: string;
  name?: string;
  ts: number;
}

export interface RevealPlayerResult {
  playerId: string;
  name: string;
  color: string;
  initial: string;
  avatarId: string | null;
  hsl: HslColor;
  deltaE: number;
  score: number;
  badge: 'PERFEITO' | 'QUASE PERFEITO' | 'MUITO PERTO' | 'PERTO' | 'DISTANTE';
  isRoundMvp: boolean;
  prevScore: number;
  newScore: number;
  /** Only set for gameMode:'race' rounds — baseScore is score before the
   * time multiplier, timeMultiplier is what was applied (0 on timeout),
   * raceResponseSeconds is null on timeout, otherwise the exact response
   * time. Undefined for classic-mode rounds. */
  baseScore?: number;
  timeMultiplier?: number;
  raceResponseSeconds?: number | null;
}

export interface RoundResults {
  secretHsl: HslColor;
  secretHex: string;
  guesses: RevealPlayerResult[];
  masterId: string | null;
  masterName: string | null;
  masterAvatarId: string | null;
  masterPrevScore: number;
  masterNewScore: number;
  masterGain: number;
}

export interface RoundView {
  idx: number;
  number: number;
  themeId: string;
  themeIcon: string;
  themeName: string;
  masterId: string | null;
  masterName: string;
  phrase: string;
  isAiPhrase: boolean;
  aiDifficulty: 'facil' | 'media' | 'dificil' | null;
  aiSource: string | null;
}

export interface YouView extends PlayerPublic {
  isMaster: boolean;
  pickedColor: HslColor | null;
  colorHistory: string[];
  masterSecret: HslColor | null;
}

/** Set once a match ends — either the Frase da IA win condition (10000
 * pontos or 5 acertos perfeitos) or, in Frase dos jogadores, the last
 * configured round finishing. `playerId`/`name`/`score` stay a single
 * back-compat winner (first tied winner if it's a draw); `winners` is the
 * full list, with 2+ entries only when `isDraw`. */
export interface MatchWinner {
  playerId: string;
  name: string;
  score: number;
  reason: 'points' | 'perfect' | 'rounds';
  isDraw: boolean;
  winners: { playerId: string; name: string; score: number }[];
}

export interface RoomStateView {
  code: string;
  screen: ScreenState;
  config: RoomConfig;
  roomFull: boolean;
  you: YouView;
  players: PlayerPublic[];
  chat: ChatEntry[];
  round: RoundView | null;
  phase: RoundPhase | null;
  secondsLeft: number | null;
  results: RoundResults | null;
  nextReady: { ready: number; total: number };
  matchWinner: MatchWinner | null;
  /** Seconds until the reveal auto-advances even if not everyone readied up. */
  readySecondsLeft: number | null;
  /** Milliseconds left in a gameMode:'race' round's 10s clock — recomputed
   * from a server-side deadline on every single broadcast (never a
   * ticker-only-updated field), so it's never stale between ticks. Always
   * null outside an active race-mode 'placing' phase; classic-mode rounds
   * keep using secondsLeft exactly as before, untouched. */
  raceMsLeft: number | null;
}

/** Summary shown in the "open rooms" list on the home screen (public rooms only). */
export interface PublicRoomSummary {
  code: string;
  hostName: string;
  playerCount: number;
  numPlayers: number;
  phraseMode: PhraseMode;
  screen: ScreenState;
  numRounds: number;
}

export type ClientMessage =
  | { type: 'create_room'; name: string; config: RoomConfig; token: string | null; avatarId: string | null; titleId: string | null }
  | { type: 'join_room'; code: string; name: string; token: string | null; avatarId: string | null; titleId: string | null }
  | { type: 'rejoin'; code: string; playerId: string }
  | { type: 'update_config'; config: Partial<RoomConfig> }
  | { type: 'start_match' }
  | { type: 'pick_color'; hsl: HslColor }
  | { type: 'confirm_color' }
  | { type: 'submit_phrase'; text: string }
  | { type: 'send_chat'; text: string }
  | { type: 'ready_next' }
  | { type: 'restart_match' }
  | { type: 'report_question' };

export type ServerMessage =
  | { type: 'joined'; code: string; playerId: string }
  | { type: 'state'; state: RoomStateView }
  | { type: 'error'; message: string };
