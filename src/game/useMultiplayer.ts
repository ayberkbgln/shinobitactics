import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ClientWsMessage,
  EmoteId,
  IncomingEmote,
  OnlineMatchupPayload,
  OnlineRoomState,
  OnlineRoundResultPayload,
  ServerWsMessage,
} from './multiplayerTypes';
import { ArenaMapId, AugmentId, OwnedUnit } from './types';

interface UseMultiplayerCallbacks {
  onStartCombat: (matchup: OnlineMatchupPayload) => void;
  onRoundResolved: (result: OnlineRoundResultPayload, room: OnlineRoomState) => void;
}

export function useMultiplayer(callbacks: UseMultiplayerCallbacks) {
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<OnlineRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentEmotes, setRecentEmotes] = useState<IncomingEmote[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const emoteSeqRef = useRef(1);
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const connect = useCallback((): Promise<WebSocket> => {
    const existing = wsRef.current;
    if (existing && existing.readyState === WebSocket.OPEN) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        resolve(ws);
      };

      ws.onerror = () => {
        setError('Sunucuya bağlanılamadı. Lütfen tekrar dene.');
        reject(new Error('WebSocket error'));
      };

      ws.onclose = () => {
        setConnected(false);
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        let msg: ServerWsMessage;
        try {
          msg = JSON.parse(String(event.data)) as ServerWsMessage;
        } catch {
          return;
        }

        switch (msg.type) {
          case 'connected':
            setPlayerId(msg.playerId);
            break;
          case 'error':
            setError(msg.message);
            break;
          case 'room:state':
            setError(null);
            setPlayerId(msg.youId);
            setRoom(msg.room);
            break;
          case 'room:tick':
            setRoom((prev) => (prev ? { ...prev, prepSecondsLeft: msg.prepSecondsLeft } : prev));
            break;
          case 'match:start_combat':
            cbRef.current.onStartCombat(msg.matchup);
            break;
          case 'match:round_resolved':
            setRoom(msg.room);
            cbRef.current.onRoundResolved(msg.result, msg.room);
            break;
          case 'room:emote': {
            const incoming: IncomingEmote = {
              id: emoteSeqRef.current++,
              fromPlayerId: msg.fromPlayerId,
              fromName: msg.fromName,
              emoteId: msg.emoteId,
              receivedAt: Date.now(),
            };
            setRecentEmotes((prev) => [...prev.slice(-4), incoming]);
            window.setTimeout(() => {
              setRecentEmotes((prev) => prev.filter((e) => e.id !== incoming.id));
            }, 3200);
            break;
          }
        }
      };
    });
  }, []);

  const send = useCallback(
    async (payload: ClientWsMessage) => {
      try {
        const ws = await connect();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
        }
      } catch {
        // Error state already surfaced via setError
      }
    },
    [connect],
  );

  const createRoom = useCallback(
    (nickname: string, avatarId: string, arenaId: ArenaMapId, fillBots: boolean) => {
      setError(null);
      void send({ type: 'room:create', nickname, avatarId, arenaId, fillBots });
    },
    [send],
  );

  const joinRoom = useCallback(
    (code: string, nickname: string, avatarId: string, arenaId: ArenaMapId) => {
      setError(null);
      void send({ type: 'room:join', code: code.trim().toUpperCase(), nickname, avatarId, arenaId });
    },
    [send],
  );

  const setArena = useCallback(
    (arenaId: ArenaMapId) => {
      void send({ type: 'room:set_arena', arenaId });
    },
    [send],
  );

  const leaveRoom = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'room:leave' } satisfies ClientWsMessage));
    }
    setRoom(null);
    setError(null);
  }, []);

  const toggleBots = useCallback(
    (fillBots: boolean) => {
      void send({ type: 'room:toggle_bots', fillBots });
    },
    [send],
  );

  const startMatch = useCallback(() => {
    setError(null);
    void send({ type: 'room:start' });
  }, [send]);

  const syncBoard = useCallback(
    (boardUnits: OwnedUnit[], level: number, gold: number, augments: AugmentId[]) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(
        JSON.stringify({
          type: 'player:sync_board',
          boardUnits,
          level,
          gold,
          augments,
        } satisfies ClientWsMessage),
      );
    },
    [],
  );

  const setReady = useCallback(
    (ready: boolean) => {
      void send({ type: 'player:ready', ready });
    },
    [send],
  );

  const reportCombatDone = useCallback(
    (round: number) => {
      void send({ type: 'player:combat_done', round });
    },
    [send],
  );

  const sendEmote = useCallback(
    (emoteId: EmoteId) => {
      void send({ type: 'player:emote', emoteId });
    },
    [send],
  );

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return {
    connected,
    playerId,
    room,
    error,
    clearError: () => setError(null),
    recentEmotes,
    createRoom,
    joinRoom,
    setArena,
    leaveRoom,
    toggleBots,
    startMatch,
    syncBoard,
    setReady,
    reportCombatDone,
    sendEmote,
  };
}
