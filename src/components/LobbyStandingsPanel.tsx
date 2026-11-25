import React, { useState } from 'react';
import { ARENA_MAPS } from '../game/data';
import {
  EMOTES,
  EmoteId,
  IncomingEmote,
  OnlinePlayerSummary,
  OnlineRoomState,
} from '../game/multiplayerTypes';
import { getPortraitDataUrl } from '../game/pixelSprites';

interface LobbyStandingsPanelProps {
  room: OnlineRoomState;
  playerId: string | null;
  scoutedPlayerId: string | null;
  canScout: boolean;
  recentEmotes: IncomingEmote[];
  onScoutPlayer: (player: OnlinePlayerSummary | null) => void;
  onSendEmote: (emoteId: EmoteId) => void;
}

export const LobbyStandingsPanel: React.FC<LobbyStandingsPanelProps> = ({
  room,
  playerId,
  scoutedPlayerId,
  canScout,
  recentEmotes,
  onScoutPlayer,
  onSendEmote,
}) => {
  const [emoteOpen, setEmoteOpen] = useState(false);
  const me = room.players.find((p) => p.id === playerId) ?? null;

  return (
    <div className="fixed right-2.5 top-14 z-20 w-[162px] flex flex-col gap-1.5 pointer-events-none select-none">
      {/* Compact Forged Right-Edge TFT Player Health Banners */}
      <div className="flex flex-col gap-1 pointer-events-auto">
        {room.players.map((p, idx) => {
          const isMe = p.id === playerId;
          const isCurrentOpponent = me?.currentOpponentId === p.id;
          const isScouted = scoutedPlayerId === p.id;
          const hpPct = Math.max(0, Math.min(100, p.hp));
          const arenaName = ARENA_MAPS[p.arenaId]?.name ?? 'Kızıl Ay';

          return (
            <button
              key={p.id}
              type="button"
              disabled={isMe || !canScout || p.eliminated}
              onClick={() => onScoutPlayer(isScouted ? null : p)}
              title={
                isMe
                  ? `Senin Kage profilin · ${arenaName}`
                  : canScout && !p.eliminated
                    ? `${p.nickname} (${arenaName}) arenasına göz at`
                    : `${p.nickname} · ${arenaName}`
              }
              className={`w-full text-left px-2 py-1.5 border transition-colors ${
                p.eliminated
                  ? 'opacity-40 bg-[#090b10]/85 border-[#252834] cursor-default'
                  : isScouted
                    ? 'bg-[#0e2032]/96 border-[#38bdf8] cursor-pointer shadow-[0_0_12px_rgba(56,189,248,0.28)]'
                    : isCurrentOpponent
                      ? 'bg-[#2a0e12]/96 border-[#dc2626] cursor-pointer'
                      : isMe
                        ? 'bg-[#181a22]/96 border-[#b48436] cursor-default'
                        : canScout
                          ? 'bg-[#0b0e15]/92 hover:bg-[#171c29]/96 border-[#3c3428] cursor-pointer'
                          : 'bg-[#0b0e15]/92 border-[#3c3428] cursor-default'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="relative shrink-0">
                  <img
                    src={getPortraitDataUrl(p.avatarId)}
                    alt={p.nickname}
                    className="w-7 h-7 object-cover pixelated border border-[#5a4a33]"
                  />
                  <span className="absolute -top-1 -left-1 w-3.5 h-3.5 bg-[#08090d] border border-[#b48436] text-[8px] font-mono-num font-bold text-[#f8d77a] flex items-center justify-center">
                    {p.placement ?? idx + 1}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 leading-tight">
                    <span className="text-[11px] font-display font-bold text-[#f4e8ce] truncate">
                      {p.nickname}
                    </span>
                    {isCurrentOpponent ? (
                      <span className="text-[8px] font-mono-num font-bold px-1 bg-[#b91c1c] text-white shrink-0">
                        VS
                      </span>
                    ) : p.ready && room.status === 'prep' && !p.eliminated ? (
                      <span className="text-[9px] font-bold text-[#4ade80] shrink-0">✓</span>
                    ) : null}
                  </div>

                  {/* HP bar */}
                  <div className="mt-1 flex items-center gap-1">
                    <div className="flex-1 h-1.5 bg-[#07090d] border border-[#2d323e] overflow-hidden">
                      <div
                        className={`h-full ${
                          p.hp > 50 ? 'bg-[#22c55e]' : p.hp > 25 ? 'bg-[#f59e0b]' : 'bg-[#dc2626]'
                        }`}
                        style={{ width: `${hpPct}%` }}
                      />
                    </div>
                    <span className="font-mono-num text-[10px] font-bold text-[#e2d4b8] w-5 text-right">
                      {p.hp}
                    </span>
                  </div>
                </div>
              </div>
              {!isMe && !p.eliminated && canScout && (
                <div className="mt-1 flex items-center justify-between text-[9px] text-[#9b8d75]">
                  <span className="truncate max-w-[92px]">{arenaName}</span>
                  <span className={isScouted ? 'text-[#7dd3fc] font-semibold' : 'text-[#d9c9aa]'}>
                    {isScouted ? 'Gözetle ✓' : 'Gözetle'}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Live Incoming Emote Feed */}
      {recentEmotes.length > 0 && (
        <div className="pointer-events-auto flex flex-col gap-1">
          {recentEmotes.slice(-2).map((em) => {
            const def = EMOTES.find((e) => e.id === em.emoteId);
            return (
              <div
                key={em.id}
                className="game-plaque flex items-center justify-between gap-1 px-2 py-1 text-[10px]"
              >
                <span className="text-[#c6b79c] truncate">{em.fromName}</span>
                <span
                  className="font-display font-bold shrink-0"
                  style={{ color: def?.color ?? '#f8d77a' }}
                >
                  {def?.shortText ?? em.emoteId}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Collapsible Compact Emote Trigger */}
      <div className="relative pointer-events-auto">
        <button
          type="button"
          onClick={() => setEmoteOpen((o) => !o)}
          className="game-bevel-btn w-full cursor-pointer py-1 px-2.5 flex items-center justify-between text-[10px] font-display font-bold uppercase tracking-wider text-[#d9c9aa]"
        >
          <span>Tepki Gönder</span>
          <span>{emoteOpen ? '▴' : '▾'}</span>
        </button>

        {emoteOpen && (
          <div className="mt-1 p-1.5 game-plaque grid grid-cols-3 gap-1">
            {EMOTES.map((em) => (
              <button
                key={em.id}
                type="button"
                onClick={() => {
                  onSendEmote(em.id);
                  setEmoteOpen(false);
                }}
                title={em.label}
                className="game-bevel-btn cursor-pointer py-1 font-display font-bold text-[10px]"
                style={{ color: em.color }}
              >
                {em.shortText}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
