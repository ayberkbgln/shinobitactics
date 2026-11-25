import React, { useState } from 'react';
import { TRAITS } from '../game/data';
import { ActiveSynergy, TraitId } from '../game/types';

interface SynergyPanelProps {
  synergies: ActiveSynergy[];
}

function TraitIcon({ id, active, gold }: { id: TraitId; active: boolean; gold: boolean }) {
  const stroke = '#07080d';
  const fill = gold ? '#fef08a' : active ? TRAITS[id].color : '#64748b';

  switch (id) {
    case 'yaprak':
      return (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <path d="M5 17C5 9 11 5 19 5c0 8-4 14-12 14l-2 2" fill={fill} stroke={stroke} strokeWidth="2" />
        </svg>
      );
    case 'kizil_klan':
      return (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="8" fill={fill} stroke={stroke} strokeWidth="2" />
          <circle cx="12" cy="12" r="3" fill="#07080d" />
        </svg>
      );
    case 'kum':
      return (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <path d="M4 17l5-8 5 5 6-7v10z" fill={fill} stroke={stroke} strokeWidth="2" />
        </svg>
      );
    case 'bulut_orgutu':
      return (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <path d="M6 16h12a4 4 0 0 0 0-8 5 5 0 0 0-9-2 4 4 0 0 0-3 10z" fill={fill} stroke={stroke} strokeWidth="2" />
        </svg>
      );
    case 'sannin':
      return (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <polygon points="12,3 21,19 3,19" fill={fill} stroke={stroke} strokeWidth="2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <polygon points="12,2 21,9 17,21 7,21 3,9" fill={fill} stroke={stroke} strokeWidth="2" />
        </svg>
      );
  }
}

export const SynergyPanel: React.FC<SynergyPanelProps> = ({ synergies }) => {
  const [focusedTrait, setFocusedTrait] = useState<TraitId | null>(null);

  if (synergies.length === 0) return null;

  return (
    <aside
      className="fixed left-2.5 top-14 z-20 w-[144px] hidden md:flex flex-col gap-1.5 pointer-events-none select-none"
      aria-label="Aktif Sinerjiler"
    >
      {synergies.slice(0, 8).map((syn) => {
        const def = TRAITS[syn.traitId];
        const isActive = syn.activeTierIndex >= 0;
        const isGoldTier = isActive && syn.activeTierIndex === def.tiers.length - 1;
        const isSilverTier = isActive && !isGoldTier && syn.activeTierIndex >= 1;
        const expanded = focusedTrait === syn.traitId;

        const hexOuterBg = isGoldTier
          ? '#eab308'
          : isSilverTier
            ? '#cbd5e1'
            : isActive
              ? '#b47b3b'
              : '#475569';
        const hexInnerBg = isGoldTier
          ? 'linear-gradient(180deg, #78480a 0%, #3d2105 100%)'
          : isSilverTier
            ? 'linear-gradient(180deg, #475569 0%, #1e293b 100%)'
            : isActive
              ? 'linear-gradient(180deg, #4b2d18 0%, #24140a 100%)'
              : 'linear-gradient(180deg, #1b1e29 0%, #0d0f16 100%)';

        return (
          <div key={syn.traitId} className="relative pointer-events-auto">
            <button
              type="button"
              onClick={() => setFocusedTrait(expanded ? null : syn.traitId)}
              onMouseEnter={() => setFocusedTrait(syn.traitId)}
              onMouseLeave={() => setFocusedTrait(null)}
              className={`group w-full text-left flex items-center cursor-pointer transition-opacity ${
                isActive ? 'opacity-100' : 'opacity-72 hover:opacity-100'
              }`}
            >
              {/* Authentic TFT Metallic Hexagonal Crest (Overlapping ribbon left edge) */}
              <div
                className="relative z-10 w-8 h-9 game-hex flex items-center justify-center shrink-0 -mr-2"
                style={{ backgroundColor: hexOuterBg }}
              >
                <div
                  className="w-[28px] h-[32px] game-hex flex items-center justify-center"
                  style={{ background: hexInnerBg }}
                >
                  <TraitIcon id={syn.traitId} active={isActive} gold={isGoldTier} />
                </div>
              </div>

              {/* Forged Dark-Lacquer Trait Ribbon */}
              <div
                className={`flex-1 min-w-0 pl-3.5 pr-2 py-1 border-y border-r flex items-center gap-1.5 ${
                  isGoldTier
                    ? 'bg-gradient-to-r from-[#23190c]/96 to-[#110e12]/94 border-[#d4a03a]'
                    : isActive
                      ? 'bg-gradient-to-r from-[#181720]/96 to-[#0c0d13]/92 border-[#7d5d33]/85'
                      : 'bg-[#0b0c12]/84 border-[#36333d]/80'
                }`}
              >
                <span
                  className={`font-mono-num text-xs font-bold w-4 text-center shrink-0 ${
                    isGoldTier
                      ? 'text-[#fde047]'
                      : isActive
                        ? 'text-[#f8fafc]'
                        : 'text-slate-400'
                  }`}
                >
                  {syn.count}
                </span>

                <div className="min-w-0 flex-1 leading-none">
                  <div
                    className={`text-[11px] font-display font-bold truncate ${
                      isGoldTier
                        ? 'text-[#fef3c7]'
                        : isActive
                          ? 'text-[#f1f5f9]'
                          : 'text-slate-400'
                    }`}
                  >
                    {def.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-0.5 text-[9px] font-mono-num">
                    {def.tiers.map((t, idx) => (
                      <React.Fragment key={t.count}>
                        {idx > 0 && <span className="text-slate-600">/</span>}
                        <span
                          className={
                            idx === syn.activeTierIndex
                              ? 'text-[#facc15] font-bold'
                              : idx < syn.activeTierIndex
                                ? 'text-slate-300'
                                : 'text-slate-500'
                          }
                        >
                          {t.count}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </button>

            {/* Forged Tooltip Popping to the Right */}
            {expanded && (
              <div className="absolute left-full top-0 ml-2 w-56 p-2.5 game-forge-card text-[11px] leading-snug text-slate-200 z-40 pointer-events-none">
                <div className="flex items-center justify-between border-b border-[#8a6738]/60 pb-1 mb-1.5">
                  <span className="font-display font-bold text-xs text-[#fde047]">{def.name}</span>
                  <span className="font-mono-num text-[10px] text-[#c9a975]">{syn.count} Birim</span>
                </div>
                <p className="text-slate-300 mb-1.5">{def.description}</p>
                <div className="flex flex-col gap-1">
                  {def.tiers.map((t, idx) => (
                    <div
                      key={t.count}
                      className={
                        idx === syn.activeTierIndex
                          ? 'text-[#fde047] font-semibold'
                          : 'text-slate-400'
                      }
                    >
                      ({t.count}) {t.summary}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
};
