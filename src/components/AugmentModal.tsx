import React from 'react';
import { AugmentDef, AugmentTier } from '../game/types';

interface AugmentModalProps {
  round: number;
  choices: AugmentDef[];
  canReroll: boolean;
  onChoose: (augment: AugmentDef) => void;
  onReroll: () => void;
}

const TIER_STYLES: Record<
  AugmentTier,
  { label: string; border: string; badgeBg: string; badgeText: string; glow: string }
> = {
  silver: {
    label: 'GÜMÜŞ MÜHÜR',
    border: '#94a3b8',
    badgeBg: '#334155',
    badgeText: '#e2e8f0',
    glow: 'rgba(148, 163, 184, 0.28)',
  },
  gold: {
    label: 'ALTIN MÜHÜR',
    border: '#facc15',
    badgeBg: '#78350f',
    badgeText: '#fef08a',
    glow: 'rgba(250, 204, 21, 0.32)',
  },
  prismatic: {
    label: 'PRİZMATİK MÜHÜR',
    border: '#c084fc',
    badgeBg: '#4c1d95',
    badgeText: '#f3e8ff',
    glow: 'rgba(192, 132, 252, 0.42)',
  },
};

export const AugmentModal: React.FC<AugmentModalProps> = ({
  round,
  choices,
  canReroll,
  onChoose,
  onReroll,
}) => {
  return (
    <div
      className="fixed inset-0 z-40 bg-[#0d0912]/82 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="augment-modal-title"
    >
      <div className="game-console w-full max-w-3xl p-6 shadow-[0_24px_60px_rgba(0,0,0,0.88)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-display font-bold uppercase tracking-[0.22em] text-[#d9a441]">
              Tur {round} · Kage Mührü Seçimi
            </div>
            <h2
              id="augment-modal-title"
              className="mt-0.5 font-display font-bold text-2xl text-[#f7ebd2] tracking-wide"
            >
              Bir Kage Mührü Seç
            </h2>
          </div>

          <button
            type="button"
            disabled={!canReroll}
            onClick={onReroll}
            className="game-bevel-btn game-bevel-btn--gold cursor-pointer px-3.5 py-2 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-display font-bold uppercase tracking-wider text-[#f8d77a]"
          >
            {canReroll ? 'Seçenekleri Yenile (1 Hak)' : 'Yenileme Kullanıldı'}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {choices.map((aug) => {
            const tier = TIER_STYLES[aug.tier];
            return (
              <button
                key={aug.id}
                type="button"
                data-testid={`augment-card-${aug.id}`}
                onClick={() => onChoose(aug)}
                className="group cursor-pointer p-4 text-left bg-gradient-to-b from-[#171b24] to-[#0b0e14] hover:from-[#1f2431] hover:to-[#11151f] border-2 transition-all hover:-translate-y-0.5 flex flex-col justify-between gap-3"
                style={{
                  borderColor: tier.border,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1), 0 10px 26px ${tier.glow}`,
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="px-2 py-0.5 text-[10px] font-display font-bold tracking-wider uppercase"
                      style={{ backgroundColor: tier.badgeBg, color: tier.badgeText }}
                    >
                      {tier.label}
                    </span>
                    <span
                      className="game-hex w-9 h-9 flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: 'rgba(18, 22, 32, 0.95)',
                        boxShadow: `inset 0 0 0 2px ${aug.color}`,
                      }}
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                        <polygon
                          points="12,2 21,7 21,17 12,22 3,17 3,7"
                          fill="none"
                          stroke={aug.color}
                          strokeWidth="2.2"
                        />
                        <circle cx="12" cy="12" r="4" fill={aug.color} />
                      </svg>
                    </span>
                  </div>

                  <h3 className="mt-3 font-display font-bold text-lg text-[#f7ebd2] group-hover:text-[#f8d77a]">
                    {aug.name}
                  </h3>

                  <div
                    className="mt-1.5 inline-block px-2 py-0.5 text-[11px] font-mono-num font-bold bg-[#090c11] border border-[#3a3228]"
                    style={{ color: aug.color }}
                  >
                    {aug.shortBadge}
                  </div>

                  <p className="mt-2.5 text-xs text-[#a89982] leading-relaxed">
                    {aug.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#2d323e] text-center font-display font-bold text-xs tracking-wider uppercase text-[#f8d77a]">
                  Mührü Etkinleştir
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
