import React, { useMemo, useState } from 'react';
import { ARENA_MAP_LIST, ARENA_MAPS } from '../game/data';
import { OnlineRoomState } from '../game/multiplayerTypes';
import { getPortraitDataUrl } from '../game/pixelSprites';
import { ArenaMapId } from '../game/types';

const AVATAR_IDS = ['nartuto', 'sazuke', 'hinaata', 'kakaashi', 'itachii', 'minaato'];

interface OnlineLobbyModalProps {
  spriteRev: number;
  room: OnlineRoomState | null;
  playerId: string | null;
  error: string | null;
  initialRoomCode?: string;
  selectedArenaId: ArenaMapId;
  onSelectArena: (arenaId: ArenaMapId) => void;
  onSetRoomArena: (arenaId: ArenaMapId) => void;
  onCreateRoom: (nickname: string, avatarId: string, arenaId: ArenaMapId, fillBots: boolean) => void;
  onJoinRoom: (code: string, nickname: string, avatarId: string, arenaId: ArenaMapId) => void;
  onToggleBots: (fillBots: boolean) => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
  onClose: () => void;
}

export const OnlineLobbyModal: React.FC<OnlineLobbyModalProps> = ({
  spriteRev,
  room,
  playerId,
  error,
  initialRoomCode = '',
  selectedArenaId,
  onSelectArena,
  onSetRoomArena,
  onCreateRoom,
  onJoinRoom,
  onToggleBots,
  onStartMatch,
  onLeaveRoom,
  onClose,
}) => {
  const [tab, setTab] = useState<'create' | 'join'>(initialRoomCode ? 'join' : 'create');
  const [nickname, setNickname] = useState(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('shinobi_nick') : null;
    return saved || 'KageAdayı';
  });
  const [avatarId, setAvatarId] = useState('nartuto');
  const [joinCode, setJoinCode] = useState(initialRoomCode.toUpperCase());
  const [fillBots, setFillBots] = useState(true);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const avatars = useMemo(
    () => AVATAR_IDS.map((id) => ({ id, url: getPortraitDataUrl(id) })),
    [spriteRev],
  );

  const saveNick = (val: string) => {
    setNickname(val);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('shinobi_nick', val);
    }
  };

  const handleArenaPick = (id: ArenaMapId) => {
    onSelectArena(id);
    if (room) {
      onSetRoomArena(id);
    }
  };

  const handleCopy = (kind: 'code' | 'link') => {
    if (!room) return;
    const text =
      kind === 'code'
        ? room.code
        : `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    void navigator.clipboard?.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const isHost = Boolean(room && playerId && room.hostId === playerId);
  const humanCount = room ? room.players.filter((p) => !p.isBot).length : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#05060a]/88 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="online-lobby-title"
    >
      <div className="shinobi-panel rounded-2xl w-full max-w-xl p-5 border-[#b47b3b] shadow-[0_24px_60px_rgba(0,0,0,0.85)] max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="online-lobby-title"
              className="font-display font-bold text-2xl text-[#f8fafc] tracking-wide"
            >
              {room ? 'Shinobi Savaş Lobisi' : 'Online Oda Kur / Katıl'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {room
                ? 'Her Kage kendi savaş haritasını seçer — maçlarda ev sahibinin arenası açılır!'
                : 'Arkadaşlarınla gerçek zamanlı PvP TFT savaşına katıl.'}
            </p>
          </div>
          <button
            type="button"
            onClick={room ? onLeaveRoom : onClose}
            aria-label="Kapat"
            className="cursor-pointer w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 flex items-center justify-center text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-3 px-3.5 py-2 rounded-xl bg-[#450a0a] border border-[#ef4444]/80 text-xs text-[#fecaca] font-medium"
          >
            {error}
          </div>
        )}

        {!room ? (
          <div className="mt-4 space-y-4">
            {/* Nickname & Avatar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="shinobi-nickname"
                  className="block text-[11px] font-display font-bold uppercase tracking-wider text-slate-300 mb-1.5"
                >
                  Kage Adın
                </label>
                <input
                  id="shinobi-nickname"
                  type="text"
                  maxLength={16}
                  value={nickname}
                  onChange={(e) => saveNick(e.target.value)}
                  placeholder="Kage adını yaz..."
                  className="w-full h-10 px-3 rounded-xl bg-[#0a0c12] border border-slate-700 focus:border-[#eab308] focus:outline-none text-sm text-slate-100 font-medium"
                />
              </div>
              <div>
                <span className="block text-[11px] font-display font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Taktisyen Avatarın
                </span>
                <div className="flex items-center gap-1.5">
                  {avatars.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAvatarId(a.id)}
                      aria-label={`Avatar ${a.id}`}
                      className={`cursor-pointer w-10 h-10 rounded-xl overflow-hidden border-2 transition-transform ${
                        avatarId === a.id
                          ? 'border-[#eab308] scale-105'
                          : 'border-slate-700 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img src={a.url} alt={a.id} className="w-full h-full object-cover pixelated" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Personal Home Arena Picker */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-display font-bold uppercase tracking-wider text-[#e2c799]">
                  Kendi Savaş Haritan (Ev Sahibi Arenan)
                </span>
                <span className="text-[10px] text-slate-400">
                  {ARENA_MAPS[selectedArenaId]?.name}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {ARENA_MAP_LIST.map((arena) => {
                  const active = arena.id === selectedArenaId;
                  return (
                    <button
                      key={arena.id}
                      type="button"
                      onClick={() => handleArenaPick(arena.id)}
                      className={`cursor-pointer rounded-xl overflow-hidden border-2 text-left transition-all ${
                        active
                          ? 'border-[#eab308] shadow-[0_0_12px_rgba(234,179,8,0.35)]'
                          : 'border-slate-700 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <div className="aspect-video w-full bg-[#090b10]">
                        <img
                          src={arena.imageUrl}
                          alt={arena.name}
                          className="w-full h-full object-cover pixelated"
                        />
                      </div>
                      <div className="px-1.5 py-1 bg-[#0b0d14] text-[10px] font-display font-bold text-slate-200 truncate">
                        {arena.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Create / Join Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#0a0c12] border border-slate-700/70">
              <button
                type="button"
                onClick={() => setTab('create')}
                className={`cursor-pointer py-2 rounded-lg font-display font-bold text-sm transition-colors ${
                  tab === 'create'
                    ? 'bg-gradient-to-b from-[#b91c1c] to-[#7f1d1d] text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Yeni Oda Kur
              </button>
              <button
                type="button"
                onClick={() => setTab('join')}
                className={`cursor-pointer py-2 rounded-lg font-display font-bold text-sm transition-colors ${
                  tab === 'join'
                    ? 'bg-gradient-to-b from-[#0284c7] to-[#1d4ed8] text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Kodla Odaya Katıl
              </button>
            </div>

            {tab === 'create' ? (
              <div className="space-y-3">
                <label className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#0c0e16] border border-slate-700/70 cursor-pointer">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      Boş Koltukları AI Kage ile Doldur
                    </div>
                    <div className="text-[11px] text-slate-400">
                      4 kişilik tam savaş lobisi açar (her AI kendi özel haritasıyla gelir).
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={fillBots}
                    onChange={(e) => setFillBots(e.target.checked)}
                    className="w-4 h-4 accent-[#dc2626] cursor-pointer"
                  />
                </label>

                <button
                  type="button"
                  data-testid="create-room-submit"
                  onClick={() =>
                    onCreateRoom(nickname.trim() || 'Kage', avatarId, selectedArenaId, fillBots)
                  }
                  className="shinobi-btn cursor-pointer rounded-xl w-full py-3 bg-gradient-to-b from-[#b91c1c] to-[#7f1d1d] hover:from-[#dc2626] hover:to-[#991b1b] text-[#fffbeb] font-display font-bold text-base border-[#f87171]/70"
                >
                  Oda Oluştur
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="join-room-code"
                    className="block text-[11px] font-display font-bold uppercase tracking-wider text-slate-300 mb-1.5"
                  >
                    6 Haneli Oda Kodu
                  </label>
                  <input
                    id="join-room-code"
                    data-testid="join-room-input"
                    type="text"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="ÖRN: K7X9MP"
                    className="w-full h-12 px-4 rounded-xl bg-[#0a0c12] border-2 border-[#38bdf8]/60 focus:border-[#eab308] focus:outline-none text-center font-mono-num font-bold text-xl tracking-[0.28em] text-[#fde047] uppercase"
                  />
                </div>

                <button
                  type="button"
                  data-testid="join-room-submit"
                  disabled={joinCode.length !== 6}
                  onClick={() =>
                    onJoinRoom(joinCode, nickname.trim() || 'Kage', avatarId, selectedArenaId)
                  }
                  className="shinobi-btn cursor-pointer rounded-xl w-full py-3 bg-gradient-to-b from-[#0284c7] to-[#1d4ed8] hover:from-[#0ea5e9] hover:to-[#2563eb] disabled:opacity-45 disabled:cursor-not-allowed text-white font-display font-bold text-base border-[#7dd3fc]/70"
                >
                  Odaya Katıl
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Inside Active Room Lobby */
          <div className="mt-4 space-y-4">
            {/* Room Code + Copy Controls */}
            <div className="rounded-xl bg-[#0a0c12] border border-[#b47b3b]/80 p-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-display font-bold uppercase tracking-widest text-slate-400">
                  Oda Kodu
                </div>
                <div
                  data-testid="lobby-room-code"
                  className="font-mono-num font-bold text-2xl tracking-[0.22em] text-[#fde047]"
                >
                  {room.code}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy('code')}
                  className="cursor-pointer rounded-lg px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-slate-100"
                >
                  {copied === 'code' ? 'Kopyalandı!' : 'Kodu Kopyala'}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy('link')}
                  className="cursor-pointer rounded-lg px-3 py-1.5 bg-[#112840] hover:bg-[#193b5e] border border-[#38bdf8]/60 text-xs font-semibold text-[#e0f2fe]"
                >
                  {copied === 'link' ? 'Link Kopyalandı!' : 'Davet Linki'}
                </button>
              </div>
            </div>

            {/* Live Lobby Arena Switcher */}
            <div>
              <div className="text-[11px] font-display font-bold uppercase tracking-wider text-[#e2c799] mb-1.5">
                Arenanı Değiştir
              </div>
              <div className="grid grid-cols-4 gap-2">
                {ARENA_MAP_LIST.map((arena) => {
                  const active = arena.id === selectedArenaId;
                  return (
                    <button
                      key={arena.id}
                      type="button"
                      onClick={() => handleArenaPick(arena.id)}
                      className={`cursor-pointer rounded-lg overflow-hidden border-2 text-left transition-all ${
                        active
                          ? 'border-[#eab308]'
                          : 'border-slate-700 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <div className="aspect-video w-full bg-[#090b10]">
                        <img
                          src={arena.imageUrl}
                          alt={arena.name}
                          className="w-full h-full object-cover pixelated"
                        />
                      </div>
                      <div className="px-1.5 py-0.5 bg-[#0b0d14] text-[9px] font-display font-bold text-slate-200 truncate">
                        {arena.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Players List with their Chosen Arena Maps */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                <span className="font-display font-bold uppercase tracking-wider">
                  Katılımcılar ({room.players.length}/8 · {humanCount} Oyuncu)
                </span>
                {isHost && (
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#fde68a]">
                    <input
                      type="checkbox"
                      checked={room.fillBots}
                      onChange={(e) => onToggleBots(e.target.checked)}
                      className="accent-[#dc2626]"
                    />
                    <span>AI Bot Doldur</span>
                  </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-[190px] overflow-y-auto pr-1">
                {room.players.map((p) => {
                  const isYou = p.id === playerId;
                  const pArena = ARENA_MAPS[p.arenaId] ?? ARENA_MAPS.kanli_ay;
                  return (
                    <div
                      key={p.id}
                      data-testid={`lobby-player-${p.nickname}`}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl border ${
                        isYou
                          ? 'bg-[#1a1d2a] border-[#eab308]/80'
                          : 'bg-[#0c0e16] border-slate-700/70'
                      }`}
                    >
                      <img
                        src={getPortraitDataUrl(p.avatarId)}
                        alt={p.nickname}
                        className="w-9 h-9 rounded-lg object-cover pixelated border border-slate-600 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-display font-bold text-slate-100 truncate">
                          {p.nickname} {isYou ? '(Sen)' : ''}
                        </div>
                        <div className="text-[10px] text-[#e2c799] truncate">
                          {pArena.name}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {p.isHost ? 'Oda Kurucusu' : p.isBot ? 'AI Kage' : 'Hazır'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-1">
              {isHost ? (
                <button
                  type="button"
                  data-testid="lobby-start-match"
                  onClick={onStartMatch}
                  disabled={room.players.length < 2}
                  className="shinobi-btn cursor-pointer rounded-xl flex-1 py-3 bg-gradient-to-b from-[#b91c1c] to-[#7f1d1d] hover:from-[#dc2626] hover:to-[#991b1b] disabled:opacity-45 disabled:cursor-not-allowed text-[#fffbeb] font-display font-bold text-base border-[#f87171]/70"
                >
                  Savaşı Başlat ({room.players.length} Kage)
                </button>
              ) : (
                <div className="flex-1 py-3 px-4 rounded-xl bg-[#0c0e16] border border-slate-700 text-center text-xs font-semibold text-[#fde68a]">
                  Oda kurucusunun savaşı başlatması bekleniyor...
                </div>
              )}
              <button
                type="button"
                onClick={onLeaveRoom}
                className="cursor-pointer rounded-xl px-4 py-3 bg-[#241216] hover:bg-[#38181f] border border-red-900/80 text-xs font-semibold text-[#fca5a5]"
              >
                Ayrıl
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
