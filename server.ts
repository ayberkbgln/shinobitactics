import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  ARENA_MAPS,
  AUGMENTS,
  BOARD_COLS,
  BOARD_ROWS,
  ITEMS,
  MAX_LEVEL,
  PLAYER_START_ROW,
  SHINOBI_BY_ID,
  SHINOBI_ROSTER,
} from './src/game/data';
import {
  ClientWsMessage,
  EMOTES,
  EmoteId,
  OnlineMatchupPayload,
  OnlinePlayerSummary,
  OnlineRoomState,
  OnlineRoundResultPayload,
  RoomStatus,
  ServerWsMessage,
} from './src/game/multiplayerTypes';
import {
  calculatePlayerDamage,
  getMaxBoardUnits,
  mirrorBoardForEnemy,
  simulateHeadlessCombat,
} from './src/game/rules';
import { ArenaMapId, AugmentId, ItemId, OwnedUnit, StarLevel } from './src/game/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MAX_ROOM_PLAYERS = 8;
const PREP_SECONDS = 30;
const COMBAT_SAFETY_TIMEOUT_MS = 28_000;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const VALID_EMOTE_IDS = new Set<string>(EMOTES.map((e) => e.id));

const BOT_PROFILES: Array<{ nickname: string; avatarId: string; arenaId: ArenaMapId }> = [
  { nickname: 'Gölge Kage', avatarId: 'kakaashi', arenaId: 'final_vadisi' },
  { nickname: 'Kum Ustası', avatarId: 'gaarra', arenaId: 'ates_kalesi' },
  { nickname: 'Kızıl Şahin', avatarId: 'itachii', arenaId: 'kanli_ay' },
  { nickname: 'Sarı Yıldırım', avatarId: 'minaato', arenaId: 'yagmur_kulesi' },
  { nickname: 'Kurbağa Bilge', avatarId: 'jirayaa', arenaId: 'ates_kalesi' },
  { nickname: 'Kil Sanatçısı', avatarId: 'deidarra', arenaId: 'yagmur_kulesi' },
];

interface PendingOutcome {
  opponentId: string;
  opponentName: string;
  won: boolean;
  damageTaken: number;
}

interface ServerPlayer {
  id: string;
  ws: WebSocket | null;
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
  combatDone: boolean;
  eliminated: boolean;
  placement: number | null;
  augments: AugmentId[];
  boardUnits: OwnedUnit[];
  currentOpponentId: string | null;
  lastEmoteAt: number;
}

interface ServerRoom {
  code: string;
  status: RoomStatus;
  round: number;
  prepSecondsLeft: number;
  fillBots: boolean;
  hostId: string;
  players: Map<string, ServerPlayer>;
  prepTimer: NodeJS.Timeout | null;
  combatTimeout: NodeJS.Timeout | null;
  resolutionTimeout: NodeJS.Timeout | null;
  pendingOutcomes: Map<string, PendingOutcome>;
}

const rooms = new Map<string, ServerRoom>();
const socketToPlayer = new Map<WebSocket, { playerId: string; roomCode: string | null }>();
let playerSeq = 1;

function sanitizeNickname(raw: unknown): string {
  if (typeof raw !== 'string') return 'Shinobi';
  const cleaned = raw.replace(/[\u0000-\u001F\u007F<>]/g, '').trim().slice(0, 16);
  return cleaned.length > 0 ? cleaned : 'Shinobi';
}

function sanitizeAvatarId(raw: unknown): string {
  if (typeof raw === 'string' && SHINOBI_BY_ID[raw]) return raw;
  return 'nartuto';
}

function sanitizeArenaId(raw: unknown): ArenaMapId {
  if (typeof raw === 'string' && raw in ARENA_MAPS) return raw as ArenaMapId;
  return 'kanli_ay';
}

function sanitizeRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return null;
  return code;
}

function generateRoomCode(): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return `KAGE${Math.floor(10 + Math.random() * 89)}`;
}

function createStarterBoard(ownerId: string): OwnedUnit[] {
  return [
    {
      uid: `${ownerId}_start_1`,
      defId: 'nartuto',
      stars: 1,
      location: 'board',
      benchIndex: null,
      hex: { col: 3, row: 3 },
      items: [],
    },
    {
      uid: `${ownerId}_start_2`,
      defId: 'sakuura',
      stars: 1,
      location: 'board',
      benchIndex: null,
      hex: { col: 2, row: 4 },
      items: [],
    },
  ];
}

function sanitizeAugments(raw: unknown): AugmentId[] {
  if (!Array.isArray(raw)) return [];
  const valid: AugmentId[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item in AUGMENTS && !valid.includes(item as AugmentId)) {
      valid.push(item as AugmentId);
    }
    if (valid.length >= 3) break;
  }
  return valid;
}

function sanitizeBoardUnits(
  raw: unknown,
  maxUnits: number,
): OwnedUnit[] {
  if (!Array.isArray(raw)) return [];
  const usedHexes = new Set<string>();
  const out: OwnedUnit[] = [];

  for (const item of raw) {
    if (out.length >= maxUnits) break;
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const defId = typeof rec.defId === 'string' ? rec.defId : '';
    if (!SHINOBI_BY_ID[defId]) continue;

    const starsRaw = Number(rec.stars);
    const stars: StarLevel = starsRaw === 3 ? 3 : starsRaw === 2 ? 2 : 1;

    const hexRaw = rec.hex as Record<string, unknown> | null;
    if (!hexRaw || typeof hexRaw !== 'object') continue;
    const col = Math.floor(Number(hexRaw.col));
    const row = Math.floor(Number(hexRaw.row));
    if (
      !Number.isFinite(col) ||
      !Number.isFinite(row) ||
      col < 0 ||
      col >= BOARD_COLS ||
      row < PLAYER_START_ROW ||
      row >= BOARD_ROWS
    ) {
      continue;
    }

    const hexKey = `${col},${row}`;
    if (usedHexes.has(hexKey)) continue;
    usedHexes.add(hexKey);

    const items: ItemId[] = [];
    if (Array.isArray(rec.items)) {
      for (const it of rec.items) {
        if (typeof it === 'string' && it in ITEMS) {
          items.push(it as ItemId);
        }
        if (items.length >= 3) break;
      }
    }

    out.push({
      uid: typeof rec.uid === 'string' ? rec.uid.slice(0, 36) : `u_${out.length}`,
      defId,
      stars,
      location: 'board',
      benchIndex: null,
      hex: { col, row },
      items,
    });
  }

  return out;
}

function generateBotBoard(bot: ServerPlayer, round: number): OwnedUnit[] {
  const targetCount = Math.min(MAX_LEVEL, Math.max(2, Math.min(round + 2, 7)));
  bot.level = Math.min(MAX_LEVEL, Math.max(3, Math.min(round + 2, 8)));

  const maxCost = round <= 2 ? 2 : round <= 4 ? 3 : round <= 6 ? 4 : 5;
  const pool = SHINOBI_ROSTER.filter((s) => s.cost <= maxCost);
  const usedHexes = new Set<string>();
  const units: OwnedUnit[] = [];

  for (let i = 0; i < targetCount; i++) {
    const def = pool[Math.floor(Math.random() * pool.length)] ?? SHINOBI_ROSTER[0];
    const rowOrder = def.range <= 1 ? [3, 4, 5] : [5, 4, 3];
    const colOrder = [3, 2, 4, 1, 5, 0, 6];
    let hex: { col: number; row: number } | null = null;
    for (const r of rowOrder) {
      for (const c of colOrder) {
        const key = `${c},${r}`;
        if (!usedHexes.has(key)) {
          usedHexes.add(key);
          hex = { col: c, row: r };
          break;
        }
      }
      if (hex) break;
    }
    if (!hex) break;

    const twoStarChance = Math.min(0.65, Math.max(0, (round - 2) * 0.14));
    const stars: StarLevel = Math.random() < twoStarChance ? 2 : 1;
    const items: ItemId[] = [];
    if (round >= 3 && i === 0) {
      const itemKeys = Object.keys(ITEMS) as ItemId[];
      items.push(itemKeys[Math.floor(Math.random() * itemKeys.length)]);
    }

    units.push({
      uid: `${bot.id}_r${round}_${i}`,
      defId: def.id,
      stars,
      location: 'board',
      benchIndex: null,
      hex,
      items,
    });
  }

  return units;
}

function serializeRoom(room: ServerRoom): OnlineRoomState {
  const players: OnlinePlayerSummary[] = [...room.players.values()]
    .map((p) => ({
      id: p.id,
      nickname: p.nickname,
      avatarId: p.avatarId,
      arenaId: p.arenaId,
      isBot: p.isBot,
      isHost: p.isHost,
      connected: p.connected,
      hp: p.hp,
      level: p.level,
      gold: p.gold,
      streak: p.streak,
      wins: p.wins,
      losses: p.losses,
      ready: p.ready,
      eliminated: p.eliminated,
      placement: p.placement,
      augments: [...p.augments],
      boardUnits: p.boardUnits,
      currentOpponentId: p.currentOpponentId,
    }))
    .sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (a.hp !== b.hp) return b.hp - a.hp;
      return b.wins - a.wins;
    });

  return {
    code: room.code,
    status: room.status,
    round: room.round,
    prepSecondsLeft: room.prepSecondsLeft,
    fillBots: room.fillBots,
    hostId: room.hostId,
    players,
  };
}

function sendMsg(ws: WebSocket | null, msg: ServerWsMessage): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function broadcastRoomState(room: ServerRoom): void {
  const serialized = serializeRoom(room);
  for (const player of room.players.values()) {
    if (!player.isBot && player.ws) {
      sendMsg(player.ws, { type: 'room:state', room: serialized, youId: player.id });
    }
  }
}

function clearRoomTimers(room: ServerRoom): void {
  if (room.prepTimer) {
    clearInterval(room.prepTimer);
    room.prepTimer = null;
  }
  if (room.combatTimeout) {
    clearTimeout(room.combatTimeout);
    room.combatTimeout = null;
  }
  if (room.resolutionTimeout) {
    clearTimeout(room.resolutionTimeout);
    room.resolutionTimeout = null;
  }
}

function cleanupRoomIfEmpty(room: ServerRoom): void {
  const connectedHumans = [...room.players.values()].filter((p) => !p.isBot && p.connected);
  if (connectedHumans.length === 0) {
    clearRoomTimers(room);
    rooms.delete(room.code);
  }
}

function syncRoomBots(room: ServerRoom): void {
  if (room.status !== 'lobby') return;
  // Remove existing bots first
  for (const [id, p] of room.players.entries()) {
    if (p.isBot) room.players.delete(id);
  }
  if (!room.fillBots) return;

  const humanCount = room.players.size;
  const targetTotal = Math.max(4, humanCount);
  const botsNeeded = Math.max(0, Math.min(MAX_ROOM_PLAYERS - humanCount, targetTotal - humanCount));
  for (let i = 0; i < botsNeeded; i++) {
    const prof = BOT_PROFILES[i % BOT_PROFILES.length];
    const botId = `bot_${room.code}_${i + 1}`;
    room.players.set(botId, {
      id: botId,
      ws: null,
      nickname: prof.nickname,
      avatarId: prof.avatarId,
      arenaId: prof.arenaId,
      isBot: true,
      isHost: false,
      connected: true,
      hp: 100,
      level: 3,
      gold: 10,
      streak: 0,
      wins: 0,
      losses: 0,
      ready: true,
      combatDone: true,
      eliminated: false,
      placement: null,
      augments: [],
      boardUnits: createStarterBoard(botId),
      currentOpponentId: null,
      lastEmoteAt: 0,
    });
  }
}

function startPrepPhase(room: ServerRoom): void {
  clearRoomTimers(room);
  room.status = 'prep';
  room.prepSecondsLeft = PREP_SECONDS;
  room.pendingOutcomes.clear();

  for (const p of room.players.values()) {
    p.ready = p.isBot || p.eliminated || !p.connected;
    p.combatDone = p.isBot || p.eliminated || !p.connected;
    p.currentOpponentId = null;
    if (p.isBot && !p.eliminated) {
      p.boardUnits = generateBotBoard(p, room.round);
    }
  }

  broadcastRoomState(room);

  room.prepTimer = setInterval(() => {
    room.prepSecondsLeft = Math.max(0, room.prepSecondsLeft - 1);
    for (const p of room.players.values()) {
      if (!p.isBot && p.ws) {
        sendMsg(p.ws, { type: 'room:tick', prepSecondsLeft: room.prepSecondsLeft });
      }
    }
    if (room.prepSecondsLeft <= 0) {
      if (room.prepTimer) {
        clearInterval(room.prepTimer);
        room.prepTimer = null;
      }
      startCombatPhase(room);
    }
  }, 1000);
}

function maybeFastForwardPrep(room: ServerRoom): void {
  if (room.status !== 'prep') return;
  const activeHumans = [...room.players.values()].filter(
    (p) => !p.isBot && !p.eliminated && p.connected,
  );
  if (activeHumans.length > 0 && activeHumans.every((p) => p.ready)) {
    if (room.prepSecondsLeft > 2) {
      room.prepSecondsLeft = 2;
      for (const p of room.players.values()) {
        if (!p.isBot && p.ws) {
          sendMsg(p.ws, { type: 'room:tick', prepSecondsLeft: 2 });
        }
      }
    }
  }
}

function startCombatPhase(room: ServerRoom): void {
  clearRoomTimers(room);
  room.status = 'combat';
  room.pendingOutcomes.clear();

  const alive = [...room.players.values()].filter((p) => !p.eliminated);
  if (alive.length <= 1) {
    room.status = 'finished';
    broadcastRoomState(room);
    return;
  }

  // Shuffle living players, prioritizing real human vs human matchups when possible
  const humans = alive.filter((p) => !p.isBot).sort(() => Math.random() - 0.5);
  const bots = alive.filter((p) => p.isBot).sort(() => Math.random() - 0.5);
  const ordered = [...humans, ...bots];

  const matchups = new Map<string, OnlineMatchupPayload>();

  for (let i = 0; i < ordered.length; i += 2) {
    const a = ordered[i];
    const b = ordered[i + 1];

    if (b) {
      const seed = Math.floor(Math.random() * 0x7fffffff);
      const aBoard = a.boardUnits.length > 0 ? a.boardUnits : createStarterBoard(a.id);
      const bBoard = b.boardUnits.length > 0 ? b.boardUnits : createStarterBoard(b.id);
      const bMirrored = mirrorBoardForEnemy(bBoard);
      const aMirrored = mirrorBoardForEnemy(aBoard);

      // TFT-style home/away arena ownership: alternate which player's chosen arena hosts the battle!
      const hostPlayer = (room.round + i) % 2 === 0 ? a : b;
      const battleArena: ArenaMapId = hostPlayer.arenaId;
      const arenaOwnerName = hostPlayer.nickname;

      // Authoritative deterministic combat simulation on server
      const sim = simulateHeadlessCombat(aBoard, bMirrored, {
        seed,
        playerAugments: a.augments,
        enemyAugments: b.augments,
      });

      const aWon = sim.winner === 'player';
      const dmgToA = aWon ? 0 : calculatePlayerDamage(room.round, Math.max(1, sim.survivingEnemies));
      const dmgToB = aWon ? calculatePlayerDamage(room.round, Math.max(1, sim.survivingPlayers)) : 0;

      a.currentOpponentId = b.id;
      b.currentOpponentId = a.id;

      room.pendingOutcomes.set(a.id, {
        opponentId: b.id,
        opponentName: b.nickname,
        won: aWon,
        damageTaken: dmgToA,
      });
      room.pendingOutcomes.set(b.id, {
        opponentId: a.id,
        opponentName: a.nickname,
        won: !aWon,
        damageTaken: dmgToB,
      });

      matchups.set(a.id, {
        round: room.round,
        seed,
        arena: battleArena,
        arenaOwnerName,
        opponentId: b.id,
        opponentName: b.nickname,
        opponentAvatar: b.avatarId,
        opponentAugments: [...b.augments],
        enemyUnits: bMirrored,
        isGhost: false,
      });
      matchups.set(b.id, {
        round: room.round,
        seed,
        arena: battleArena,
        arenaOwnerName,
        opponentId: a.id,
        opponentName: a.nickname,
        opponentAvatar: a.avatarId,
        opponentAugments: [...a.augments],
        enemyUnits: aMirrored,
        isGhost: false,
      });
    } else {
      // Odd player count: fight a ghost snapshot on the ghost player's arena
      const ghostSource = ordered[0] !== a ? ordered[0] : a;
      const seed = Math.floor(Math.random() * 0x7fffffff);
      const aBoard = a.boardUnits.length > 0 ? a.boardUnits : createStarterBoard(a.id);
      const ghostBoard =
        ghostSource.boardUnits.length > 0 ? ghostSource.boardUnits : createStarterBoard(ghostSource.id);
      const ghostMirrored = mirrorBoardForEnemy(ghostBoard);

      const sim = simulateHeadlessCombat(aBoard, ghostMirrored, {
        seed,
        playerAugments: a.augments,
        enemyAugments: ghostSource.augments,
      });
      const aWon = sim.winner === 'player';
      const dmgToA = aWon ? 0 : calculatePlayerDamage(room.round, Math.max(1, sim.survivingEnemies));

      a.currentOpponentId = ghostSource.id;
      room.pendingOutcomes.set(a.id, {
        opponentId: ghostSource.id,
        opponentName: `${ghostSource.nickname} (Gölge)`,
        won: aWon,
        damageTaken: dmgToA,
      });
      matchups.set(a.id, {
        round: room.round,
        seed,
        arena: ghostSource.arenaId,
        arenaOwnerName: ghostSource.nickname,
        opponentId: ghostSource.id,
        opponentName: `${ghostSource.nickname} (Gölge)`,
        opponentAvatar: ghostSource.avatarId,
        opponentAugments: [...ghostSource.augments],
        enemyUnits: ghostMirrored,
        isGhost: true,
      });
    }
  }

  for (const p of room.players.values()) {
    p.combatDone = p.isBot || p.eliminated || !p.connected;
  }

  broadcastRoomState(room);

  for (const [pid, payload] of matchups.entries()) {
    const p = room.players.get(pid);
    if (p && !p.isBot && p.ws) {
      sendMsg(p.ws, { type: 'match:start_combat', matchup: payload });
    }
  }

  // Safety timeout in case a tab freezes or lags
  room.combatTimeout = setTimeout(() => {
    resolveRound(room);
  }, COMBAT_SAFETY_TIMEOUT_MS);
}

function checkAllCombatsFinished(room: ServerRoom): void {
  if (room.status !== 'combat') return;
  const waitingHumans = [...room.players.values()].filter(
    (p) => !p.isBot && !p.eliminated && p.connected && !p.combatDone,
  );
  if (waitingHumans.length === 0) {
    resolveRound(room);
  }
}

function resolveRound(room: ServerRoom): void {
  if (room.status !== 'combat') return;
  clearRoomTimers(room);
  room.status = 'resolution';

  const aliveBefore = [...room.players.values()].filter((p) => !p.eliminated).length;
  const newlyEliminated: ServerPlayer[] = [];

  for (const player of room.players.values()) {
    if (player.eliminated) continue;
    const outcome = room.pendingOutcomes.get(player.id);
    if (!outcome) continue;

    if (outcome.won) {
      player.wins += 1;
      player.streak = player.streak >= 0 ? player.streak + 1 : 1;
    } else {
      player.losses += 1;
      player.streak = player.streak <= 0 ? player.streak - 1 : -1;
      player.hp = Math.max(0, player.hp - outcome.damageTaken);
      if (player.hp <= 0) {
        player.eliminated = true;
        newlyEliminated.push(player);
      }
    }
  }

  // Assign placements to newly eliminated players (higher damage taken = lower rank)
  if (newlyEliminated.length > 0) {
    newlyEliminated.sort((a, b) => {
      const da = room.pendingOutcomes.get(a.id)?.damageTaken ?? 0;
      const db = room.pendingOutcomes.get(b.id)?.damageTaken ?? 0;
      return db - da;
    });
    let nextPlace = aliveBefore;
    for (const elim of newlyEliminated) {
      elim.placement = nextPlace--;
    }
  }

  const survivors = [...room.players.values()].filter((p) => !p.eliminated);
  const matchFinished = survivors.length <= 1;
  let winnerName: string | null = null;
  if (matchFinished) {
    room.status = 'finished';
    if (survivors.length === 1) {
      survivors[0].placement = 1;
      winnerName = survivors[0].nickname;
    } else {
      // Simultaneous KO tie-breaker: highest wins
      const best = [...room.players.values()].sort((a, b) => b.wins - a.wins)[0];
      if (best) {
        best.placement = 1;
        winnerName = best.nickname;
      }
    }
  }

  const serializedRoom = serializeRoom(room);

  for (const player of room.players.values()) {
    if (player.isBot || !player.ws) continue;
    const outcome = room.pendingOutcomes.get(player.id);
    const result: OnlineRoundResultPayload = {
      round: room.round,
      won: outcome?.won ?? true,
      damageTaken: outcome?.damageTaken ?? 0,
      newHp: player.hp,
      opponentName: outcome?.opponentName ?? 'Rakip',
      eliminated: player.eliminated,
      placement: player.placement,
      matchFinished,
      winnerName,
    };
    sendMsg(player.ws, { type: 'match:round_resolved', result, room: serializedRoom });
  }

  if (!matchFinished) {
    room.resolutionTimeout = setTimeout(() => {
      room.round += 1;
      startPrepPhase(room);
    }, 2200);
  }
}

function handleLeaveRoom(ws: WebSocket): void {
  const meta = socketToPlayer.get(ws);
  if (!meta || !meta.roomCode) return;
  const room = rooms.get(meta.roomCode);
  meta.roomCode = null;
  if (!room) return;

  const player = room.players.get(meta.playerId);
  if (!player) return;

  if (room.status === 'lobby') {
    room.players.delete(player.id);
    if (room.hostId === player.id) {
      const nextHost = [...room.players.values()].find((p) => !p.isBot && p.connected);
      if (nextHost) {
        nextHost.isHost = true;
        room.hostId = nextHost.id;
      }
    }
    syncRoomBots(room);
    broadcastRoomState(room);
    cleanupRoomIfEmpty(room);
  } else {
    player.connected = false;
    player.ws = null;
    player.ready = true;
    player.combatDone = true;
    broadcastRoomState(room);
    maybeFastForwardPrep(room);
    checkAllCombatsFinished(room);
    cleanupRoomIfEmpty(room);
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = sanitizeRoomCode(req.params.code);
    if (!code) {
      res.status(400).json({ error: 'Geçersiz oda kodu.' });
      return;
    }
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ exists: false });
      return;
    }
    res.json({
      exists: true,
      code: room.code,
      status: room.status,
      playerCount: [...room.players.values()].filter((p) => !p.isBot).length,
      maxPlayers: MAX_ROOM_PLAYERS,
    });
  });

  let viteServer: { close: () => Promise<void> } | null = null;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    viteServer = vite;
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 16 * 1024,
  });

  wss.on('error', (err) => {
    console.error('WebSocketServer error:', err);
  });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const room of rooms.values()) {
      clearRoomTimers(room);
    }
    rooms.clear();
    wss.close();
    if (viteServer) {
      await viteServer.close().catch(() => {});
    }
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1500).unref();
  };

  process.once('SIGTERM', () => {
    void shutdown();
  });
  process.once('SIGINT', () => {
    void shutdown();
  });

  wss.on('connection', (ws) => {
    const playerId = `p_${Date.now().toString(36)}_${playerSeq++}`;
    socketToPlayer.set(ws, { playerId, roomCode: null });
    sendMsg(ws, { type: 'connected', playerId });

    ws.on('message', (rawBuf) => {
      let msg: ClientWsMessage;
      try {
        msg = JSON.parse(rawBuf.toString()) as ClientWsMessage;
      } catch {
        sendMsg(ws, { type: 'error', message: 'Geçersiz mesaj formatı.' });
        return;
      }
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

      const meta = socketToPlayer.get(ws);
      if (!meta) return;

      switch (msg.type) {
        case 'room:create': {
          handleLeaveRoom(ws);
          const code = generateRoomCode();
          const nickname = sanitizeNickname(msg.nickname);
          const avatarId = sanitizeAvatarId(msg.avatarId);
          const arenaId = sanitizeArenaId(msg.arenaId);
          const fillBots = Boolean(msg.fillBots);

          const hostPlayer: ServerPlayer = {
            id: meta.playerId,
            ws,
            nickname,
            avatarId,
            arenaId,
            isBot: false,
            isHost: true,
            connected: true,
            hp: 100,
            level: 3,
            gold: 10,
            streak: 0,
            wins: 0,
            losses: 0,
            ready: false,
            combatDone: false,
            eliminated: false,
            placement: null,
            augments: [],
            boardUnits: createStarterBoard(meta.playerId),
            currentOpponentId: null,
            lastEmoteAt: 0,
          };

          const room: ServerRoom = {
            code,
            status: 'lobby',
            round: 1,
            prepSecondsLeft: PREP_SECONDS,
            fillBots,
            hostId: hostPlayer.id,
            players: new Map([[hostPlayer.id, hostPlayer]]),
            prepTimer: null,
            combatTimeout: null,
            resolutionTimeout: null,
            pendingOutcomes: new Map(),
          };

          rooms.set(code, room);
          meta.roomCode = code;
          syncRoomBots(room);
          broadcastRoomState(room);
          break;
        }

        case 'room:join': {
          const code = sanitizeRoomCode(msg.code);
          if (!code) {
            sendMsg(ws, { type: 'error', message: 'Oda kodu 6 harf/rakam olmalıdır.' });
            return;
          }
          const room = rooms.get(code);
          if (!room) {
            sendMsg(ws, { type: 'error', message: `"${code}" kodlu oda bulunamadı.` });
            return;
          }
          if (room.status !== 'lobby') {
            sendMsg(ws, { type: 'error', message: 'Bu odada maç çoktan başladı.' });
            return;
          }
          const humanCount = [...room.players.values()].filter((p) => !p.isBot).length;
          if (humanCount >= MAX_ROOM_PLAYERS) {
            sendMsg(ws, { type: 'error', message: 'Oda dolu (en fazla 8 oyuncu).' });
            return;
          }

          handleLeaveRoom(ws);
          const nickname = sanitizeNickname(msg.nickname);
          const avatarId = sanitizeAvatarId(msg.avatarId);
          const arenaId = sanitizeArenaId(msg.arenaId);

          const joiner: ServerPlayer = {
            id: meta.playerId,
            ws,
            nickname,
            avatarId,
            arenaId,
            isBot: false,
            isHost: false,
            connected: true,
            hp: 100,
            level: 3,
            gold: 10,
            streak: 0,
            wins: 0,
            losses: 0,
            ready: false,
            combatDone: false,
            eliminated: false,
            placement: null,
            augments: [],
            boardUnits: createStarterBoard(meta.playerId),
            currentOpponentId: null,
            lastEmoteAt: 0,
          };

          room.players.set(joiner.id, joiner);
          meta.roomCode = code;
          syncRoomBots(room);
          broadcastRoomState(room);
          break;
        }

        case 'room:set_arena': {
          if (!meta.roomCode) return;
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          const player = room.players.get(meta.playerId);
          if (!player) return;
          player.arenaId = sanitizeArenaId(msg.arenaId);
          broadcastRoomState(room);
          break;
        }

        case 'room:leave': {
          handleLeaveRoom(ws);
          break;
        }

        case 'room:toggle_bots': {
          if (!meta.roomCode) return;
          const room = rooms.get(meta.roomCode);
          if (!room || room.status !== 'lobby' || room.hostId !== meta.playerId) return;
          room.fillBots = Boolean(msg.fillBots);
          syncRoomBots(room);
          broadcastRoomState(room);
          break;
        }

        case 'room:start': {
          if (!meta.roomCode) return;
          const room = rooms.get(meta.roomCode);
          if (!room || room.status !== 'lobby' || room.hostId !== meta.playerId) return;
          if (room.players.size < 2) {
            sendMsg(ws, {
              type: 'error',
              message: 'Maçı başlatmak için en az 2 oyuncu veya AI Bot açık olmalı!',
            });
            return;
          }
          room.round = 1;
          startPrepPhase(room);
          break;
        }

        case 'player:sync_board': {
          if (!meta.roomCode) return;
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          const player = room.players.get(meta.playerId);
          if (!player || player.eliminated) return;

          const clampedLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(msg.level) || 3)));
          const clampedGold = Math.max(0, Math.min(999, Math.floor(Number(msg.gold) || 0)));
          const validAugments = sanitizeAugments(msg.augments);
          const maxCap = getMaxBoardUnits(clampedLevel, validAugments);
          const validUnits = sanitizeBoardUnits(msg.boardUnits, maxCap);

          player.level = clampedLevel;
          player.gold = clampedGold;
          player.augments = validAugments;
          player.boardUnits = validUnits;

          broadcastRoomState(room);
          break;
        }

        case 'player:ready': {
          if (!meta.roomCode) return;
          const room = rooms.get(meta.roomCode);
          if (!room || room.status !== 'prep') return;
          const player = room.players.get(meta.playerId);
          if (!player || player.eliminated) return;

          player.ready = Boolean(msg.ready);
          broadcastRoomState(room);
          maybeFastForwardPrep(room);
          break;
        }

        case 'player:combat_done': {
          if (!meta.roomCode) return;
          const room = rooms.get(meta.roomCode);
          if (!room || room.status !== 'combat') return;
          if (msg.round !== room.round) return;
          const player = room.players.get(meta.playerId);
          if (!player) return;

          player.combatDone = true;
          checkAllCombatsFinished(room);
          break;
        }

        case 'player:emote': {
          if (!meta.roomCode) return;
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          const player = room.players.get(meta.playerId);
          if (!player) return;
          if (typeof msg.emoteId !== 'string' || !VALID_EMOTE_IDS.has(msg.emoteId)) return;

          const now = Date.now();
          if (now - player.lastEmoteAt < 800) return;
          player.lastEmoteAt = now;

          for (const target of room.players.values()) {
            if (!target.isBot && target.ws) {
              sendMsg(target.ws, {
                type: 'room:emote',
                fromPlayerId: player.id,
                fromName: player.nickname,
                emoteId: msg.emoteId as EmoteId,
              });
            }
          }
          break;
        }
      }
    });

    ws.on('close', () => {
      handleLeaveRoom(ws);
      socketToPlayer.delete(ws);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Shinobi Tactics server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
