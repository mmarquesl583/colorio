export type PhraseMode = 'players' | 'ai';
export type Privacy = 'public' | 'private';

export interface RoomConfig {
  numPlayers: number;
  numRounds: number;
  phraseMode: PhraseMode;
  privacy: Privacy;
  selectedThemes: string[];
}

export type RoundPhase = 'master-writing' | 'placing' | 'reveal';
export type ScreenState = 'waiting' | 'playing';

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
  hsl: HslColor;
  deltaE: number;
  score: number;
  badge: 'PERFEITO' | 'QUASE PERFEITO' | 'MUITO PERTO' | 'PERTO' | 'DISTANTE';
  isRoundMvp: boolean;
  prevScore: number;
  newScore: number;
}

export interface RoundResults {
  secretHsl: HslColor;
  secretHex: string;
  guesses: RevealPlayerResult[];
  masterId: string | null;
  masterName: string | null;
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
}

export type ClientMessage =
  | { type: 'create_room'; name: string; config: RoomConfig }
  | { type: 'join_room'; code: string; name: string }
  | { type: 'rejoin'; code: string; playerId: string }
  | { type: 'update_config'; config: Partial<RoomConfig> }
  | { type: 'start_match' }
  | { type: 'pick_color'; hsl: HslColor }
  | { type: 'confirm_color' }
  | { type: 'submit_phrase'; text: string }
  | { type: 'send_chat'; text: string }
  | { type: 'ready_next' };

export type ServerMessage =
  | { type: 'joined'; code: string; playerId: string }
  | { type: 'state'; state: RoomStateView }
  | { type: 'error'; message: string };
