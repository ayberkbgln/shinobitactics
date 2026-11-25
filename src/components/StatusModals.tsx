import React from 'react';
import { MAX_ROUNDS } from '../game/data';
import { RunSummary } from '../game/types';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({ onResume, onRestart, onTitle }) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-[#0d0912]/80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div className="game-console w-full max-w-sm p-6 text-center">
        <div className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-[#d9a441]">
          Savaş Duraklatıldı
        </div>
        <h2 id="pause-title" className="mt-1 font-display font-bold text-2xl text-[#f7ebd2] tracking-wide">
          Oyun Duraklatıldı
        </h2>
        <p className="mt-1.5 text-xs text-[#9c8c73]">
          Stratejini düşün veya yeni bir turnuvaya başla.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="game-bevel-btn game-bevel-btn--crimson cursor-pointer w-full py-2.5 text-[#fff7e6] font-display font-bold text-sm uppercase tracking-wider"
          >
            Devam Et
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="game-bevel-btn cursor-pointer w-full py-2.5 text-[#f0e3c6] font-display font-bold text-xs uppercase tracking-wider"
          >
            Yeniden Başlat
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="game-bevel-btn cursor-pointer w-full py-2 text-[#a89982] hover:text-[#f0e3c6] font-semibold text-xs uppercase tracking-wider"
          >
            Ana Menüye Dön
          </button>
        </div>
      </div>
    </div>
  );
};

interface GameOverModalProps {
  summary: RunSummary;
  onPlayAgain: () => void;
  onTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  summary,
  onPlayAgain,
  onTitle,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-[#05060a]/88 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
    >
      <div className="game-console w-full max-w-md p-6">
        <div className="text-center">
          <div className="text-[10px] font-display font-bold uppercase tracking-[0.22em] text-[#d9a441]">
            Turnuva Sonucu
          </div>
          <h2
            id="gameover-title"
            className={`mt-1 font-display font-bold text-3xl tracking-wide ${
              summary.victory ? 'text-[#f8d77a]' : 'text-[#f87171]'
            }`}
          >
            {summary.isOnline
              ? summary.victory
                ? '1. Kage Şampiyonu!'
                : `${summary.placement ?? ''}. Sırada Elendin`
              : summary.victory
                ? 'Kage Şampiyonu!'
                : 'Arenada Yenildin'}
          </h2>
          <p className="mt-1.5 text-xs text-[#a89982]">
            {summary.isOnline
              ? summary.victory
                ? `${summary.totalPlayers ?? 2} Kage arasından zirveye çıkıp odayı kazandın!`
                : `Tur ${summary.roundReached} aşamasında elendin (${summary.placement ?? '-'}/${summary.totalPlayers ?? 2}).`
              : summary.victory
                ? '10 turun tamamını fethedip gizli köyün en büyük stratejisti oldun!'
                : `Tur ${summary.roundReached}/${MAX_ROUNDS} aşamasında Kage canın tükendi.`}
          </p>
        </div>

        {/* 3 Tabular-Nums Mastery / Progress Metric Tiles */}
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="game-slot-recess p-3">
            <div className="text-[10px] text-[#8d7d64] uppercase tracking-wider">
              {summary.isOnline ? 'Sıralama' : 'Ulaşılan Tur'}
            </div>
            <div className="mt-1 font-mono-num font-bold text-xl text-[#f7ebd2]">
              {summary.isOnline
                ? `#${summary.placement ?? 1}/${summary.totalPlayers ?? 2}`
                : `${summary.roundReached}/${MAX_ROUNDS}`}
            </div>
          </div>
          <div className="game-slot-recess p-3">
            <div className="text-[10px] text-[#8d7d64] uppercase tracking-wider">Galibiyet</div>
            <div className="mt-1 font-mono-num font-bold text-xl text-[#4ade80]">
              {summary.wins}G · {summary.losses}M
            </div>
          </div>
          <div className="game-slot-recess p-3">
            <div className="text-[10px] text-[#8d7d64] uppercase tracking-wider">Toplam Hasar</div>
            <div className="mt-1 font-mono-num font-bold text-xl text-[#fb923c]">
              {Math.round(summary.totalDamage).toLocaleString('tr-TR')}
            </div>
          </div>
        </div>

        <div className="mt-2.5 game-slot-recess px-3.5 py-2 flex items-center justify-between text-xs text-[#e3d4b8]">
          <span>En Yüksek Yıldız: {'★'.repeat(summary.highestStar)}</span>
          <span>MVP: {summary.topUnitName}</span>
        </div>

        <div className="mt-6 flex items-center gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="game-bevel-btn game-bevel-btn--crimson cursor-pointer flex-1 py-3 text-[#fff7e6] font-display font-bold text-sm uppercase tracking-wider whitespace-nowrap"
          >
            Tekrar Oyna
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="game-bevel-btn cursor-pointer px-5 py-3 text-[#e3d4b8] font-display font-bold text-xs uppercase tracking-wider whitespace-nowrap"
          >
            Ana Menü
          </button>
        </div>
      </div>
    </div>
  );
};
