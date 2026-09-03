// 'verbal': same "a human master gives the clue" shape as 'players', but the
// clue is spoken out loud in person instead of typed — for playing together
// in the same room. The master still calls submit_phrase (see room.ts),
// just with a fixed placeholder instead of real typed text.
export type PhraseMode = 'players' | 'ai' | 'verbal';
export type Privacy = 'public' | 'private';
// Orthogonal to PhraseMode — 'race' always sources questions from the AI
// bank and has no clue-writing master (see room.ts's usesAiQuestions()),
// but is a distinct timing/scoring ruleset, not a 3rd clue source.
export type GameMode = 'classic' | 'race';

export interface RoomConfig {
  numRounds: number;
  /** Alternate win condition: first player to reach this score wins the
   * match immediately, whatever round it happens on (see AI_WIN_PERFECTS'
   * doc comment in gameData.ts for Frase da IA's extra alt condition). */
  maxScore: number;
  phraseMode: PhraseMode;
  gameMode: GameMode;
  privacy: Privacy;
  selectedThemes: string[];
}

// 'race-intro' only happens for gameMode:'race' rounds — the theme+phrase
// popup phase before the 10s answer clock starts (see room.ts's
// beginRacePlacing()). No equivalent exists for classic rounds.
export type RoundPhase = 'master-writing' | 'placing' | 'reveal' | 'race-intro';
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
  /** Consecutive good guesses within the current match (0 after a wrong
   * guess or a match restart) — same trust level as `score`, visible live
   * for every player in the room. Only guessers accumulate this; the
   * clue-writing master in Frase dos jogadores stays at 0. */
  combo: number;
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
  badge: 'PERFEITO' | 'CIRÚRGICO' | 'MUITO PERTO' | 'PERTO' | 'QUASE LÁ' | 'NEM PERTO' | 'PASSOU LONGE';
  isRoundMvp: boolean;
  prevScore: number;
  newScore: number;
  /** XP earned this round (already combo-multiplied — see
   * shared/progression.ts's comboXpMultiplier) and the guesser's combo
   * count AFTER this round's outcome. Unconditional, every mode. */
  xpGained: number;
  combo: number;
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

/** Personal-record comparison for one player's just-finished match — `null`
 * fields never happen except `pointsToNextScoreRecord`, which is null
 * exactly when `scoreIsNewBest` is true (nothing to count down to). */
export interface MatchRecordFlags {
  scoreIsNewBest: boolean;
  comboIsNewBest: boolean;
  precisionIsNewBest: boolean;
  responseTimeIsNewBest: boolean;
  pointsToNextScoreRecord: number | null;
}

/** One per connected, signed-in participant, built once at match end
 * (`Room.recordMatchStats()`) — powers the match-end screen's stat
 * breakdown and record/level-up callouts without waiting on a Postgres
 * round trip. `records`/`levelUp` are null only when this player's
 * "prior bests" snapshot hadn't loaded yet (very fast games) or they're
 * not signed in. */
export interface MatchPlayerSummary {
  playerId: string;
  xpEarned: number;
  comboBest: number;
  avgPrecision: number;
  avgResponseMs: number | null;
  perfects: number;
  nearPerfects: number;
  records: MatchRecordFlags | null;
  levelUp: { from: number; to: number } | null;
}

export interface RoomStateView {
  code: string;
  screen: ScreenState;
  config: RoomConfig;
  you: YouView;
  players: PlayerPublic[];
  chat: ChatEntry[];
  round: RoundView | null;
  phase: RoundPhase | null;
  secondsLeft: number | null;
  results: RoundResults | null;
  nextReady: { ready: number; total: number };
  matchWinner: MatchWinner | null;
  /** Set once, alongside matchWinner, right when the match ends — null
   * before then and reset to null on restartMatch(). */
  matchSummary: MatchPlayerSummary[] | null;
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
  phraseMode: PhraseMode;
  screen: ScreenState;
  numRounds: number;
}

export type ClientMessage =
  | { type: 'create_room'; name: string; config: RoomConfig; token: string | null; avatarId: string | null; titleId: string | null }
  | { type: 'join_room'; code: string; name: string; token: string | null; avatarId: string | null; titleId: string | null }
  | { type: 'rejoin'; code: string; playerId: string }
  | { type: 'leave_room' }
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
