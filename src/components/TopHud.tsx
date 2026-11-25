import React from 'react';
import { ARENA_MAPS, AUGMENTS, ENEMY_WAVES } from '../game/data';
import { ArenaMapId, AugmentId, RoundPhase } from '../game/types';
import { RightDrawerTab } from './RightPanel';

interface TopHudProps {
  round: number;
  phase: RoundPhase;
  prepTimer: number;
  hp: number;
  maxHp: number;
  arenaId: ArenaMapId;
  arenaOwnerName?: string | null;
  augments: AugmentId[];
  combatSpeed: 1 | 2;
  muted: boolean;
  isOnline?: boolean;
  roomCode?: string;
  opponentName?: string | null;
  rightDrawerOpen: boolean;
  rightDrawerTab: RightDrawerTab;
  onToggleRightDrawer: (tab: RightDrawerTab) => void;
  onToggleSpeed: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
}

export const TopHud: React.FC<TopHudProps> = ({
  round,
  phase,
  prepTimer,
  hp,
  maxHp,
  arenaId,
  arenaOwnerName,
  augments,
  combatSpeed,
  muted,
  isOnline = false,
  roomCode,
  opponentName,
  rightDrawerOpen,
  rightDrawerTab,
  onToggleRightDrawer,
  onToggleSpeed,
  onToggleMute,
  onPause,
  onRestart,
}) => {
  const wave = ENEMY_WAVES[Math.min(round - 1, ENEMY_WAVES.length - 1)];
  const arenaDef = ARENA_MAPS[arenaId] ?? ARENA_MAPS.kanli_ay;
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const timerUrgent = phase === 'prep' && prepTimer <= 5;

  const phaseLabel =
    phase === 'prep' ? 'HAZIRLIK' : phase === 'combat' ? 'SAVAŞ' : 'TUR SONU';

  return (
    <>
      {/* Top-Center Flush Forged TFT Stage Plaque (Anchored seamlessly to screen top!) */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 z-30 game-stage-banner px-4 py-1.5 flex items-center gap-3.5 max-w-[calc(100vw-340px)]"
        role="region"
        aria-label="Savaş Aşaması"
      >
        {/* Stage Crest & Live Phase */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-display font-bold text-sm text-[#fde047] tracking-wider whitespace-nowrap hud-text-stroke">
            {isOnline ? `TUR ${round}` : wave.stageLabel}
          </span>
          {!isOnline && wave.isPve && (
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-[#86efac] whitespace-nowrap">
              Canavar
            </span>
          )}
          <span className="text-[#6e522b]" aria-hidden="true">·</span>
          <span
            className={`text-[11px] font-display font-bold tracking-wider uppercase whitespace-nowrap ${
              phase === 'combat'
                ? 'text-[#f87171]'
                : phase === 'prep'
                  ? 'text-[#4ade80]'
                  : 'text-[#facc15]'
            }`}
          >
            {phaseLabel}
          </span>
          {phase === 'prep' && (
            <span
              className={`font-mono-num text-xs font-bold px-1.5 py-0.5 leading-none border ${
                timerUrgent
                  ? 'bg-[#450a0a] border-[#ef4444] text-[#fecaca]'
                  : 'bg-[#090a10] border-[#7d5d33]/80 text-[#fef3c7]'
              }`}
            >
              {Math.ceil(prepTimer)}s
            </span>
          )}
        </div>

        {/* Forged TFT Stage Progression Track with Inline SVG Swords & Monster Emblems */}
        {!isOnline && (
          <div className="hidden lg:flex items-center gap-1" aria-label="Aşama Takibi">
            {ENEMY_WAVES.map((w, idx) => {
              const isCurrent = w.round === round;
              const isPast = w.round < round;
              return (
                <React.Fragment key={w.round}>
                  {idx > 0 && (
                    <span
                      className={`w-1.5 h-[2px] ${
                        isPast ? 'bg-[#8c6a38]' : 'bg-[#2a2730]'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <span
                    title={`${w.stageLabel} · ${w.name}${w.isPve ? ' (Canavar + Ganimet Küresi)' : ''}`}
                    className={`flex items-center justify-center border transition-transform ${
                      isCurrent
                        ? w.isPve
                          ? 'w-5 h-5 bg-[#14532d] border-[#4ade80] text-[#bbf7d0] shadow-[0_0_8px_rgba(74,222,128,0.45)]'
                          : 'w-5 h-5 bg-[#7f1d1d] border-[#facc15] text-[#fef08a] shadow-[0_0_8px_rgba(250,204,21,0.4)]'
                        : isPast
                          ? 'w-3.5 h-3.5 bg-[#241e18] border-[#7d5d33]/80 text-[#a18254]'
                          : w.isPve
                            ? 'w-4 h-4 bg-[#0d1f17] border-[#22c55e]/60 text-[#4ade80]'
                            : 'w-3.5 h-3.5 bg-[#0e1018] border-[#3d3942] text-slate-500'
                    }`}
                  >
                    {w.isPve ? (
                      <svg viewBox="0 0 16 16" className="w-3 h-3" aria-hidden="true">
                        <path
                          d="M3 4l2 2h6l2-2-1 6-4 3-4-3-1-6zm3 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"
                          fill="currentColor"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 16 16" className="w-2.5 h-2.5" aria-hidden="true">
                        <path
                          d="M3 13l3-3m7-7l-7 7m0 0l-2-2m9 5l-3-3m-7-7l7 7m0 0l2-2"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="square"
                        />
                      </svg>
                    )}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        )}

        <span className="h-4 w-px bg-[#6e522b]/70 hidden sm:block" aria-hidden="true" />

        {/* Active Arena Name */}
        <div className="hidden sm:flex items-center gap-1.5 min-w-0">
          <span
            className="w-2 h-2 rotate-45 shrink-0 border border-black/80"
            style={{ backgroundColor: arenaDef.accentColor }}
            aria-hidden="true"
          />
          <span className="text-[11px] font-display font-semibold text-[#e6dccb] truncate max-w-[180px]">
            {arenaOwnerName
              ? `${arenaOwnerName} · ${arenaDef.name}`
              : isOnline && opponentName
                ? `VS ${opponentName} · ${arenaDef.name}`
                : isOnline
                  ? `Oda ${roomCode ?? ''} · ${arenaDef.name}`
                  : `${arenaDef.name} · ${wave.name}`}
          </span>
        </div>

        <span className="h-4 w-px bg-[#6e522b]/70 hidden md:block" aria-hidden="true" />

        {/* Compact Kage HP Gauge with Custom Crest Icon */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0" title="Kage Canı">
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-[#ef4444] shrink-0" aria-hidden="true">
            <path
              d="M8 14S2 9.8 2 5.6A3.4 3.4 0 0 1 8 3.5a3.4 3.4 0 0 1 6 2.1C14 9.8 8 14 8 14z"
              fill="currentColor"
              stroke="#07080d"
              strokeWidth="1.2"
            />
          </svg>
          <span className="font-mono-num font-bold text-xs text-[#f8fafc]" data-testid="hud-hp">
            {Math.round(hp)}
          </span>
          <div className="w-14 h-2 bg-[#090a10] overflow-hidden border border-[#7d5d33]/75 p-[1px]">
            <div
              className="h-full bg-gradient-to-r from-[#991b1b] via-[#dc2626] to-[#f87171] origin-left transition-transform duration-200"
              style={{ transform: `scaleX(${hpPct / 100})` }}
            />
          </div>
        </div>

        {/* Active Kage Augments */}
        {augments.length > 0 && (
          <div className="hidden xl:flex items-center gap-1.5 pl-2 border-l border-[#6e522b]/70">
            {augments.map((augId) => {
              const aug = AUGMENTS[augId];
              return (
                <span
                  key={augId}
                  title={`${aug.name}: ${aug.description}`}
                  className="text-[10px] font-display font-bold whitespace-nowrap"
                  style={{ color: aug.color }}
                >
                  {aug.name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Top-Right Unified Forged Iron Utility Strip (Flush top, zero SaaS pills) */}
      <div className="fixed top-0 right-3 z-30 game-stage-banner flex items-stretch divide-x divide-[#5a4326]/70">
        <button
          type="button"
          tabIndex={-1}
          data-testid="toggle-damage-btn"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleRightDrawer('damage');
          }}
          className={`cursor-pointer h-8 px-2.5 font-display font-bold text-[11px] tracking-wide transition-colors whitespace-nowrap ${
            rightDrawerOpen && rightDrawerTab === 'damage'
              ? 'bg-[#7f1d1d] text-[#fef2f2]'
              : 'hover:bg-[#1e1d26] text-[#dfd4c2]'
          }`}
        >
          Hasar
        </button>

        <button
          type="button"
          tabIndex={-1}
          data-testid="toggle-guide-btn"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleRightDrawer('guide');
          }}
          className={`cursor-pointer h-8 px-2.5 font-display font-bold text-[11px] tracking-wide transition-colors whitespace-nowrap ${
            rightDrawerOpen && rightDrawerTab === 'guide'
              ? 'bg-[#7f1d1d] text-[#fef2f2]'
              : 'hover:bg-[#1e1d26] text-[#dfd4c2]'
          }`}
        >
          Rehber
        </button>

        {!isOnline && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleSpeed();
            }}
            aria-label={`Savaş Hızı ${combatSpeed}x`}
            className={`cursor-pointer h-8 px-2.5 font-mono-num text-xs font-bold transition-colors ${
              combatSpeed === 2
                ? 'bg-[#7c2d12] text-[#fde047]'
                : 'hover:bg-[#1e1d26] text-[#dfd4c2]'
            }`}
          >
            {combatSpeed}x
          </button>
        )}

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Sesi Aç' : 'Sesi Kapat'}
          title="Ses [M]"
          className="cursor-pointer w-8 h-8 hover:bg-[#1e1d26] flex items-center justify-center text-[#dfd4c2]"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
            <polygon points="4,9 9,9 14,4 14,20 9,15 4,15" fill="currentColor" />
            {muted ? (
              <path d="M17 9l5 6m0-6l-5 6" stroke="#f87171" strokeWidth="2.2" />
            ) : (
              <path
                d="M17 8.5c1.6 1.5 1.6 5.5 0 7M19.5 6c2.6 2.8 2.6 9.2 0 12"
                stroke="#eab308"
                strokeWidth="2"
                fill="none"
              />
            )}
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onPause();
          }}
          aria-label="Menü"
          title="Menü [P]"
          className="cursor-pointer w-8 h-8 hover:bg-[#1e1d26] flex items-center justify-center text-[#dfd4c2]"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" fill="currentColor" />
          </svg>
        </button>

        {!isOnline && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            aria-label="Yeniden Başlat"
            title="Yeniden Başlat [R]"
            className="cursor-pointer w-8 h-8 hover:bg-[#1e1d26] flex items-center justify-center text-[#dfd4c2]"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
              <path
                d="M4 12a8 8 0 1 1 2.4 5.7M4 12V6m0 6h6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="square"
              />
            </svg>
          </button>
        )}
      </div>
    </>
  );
};
