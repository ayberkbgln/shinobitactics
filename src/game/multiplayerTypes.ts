import { ArenaMapId, AugmentId, EnemyWaveUnit, OwnedUnit } from './types';

export type EmoteId = 'ateş' | 'yıldırım' | 'zafer' | 'şaşkın' | 'kunai' | 'kage';

export interface EmoteDef {
  id: EmoteId;
  label: string;
  shortText: string;
  color: string;
}

export const EMOTES: EmoteDef[] = [
  { id: 'ateş', label: 'Alevli!', shortText: 'ALEV!', color: '#f97316' },
  { id: 'yıldırım', label: 'Şimşek Hızı', shortText: 'ZAP!', color: '#38bdf8' },
  { id: 'zafer', label: 'Kolaydı!', shortText: 'GG!', color: '#4ade80' },
  { id: 'şaşkın', label: 'Nasıl?!', shortText: '?!', color: '#facc15' },
  { id: 'kunai', label: 'Meydan Okuma', shortText: 'VS!', color: '#ef4444' },
  { id: 'kage', label: 'Kage Gücü', shortText: 'KAGE', color: '#c084fc' },
];

export interface OnlinePlayerSummary {
  id: string;
  nickname: string;
  avatarId: string;
  arenaId: ArenaMapId;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
  hp: number;
  level: number;
  gold: number;
  streak: number;
  wins: number;
  losses: number;
  ready: boolean;
  eliminated: boolean;
  placement: number | null;
  augments: AugmentId[];
  boardUnits: OwnedUnit[]; // Player's own coordinates (rows 3..5) for live scouting
  currentOpponentId: string | null;
}

export type RoomStatus = 'lobby' | 'prep' | 'combat' | 'resolution' | 'finished';

export interface OnlineRoomState {
  code: string;
  status: RoomStatus;
  round: number;
  prepSecondsLeft: number;
  fillBots: boolean;
  hostId: string;
  players: OnlinePlayerSummary[];
}

export interface OnlineMatchupPayload {
  round: number;
  seed: number;
  arena: ArenaMapId;
  arenaOwnerName: string;
  opponentId: string;
  opponentName: string;
  opponentAvatar: string;
  opponentAugments: AugmentId[];
  enemyUnits: EnemyWaveUnit[]; // Already mirrored into rows 0..2
  isGhost: boolean;
}

export interface OnlineRoundResultPayload {
  round: number;
  won: boolean;
  damageTaken: number;
  newHp: number;
  opponentName: string;
  eliminated: boolean;
  placement: number | null;
  matchFinished: boolean;
  winnerName: string | null;
}

export interface IncomingEmote {
  id: number;
  fromPlayerId: string;
  fromName: string;
  emoteId: EmoteId;
  receivedAt: number;
}

// Client -> Server WebSocket protocol
export type ClientWsMessage =
  | { type: 'room:create'; nickname: string; avatarId: string; arenaId: ArenaMapId; fillBots: boolean }
  | { type: 'room:join'; code: string; nickname: string; avatarId: string; arenaId: ArenaMapId }
  | { type: 'room:set_arena'; arenaId: ArenaMapId }
  | { type: 'room:leave' }
  | { type: 'room:toggle_bots'; fillBots: boolean }
  | { type: 'room:start' }
  | {
      type: 'player:sync_board';
      boardUnits: OwnedUnit[];
      level: number;
      gold: number;
      augments: AugmentId[];
    }
  | { type: 'player:ready'; ready: boolean }
  | { type: 'player:combat_done'; round: number }
  | { type: 'player:emote'; emoteId: EmoteId };

// Server -> Client WebSocket protocol
export type ServerWsMessage =
  | { type: 'connected'; playerId: string }
  | { type: 'error'; message: string }
  | { type: 'room:state'; room: OnlineRoomState; youId: string }
  | { type: 'room:tick'; prepSecondsLeft: number }
  | { type: 'match:start_combat'; matchup: OnlineMatchupPayload }
  | { type: 'match:round_resolved'; result: OnlineRoundResultPayload; room: OnlineRoomState }
  | { type: 'room:emote'; fromPlayerId: string; fromName: string; emoteId: EmoteId };
