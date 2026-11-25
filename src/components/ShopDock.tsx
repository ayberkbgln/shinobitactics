import React from 'react';
import {
  COST_COLORS,
  LEVEL_XP_TABLE,
  MAX_LEVEL,
  SHINOBI_BY_ID,
  SHOP_ODDS_BY_LEVEL,
  TRAITS,
} from '../game/data';
import { getPortraitDataUrl } from '../game/pixelSprites';
import { getSellValue } from '../game/rules';
import { AugmentId, OwnedUnit, RoundPhase, ShopSlot, UnitCost } from '../game/types';

interface ShopDockProps {
  phase: RoundPhase;
  gold: number;
  streak: number;
  augments: AugmentId[];
  level: number;
  xp: number;
  shop: ShopSlot[];
  shopLocked: boolean;
  roster: OwnedUnit[];
  deployedCount: number;
  maxBoardUnits: number;
  isOnline?: boolean;
  isOnlineReady?: boolean;
  draggedUnit: OwnedUnit | null;
  isHoveringSellZone: boolean;
  onBuyUnit: (slotIndex: number) => void;
  onReroll: () => void;
  onBuyXp: () => void;
  onToggleLock: () => void;
  onAutoDeploy: () => void;
  onStartCombat: () => void;
}

function RyoCoinSvg({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`${className} shrink-0`} aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="#eab308" stroke="#422006" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="4.5" fill="none" stroke="#fef08a" strokeWidth="1" />
      <rect x="6.4" y="6.4" width="3.2" height="3.2" fill="#422006" />
    </svg>
  );
}

export const ShopDock: React.FC<ShopDockProps> = ({
  phase,
  gold,
  streak,
  augments,
  level,
  xp,
  shop,
  shopLocked,
  roster,
  deployedCount,
  maxBoardUnits,
  isOnline = false,
  isOnlineReady = false,
  draggedUnit,
  isHoveringSellZone,
  onBuyUnit,
  onReroll,
  onBuyXp,
  onToggleLock,
  onAutoDeploy,
  onStartCombat,
}) => {
  const xpNeeded = LEVEL_XP_TABLE[level] ?? 999;
  const odds = SHOP_ODDS_BY_LEVEL[Math.min(MAX_LEVEL, level)];
  const benchCount = roster.filter((u) => u.location === 'bench').length;
  const maxInterest = augments.includes('altin_yagmuru') ? 7 : 5;
  const interest = Math.min(maxInterest, Math.floor(gold / 10));

  const countOwnedCopies = (defId: string): number => {
    let total = 0;
    for (const u of roster) {
      if (u.defId !== defId) continue;
      if (u.stars === 1) total += 1;
      else if (u.stars === 2) total += 3;
      else total += 9;
    }
    return total;
  };

  const draggedDef = draggedUnit ? SHINOBI_BY_ID[draggedUnit.defId] : null;
  const draggedSellValue =
    draggedUnit && draggedDef ? getSellValue(draggedDef.cost, draggedUnit.stars) : 0;

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-20 w-[calc(100vw-24px)] max-w-[1044px] flex flex-col items-center pointer-events-none select-none"
      role="region"
      aria-label="Shinobi Dükkanı"
    >
      {/* TFT Raised Center Gold & Streak Crest Tab (Protrudes organically above the console!) */}
      <div className="pointer-events-auto relative z-10 -mb-[2px] flex items-end gap-2">
        <div
          className="game-crown-tab px-4 py-1 flex items-center gap-3"
          title={`Faiz: +${interest} Ryo (her 10 Ryo = +1)`}
        >
          <div className="flex items-center gap-1.5">
            <RyoCoinSvg className="w-4 h-4" />
            <span
              className="font-mono-num font-bold text-[15px] leading-none text-[#fef08a] hud-text-stroke"
              data-testid="hud-gold"
            >
              {gold}
            </span>
          </div>

          {/* Hammered Gold Interest Ingots */}
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: maxInterest }, (_, i) => (
              <span
                key={i}
                className={`w-2 h-2.5 border ${
                  i < interest
                    ? 'bg-gradient-to-b from-[#fef08a] to-[#ca8a04] border-[#fef9c3]/90 shadow-[0_0_6px_rgba(250,204,21,0.5)]'
                    : 'bg-[#090a0f] border-[#4b3e2d]'
                }`}
              />
            ))}
          </div>

          {/* Streak Counter with Inline SVG Flame / Frost */}
          {streak !== 0 && (
            <div
              className={`flex items-center gap-1 pl-2 border-l border-[#6e522b]/70 font-mono-num text-xs font-bold ${
                streak > 0 ? 'text-[#fb923c]' : 'text-[#7dd3fc]'
              }`}
              title={streak > 0 ? `${streak} Galibiyet Serisi` : `${Math.abs(streak)} Mağlubiyet Serisi`}
            >
              {streak > 0 ? (
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden="true">
                  <path
                    d="M8 1C10 4 13 6 13 10a5 5 0 0 1-10 0c0-2.5 1.5-4.5 3-6-.2 1.8.8 2.8 1.5 3C7.2 5 7.5 3 8 1z"
                    fill="#f97316"
                    stroke="#fef08a"
                    strokeWidth="0.9"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden="true">
                  <path
                    d="M8 2v12M2 8h12M4 4l8 8M12 4l-8 8"
                    stroke="#7dd3fc"
                    strokeWidth="1.6"
                    strokeLinecap="square"
                  />
                </svg>
              )}
              <span>{Math.abs(streak)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Forged Blackened-Iron & Tarnished Gold Console */}
      <div className="pointer-events-auto w-full game-console border-b-0 flex flex-col">
        {/* Top Metallic Ledge: Level + XP + Tier Odds | Board Cap + AutoDeploy + Lock */}
        <div className="px-3 py-1 bg-gradient-to-b from-[#1a1821] to-[#101118] border-b border-[#6e522b]/70 flex items-center justify-between gap-3">
          {/* Left: Level, Gold-Trimmed XP Bar & Color-Coded Odds */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="font-display font-bold text-xs tracking-wider text-[#fef3c7] hud-text-stroke"
                data-testid="hud-level"
              >
                Sv.{level}
              </span>
              <div className="w-20 h-2 bg-[#07080d] overflow-hidden border border-[#7d5d33]/75 p-[1px]">
                <div
                  className="h-full bg-gradient-to-r from-[#0284c7] to-[#38bdf8] origin-left transition-transform duration-200"
                  style={{
                    transform: `scaleX(${level >= MAX_LEVEL ? 1 : Math.min(1, xp / xpNeeded)})`,
                  }}
                />
              </div>
              <span className="font-mono-num text-[10px] text-[#c5b8a5]">
                {level >= MAX_LEVEL ? 'MAKS' : `${xp}/${xpNeeded}`}
              </span>
            </div>

            <div className="hidden lg:flex items-center gap-2.5 text-[10px] font-mono-num pl-2.5 border-l border-[#5a4326]/70">
              {([1, 2, 3, 4, 5] as UnitCost[]).map((c, idx) => (
                <span key={c} className="inline-flex items-center gap-1" style={{ color: COST_COLORS[c].badge }}>
                  <span
                    className="w-1.5 h-1.5 rotate-45 inline-block"
                    style={{ backgroundColor: COST_COLORS[c].border }}
                    aria-hidden="true"
                  />
                  {odds[idx]}%
                </span>
              ))}
            </div>
          </div>

          {/* Right: Board Cap + Quick Deploy + Custom SVG Lock */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="flex items-baseline gap-1 pr-2 border-r border-[#5a4326]/70"
              title="Arenadaki Shinobi Kapasitesi"
            >
              <span
                className={`font-mono-num font-bold text-xs ${
                  deployedCount < maxBoardUnits ? 'text-[#facc15]' : 'text-[#4ade80]'
                }`}
                data-testid="hud-board-count"
              >
                {deployedCount}/{maxBoardUnits}
              </span>
              <span className="text-[9px] text-[#a79c8e] uppercase font-display tracking-wider">
                Birim
              </span>
            </div>

            {phase === 'prep' && benchCount > 0 && deployedCount < maxBoardUnits && (
              <button
                type="button"
                onClick={onAutoDeploy}
                className="game-bevel-btn cursor-pointer px-2.5 py-0.5 bg-gradient-to-b from-[#2b231c] to-[#171310] text-[#fde047] text-[10px] font-display font-bold whitespace-nowrap"
              >
                Otomatik Diz
              </button>
            )}

            <button
              type="button"
              onClick={onToggleLock}
              aria-pressed={shopLocked}
              aria-label={shopLocked ? 'Dükkan Kilitli' : 'Dükkanı Kilitle'}
              className={`game-bevel-btn cursor-pointer px-2.5 py-0.5 text-[10px] font-display font-bold flex items-center gap-1.5 whitespace-nowrap ${
                shopLocked
                  ? 'bg-gradient-to-b from-[#78350f] to-[#451a03] text-[#fef08a] border-[#facc15]'
                  : 'bg-gradient-to-b from-[#1e202c] to-[#12141c] text-[#d6cbb9] border-[#5a4a3a]'
              }`}
            >
              <svg viewBox="0 0 16 16" className="w-3 h-3 shrink-0" aria-hidden="true">
                {shopLocked ? (
                  <path
                    d="M5 7V5a3 3 0 0 1 6 0v2h1v7H4V7h1zm2-2v2h2V5a1 1 0 1 0-2 0z"
                    fill="currentColor"
                  />
                ) : (
                  <path
                    d="M5 7V5a3 3 0 0 1 5.8-1l-1.5.5A1.5 1.5 0 0 0 6.5 5v2H12v7H4V7h1z"
                    fill="currentColor"
                  />
                )}
              </svg>
              <span>{shopLocked ? 'Kilitli' : 'Kilitle'}</span>
            </button>
          </div>
        </div>

        {/* Main Console Row: Buy XP + Reroll | 5 Full-Art Illustrated Cards (or Sell Zone) | War CTA */}
        <div className="p-2 flex items-stretch gap-2 h-[106px]">
          {/* Left Stacked Metallic Command Buttons */}
          <div className="w-[158px] shrink-0 flex flex-col justify-between gap-1.5">
            <button
              type="button"
              onClick={onBuyXp}
              disabled={gold < 4 || level >= MAX_LEVEL}
              aria-label="Seviye Atla, 4 Ryo, +4 XP"
              className="game-bevel-btn cursor-pointer flex-1 px-2.5 bg-gradient-to-b from-[#193b5c] via-[#122b44] to-[#0c1d2e] disabled:opacity-40 disabled:cursor-not-allowed border-[#4b8bb8] flex items-center justify-between gap-1.5 text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <svg viewBox="0 0 16 16" className="w-4 h-4 text-[#7dd3fc] shrink-0" aria-hidden="true">
                  <path d="M8 2l5 5H9.8v7H6.2V7H3l5-5z" fill="currentColor" stroke="#07080d" strokeWidth="0.9" />
                </svg>
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="font-display font-bold text-xs text-[#f0f9ff] truncate">
                    Seviye Atla
                  </span>
                  <span className="text-[9px] font-mono-num text-[#7dd3fc]">+4 XP · [F]</span>
                </div>
              </div>
              <div className="px-1.5 py-0.5 bg-[#07111c] border border-[#b4893c]/70 flex items-center gap-1 shrink-0">
                <RyoCoinSvg className="w-2.5 h-2.5" />
                <span className="font-mono-num font-bold text-[11px] text-[#fde047]">4</span>
              </div>
            </button>

            <button
              type="button"
              onClick={onReroll}
              disabled={gold < 2}
              aria-label="Yenile, 2 Ryo"
              className="game-bevel-btn cursor-pointer flex-1 px-2.5 bg-gradient-to-b from-[#5e3415] via-[#45240e] to-[#2e1709] disabled:opacity-40 disabled:cursor-not-allowed border-[#c98b3a] flex items-center justify-between gap-1.5 text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <svg viewBox="0 0 16 16" className="w-4 h-4 text-[#fcd34d] shrink-0" aria-hidden="true">
                  <path
                    d="M13 8a5 5 0 1 1-1.5-3.5M13 3v3h-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="square"
                  />
                </svg>
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="font-display font-bold text-xs text-[#fffbeb] truncate">
                    Yenile
                  </span>
                  <span className="text-[9px] font-mono-num text-[#fcd34d]/85">Dükkan · [D]</span>
                </div>
              </div>
              <div className="px-1.5 py-0.5 bg-[#1f0f05] border border-[#b4893c]/70 flex items-center gap-1 shrink-0">
                <RyoCoinSvg className="w-2.5 h-2.5" />
                <span className="font-mono-num font-bold text-[11px] text-[#fde047]">2</span>
              </div>
            </button>
          </div>

          {/* Center 5 Collector-Grade Full-Art Shinobi Cards + Dynamic Drag-to-Sell Dropzone */}
          <div className="relative flex-1 min-w-0">
            <div className="grid grid-cols-5 gap-2 h-full">
              {shop.map((slot) => {
                if (slot.purchased || !slot.defId) {
                  return (
                    <div
                      key={slot.slotIndex}
                      className="game-slot-recess h-full flex items-center justify-center text-[10px] text-[#5e564d] font-display uppercase tracking-widest"
                    >
                      Alındı
                    </div>
                  );
                }

                const def = SHINOBI_BY_ID[slot.defId];
                const palette = COST_COLORS[def.cost];
                const canAfford = gold >= def.cost;
                const ownedCount = countOwnedCopies(def.id);
                const willMerge = ownedCount % 3 === 2;

                return (
                  <button
                    key={slot.slotIndex}
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onBuyUnit(slot.slotIndex)}
                    aria-label={`${def.name} satın al, ${def.cost} Ryo, ${TRAITS[def.origin].name} ${TRAITS[def.role].name}`}
                    className={`group relative h-full text-left cursor-pointer border-2 transition-transform overflow-hidden flex flex-col justify-between disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[#facc15] ${
                      willMerge ? 'forge-glow' : ''
                    }`}
                    style={{
                      borderColor: willMerge ? '#facc15' : palette.border,
                      backgroundColor: '#0a0c13',
                      boxShadow: willMerge
                        ? undefined
                        : `inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 10px rgba(0, 0, 0, 0.72)`,
                    }}
                  >
                    {/* Full-Bleed Atmospheric Portrait Stage (TFT Layout: Art Right, Unclipped Traits Left) */}
                    <div
                      className="relative flex-1 w-full overflow-hidden flex items-end"
                      style={{
                        background: `radial-gradient(circle at 75% 45%, ${palette.border}38 0%, #090b12 78%)`,
                      }}
                    >
                      <img
                        src={getPortraitDataUrl(def.id)}
                        alt={def.name}
                        draggable={false}
                        className="absolute right-0 top-0 h-full w-[78px] xl:w-[86px] object-cover object-top pixelated pointer-events-none transition-transform duration-150 group-hover:scale-105"
                      />

                      {/* Smooth left-to-right scrim so Turkish trait names read cleanly with zero truncation */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            'linear-gradient(90deg, rgba(7,9,14,0.96) 0%, rgba(7,9,14,0.82) 48%, rgba(7,9,14,0.12) 82%, rgba(7,9,14,0) 100%)',
                        }}
                      />

                      {/* Crisp Left-Side Trait Stack */}
                      <div className="relative z-10 w-full px-2 pb-1.5 pt-1 flex flex-col justify-end gap-0.5">
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className="w-1.5 h-1.5 rotate-45 shrink-0"
                            style={{ backgroundColor: TRAITS[def.origin].color }}
                            aria-hidden="true"
                          />
                          <span
                            className="text-[10px] font-display font-bold truncate hud-text-stroke leading-tight"
                            style={{ color: TRAITS[def.origin].color }}
                          >
                            {TRAITS[def.origin].name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className="w-1.5 h-1.5 rotate-45 shrink-0 bg-[#cbd5e1]"
                            aria-hidden="true"
                          />
                          <span className="text-[10px] font-medium text-[#ede4d4] truncate hud-text-stroke leading-tight">
                            {TRAITS[def.role].name}
                          </span>
                        </div>
                      </div>

                      {/* Star Upgrade Progress Strip */}
                      {ownedCount > 0 && (
                        <span
                          className={`absolute top-1 left-1.5 px-1 py-0.5 text-[8px] font-mono-num font-bold leading-none border z-10 ${
                            willMerge
                              ? 'bg-[#eab308] text-[#08090d] border-[#fef08a]'
                              : 'bg-[#07080d]/92 text-[#fde047] border-[#96723e]'
                          }`}
                        >
                          {willMerge ? '★ YÜKSELT' : `${ownedCount % 3}/3`}
                        </span>
                      )}
                    </div>

                    {/* Forged Metallic Nameplate Footer with Ryo Coin */}
                    <div
                      className="px-2 py-1 border-t border-black/80 flex items-center justify-between gap-1"
                      style={{
                        background: `linear-gradient(180deg, ${palette.bg} 0%, #090b11 100%)`,
                      }}
                    >
                      <span className="font-display font-bold text-[11px] text-[#f8fafc] truncate hud-text-stroke">
                        {def.name}
                      </span>
                      <span className="inline-flex items-center gap-0.5 font-mono-num font-bold text-[11px] text-[#fde047] shrink-0">
                        <RyoCoinSvg className="w-2.5 h-2.5" />
                        {def.cost}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Drag-to-Sell Crimson War Dropzone Overlay */}
            {draggedUnit && draggedDef && phase === 'prep' && (
              <div
                data-sell-zone="true"
                className={`absolute inset-0 z-30 border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all ${
                  isHoveringSellZone
                    ? 'bg-[#7f1d1d]/96 border-[#fde047] scale-[1.01]'
                    : 'bg-[#3b090c]/94 border-[#dc2626]'
                }`}
              >
                <div className="flex items-center gap-2 text-[#fef2f2] font-display font-bold text-sm tracking-wide">
                  <RyoCoinSvg className="w-5 h-5" />
                  <span>SATMAK İÇİN BURAYA BIRAK</span>
                </div>
                <div className="text-[11px] text-[#fde68a] font-mono-num font-bold">
                  {draggedDef.name} {'★'.repeat(draggedUnit.stars)} · +{draggedSellValue} Ryo
                </div>
              </div>
            )}
          </div>

          {/* Right Primary War Seal CTA */}
          <div className="w-[132px] shrink-0 flex flex-col justify-stretch">
            {phase === 'prep' ? (
              <button
                type="button"
                data-testid="primary-combat-cta"
                onClick={onStartCombat}
                disabled={deployedCount === 0}
                className={`game-bevel-btn cursor-pointer h-full w-full px-2.5 disabled:opacity-40 disabled:cursor-not-allowed text-[#fffbeb] font-display font-bold text-sm tracking-wide flex flex-col items-center justify-center gap-1 ${
                  isOnline && isOnlineReady
                    ? 'bg-gradient-to-b from-[#15803d] via-[#14532d] to-[#0a2e18] border-[#4ade80]'
                    : 'bg-gradient-to-b from-[#b91c1c] via-[#8a1717] to-[#520d0d] border-[#ef4444]'
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#fde047]" aria-hidden="true">
                  <path
                    d="M5 19l5-5m9-9l-9 9m0 0l-2-2m11 7l-5-5M5 5l9 9m0 0l2-2"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="square"
                  />
                </svg>
                <span className="text-center leading-tight hud-text-stroke">
                  {isOnline ? (isOnlineReady ? 'Hazırsın' : 'Hazır Ol') : 'Savaşı Başlat'}
                </span>
                <span className="text-[10px] font-mono-num opacity-85">
                  {deployedCount === 0
                    ? 'Birim diz'
                    : isOnline
                      ? isOnlineReady
                        ? 'Bekleniyor'
                        : 'Hemen başlat'
                      : '[Space]'}
                </span>
              </button>
            ) : (
              <div className="game-slot-recess h-full w-full px-2 flex flex-col items-center justify-center text-center gap-1 border-[#991b1b]">
                <span className="font-display font-bold text-xs text-[#fca5a5] tracking-wider uppercase">
                  {phase === 'combat' ? 'Savaş Sürüyor' : 'Tur Bitti'}
                </span>
                <span className="text-[10px] text-[#a79c8e]">Canlı Çarpışma</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
