import React, { useMemo } from 'react';
import { ARENA_MAP_LIST, ARENA_MAPS } from '../game/data';
import { getPortraitDataUrl } from '../game/pixelSprites';
import { ArenaMapId } from '../game/types';

const SHOWCASE_IDS = ['nartuto', 'sazuke', 'hinaata', 'kakaashi', 'itachii', 'madaara'];

const EMBERS = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  left: `${(i * 6.5 + 3) % 95}%`,
  top: `${(i * 13.7 + 15) % 85}%`,
  duration: `${5 + (i % 4) * 1.4}s`,
  delay: `${-(i * 0.6)}s`,
  size: i % 3 === 0 ? 5 : 4,
  crimson: i % 2 === 0,
}));

interface TitleScreenProps {
  spriteRev: number;
  selectedArenaId: ArenaMapId;
  onSelectArena: (arenaId: ArenaMapId) => void;
  onStart: () => void;
  onOpenOnline: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  spriteRev,
  selectedArenaId,
  onSelectArena,
  onStart,
  onOpenOnline,
}) => {
  const portraits = useMemo(
    () => SHOWCASE_IDS.map((id) => ({ id, url: getPortraitDataUrl(id) })),
    [spriteRev],
  );
  const activeArena = ARENA_MAPS[selectedArenaId] ?? ARENA_MAPS.kanli_ay;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#08090d] select-none">
      {/* Live Selected Grimdark Wide-Angle Arena Backdrop */}
      <img
        src={activeArena.imageUrl}
        alt={`${activeArena.name} savaş arenası`}
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover pixelated transition-opacity duration-300"
      />

      {/* Deep Obsidian Cinematic Contrast Scrim on Left Half */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(105deg, rgba(6,7,11,0.94) 0%, rgba(8,9,14,0.82) 48%, rgba(8,9,14,0.32) 78%, rgba(6,7,11,0.62) 100%)',
        }}
      />

      {/* Drifting Crimson & Gold War Embers */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {EMBERS.map((e) => (
          <span
            key={e.id}
            className="sakura-petal absolute block"
            style={{
              left: e.left,
              top: e.top,
              width: `${e.size}px`,
              height: `${e.size}px`,
              backgroundColor: e.crimson ? '#dc2626' : '#f97316',
              animationDuration: e.duration,
              animationDelay: e.delay,
              boxShadow: e.crimson
                ? '0 0 8px rgba(220,38,38,0.8)'
                : '0 0 8px rgba(249,115,22,0.8)',
            }}
          />
        ))}
      </div>

      {/* Main Content anchored cleanly on left half */}
      <div className="relative z-10 h-full flex flex-col justify-between p-7 md:p-11 lg:p-12 max-w-[680px]">
        <div className="pt-1">
          {/* Grimdark Crimson & Tarnished Gold Crest Lockup */}
          <svg
            viewBox="0 0 520 148"
            className="w-full max-w-[460px] h-auto drop-shadow-[0_6px_16px_rgba(0,0,0,0.85)]"
            role="img"
            aria-label="Shinobi Tactics"
          >
            {/* Symmetrical Crossed Steel Kunai Behind Crest */}
            <g opacity="0.88">
              <line x1="16" y1="18" x2="98" y2="100" stroke="#94a3b8" strokeWidth="4.5" strokeLinecap="square" />
              <line x1="98" y1="18" x2="16" y2="100" stroke="#94a3b8" strokeWidth="4.5" strokeLinecap="square" />
              <polygon points="10,12 24,16 16,24" fill="#e2e8f0" stroke="#07080d" strokeWidth="1.5" />
              <polygon points="104,12 90,16 98,24" fill="#e2e8f0" stroke="#07080d" strokeWidth="1.5" />
              <circle cx="99" cy="101" r="4.5" fill="none" stroke="#d99a3c" strokeWidth="2.5" />
              <circle cx="15" cy="101" r="4.5" fill="none" stroke="#d99a3c" strokeWidth="2.5" />
            </g>

            {/* Blood-Crimson Steel War Crest */}
            <rect
              x="24"
              y="26"
              width="66"
              height="66"
              rx="6"
              fill="#450a0a"
              stroke="#d99a3c"
              strokeWidth="3.5"
            />
            <rect
              x="30"
              y="32"
              width="54"
              height="54"
              rx="3"
              fill="#7f1d1d"
              stroke="#1f0707"
              strokeWidth="2"
            />
            <path
              d="M57 42 C68 42 74 50 74 59 C74 70 65 76 55 76 C45 76 40 69 40 60 C40 53 45 48 53 48 C59 48 64 52 64 58 C64 63 60 66 55 66 C51 66 49 63 49 60"
              fill="none"
              stroke="#fde047"
              strokeWidth="3.8"
              strokeLinecap="square"
            />
            <polygon points="38,76 47,68 49,78" fill="#fde047" />

            {/* Typography */}
            <text
              x="108"
              y="72"
              fill="#f8fafc"
              stroke="#07080d"
              strokeWidth="7"
              paintOrder="stroke fill"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="54"
              letterSpacing="2"
            >
              SHINOBI
            </text>
            <text
              x="108"
              y="120"
              fill="#dc2626"
              stroke="#07080d"
              strokeWidth="7"
              paintOrder="stroke fill"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="44"
              letterSpacing="6"
            >
              TACTICS
            </text>

            <rect x="24" y="134" width="440" height="3.5" fill="#b91c1c" />
            <rect x="24" y="138" width="440" height="1.5" fill="#d99a3c" />
          </svg>

          <p className="mt-3 text-sm md:text-base text-slate-300 leading-relaxed max-w-[520px] hud-text-stroke">
            Klan shinobilerini karanlık savaş arenasına diz, üçlü birleştirmelerle 3 yıldıza çıkar,
            yasaklı jutsu sinerjilerini ateşle ve online Kage savaşında ayakta kalan son lider ol.
          </p>

          {/* Compact Shinobi Roster Preview */}
          <div className="mt-4 flex items-center gap-2">
            {portraits.map((p) => (
              <div
                key={p.id}
                className="w-11 h-11 md:w-12 md:h-12 border-2 border-[#7d5d33] bg-[#0a0b11] shadow-[0_4px_12px_rgba(0,0,0,0.8)] overflow-hidden"
              >
                <img
                  src={p.url}
                  alt={p.id}
                  className="w-full h-full object-cover pixelated"
                />
              </div>
            ))}
          </div>

          {/* 4 Selectable Grimdark Shinobi War Arenas */}
          <div className="mt-5">
            <div className="flex items-center justify-between max-w-[560px] mb-1.5">
              <span className="font-display font-bold text-xs uppercase tracking-wider text-[#e5c489]">
                Savaş Arenanı Seç
              </span>
              <span className="text-[11px] text-[#c7bba9]">
                {activeArena.name} · {activeArena.subtitle}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 max-w-[560px]">
              {ARENA_MAP_LIST.map((arena) => {
                const selected = arena.id === selectedArenaId;
                return (
                  <button
                    key={arena.id}
                    type="button"
                    data-testid={`arena-pick-${arena.id}`}
                    onClick={() => onSelectArena(arena.id)}
                    className={`group relative cursor-pointer overflow-hidden border-2 text-left transition-all ${
                      selected
                        ? 'border-[#eab308] shadow-[0_0_16px_rgba(234,179,8,0.45)] -translate-y-0.5'
                        : 'border-[#57452e] opacity-80 hover:opacity-100 hover:border-[#9e7740]'
                    }`}
                  >
                    <div className="aspect-video w-full overflow-hidden bg-[#0a0c12]">
                      <img
                        src={arena.imageUrl}
                        alt={arena.name}
                        className="w-full h-full object-cover pixelated"
                      />
                    </div>
                    <div className="px-2 py-1 bg-[#0a0b11]/95 border-t border-[#6e522b]/60">
                      <div className="font-display font-bold text-[10px] text-[#f3ece0] truncate">
                        {arena.name}
                      </div>
                    </div>
                    {selected && (
                      <span className="absolute top-1 right-1 px-1 py-0.5 bg-[#eab308] text-[#08090d] font-mono-num text-[8px] font-extrabold leading-none">
                        SEÇİLİ
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Start Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="game-bevel-btn cursor-pointer bg-gradient-to-b from-[#b91c1c] via-[#8a1717] to-[#520d0d] text-[#fffbeb] font-display font-bold text-base md:text-lg tracking-wider px-6 py-3 border-[#ef4444] whitespace-nowrap shrink-0 hud-text-stroke"
            >
              Tek Kişilik Savaş
            </button>

            <button
              type="button"
              data-testid="open-online-lobby"
              onClick={onOpenOnline}
              className="game-bevel-btn cursor-pointer bg-gradient-to-b from-[#25222c] via-[#15161f] to-[#0b0c12] text-[#fde047] font-display font-bold text-base md:text-lg tracking-wider px-6 py-3 border-[#b88c46] whitespace-nowrap shrink-0 flex items-center gap-2 hud-text-stroke"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <circle cx="9" cy="8" r="3.5" />
                <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
                <circle cx="17" cy="9" r="2.5" />
                <path d="M16 14c2.8.3 5 2 5 5" />
              </svg>
              <span>Online Oda Kur / Katıl</span>
            </button>
          </div>
        </div>

        {/* Bottom Control Hint */}
        <div className="text-xs text-slate-400 tracking-wide hud-text-stroke">
          Sürükle Yerleştir · W Hızlı Diz · D Yenile · F Seviye Atla · Space Savaş · P Menü
        </div>
      </div>
    </div>
  );
};
