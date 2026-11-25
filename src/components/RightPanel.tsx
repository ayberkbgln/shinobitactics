import React from 'react';
import { COST_COLORS, ITEMS, SHINOBI_BY_ID, TRAITS } from '../game/data';
import { getItemIconDataUrl, getPortraitDataUrl } from '../game/pixelSprites';
import { computeUnitStats, getSellValue } from '../game/rules';
import { ActiveSynergy, ItemId, OwnedUnit, RoundPhase } from '../game/types';

export interface DamageMeterEntry {
  uid: string;
  defId: string;
  stars: number;
  damage: number;
}

export interface InspectedEnemy {
  defId: string;
  stars: 1 | 2 | 3;
  items: ItemId[];
}

export type RightDrawerTab = 'unit' | 'damage' | 'guide';

interface RightPanelProps {
  isOpen: boolean;
  activeTab: RightDrawerTab;
  phase: RoundPhase;
  selectedUnit: OwnedUnit | null;
  inspectedEnemy: InspectedEnemy | null;
  synergies: ActiveSynergy[];
  selectedItemIndex: number | null;
  damageMeter: DamageMeterEntry[];
  hasOnlineStandings?: boolean;
  onChangeTab: (tab: RightDrawerTab) => void;
  onClose: () => void;
  onSellUnit: (uid: string) => void;
  onEquipToSelected: (uid: string) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  isOpen,
  activeTab,
  phase,
  selectedUnit,
  inspectedEnemy,
  synergies,
  selectedItemIndex,
  damageMeter,
  hasOnlineStandings = false,
  onChangeTab,
  onClose,
  onSellUnit,
  onEquipToSelected,
}) => {
  const activeInspect = selectedUnit
    ? {
        defId: selectedUnit.defId,
        stars: selectedUnit.stars,
        items: selectedUnit.items,
        isEnemy: false,
        uid: selectedUnit.uid,
      }
    : inspectedEnemy
      ? {
          defId: inspectedEnemy.defId,
          stars: inspectedEnemy.stars,
          items: inspectedEnemy.items,
          isEnemy: true,
          uid: null,
        }
      : null;

  // On-demand drawer: stays hidden unless user opens Guide/Damage OR clicks a shinobi!
  if (!isOpen && !activeInspect) return null;

  const effectiveTab: RightDrawerTab =
    isOpen && (activeTab === 'guide' || activeTab === 'damage')
      ? activeTab
      : activeInspect
        ? 'unit'
        : activeTab;

  const def = activeInspect ? SHINOBI_BY_ID[activeInspect.defId] : null;
  const stats =
    activeInspect && def
      ? computeUnitStats(
          activeInspect.defId,
          activeInspect.stars,
          activeInspect.items,
          activeInspect.isEnemy ? [] : synergies,
        )
      : null;
  const maxDamage = Math.max(1, ...damageMeter.map((d) => d.damage));

  return (
    <aside
      data-testid="right-drawer"
      className={`fixed top-12 z-30 w-[262px] max-h-[calc(100vh-180px)] flex flex-col game-console overflow-hidden ${
        hasOnlineStandings ? 'right-[172px]' : 'right-3'
      }`}
      aria-label="Taktik ve Shinobi Detay Paneli"
    >
      {/* Top Forged Tab Strip + Close Button */}
      <div className="px-2.5 py-1.5 bg-gradient-to-b from-[#1a1821] to-[#101118] border-b border-[#6e522b]/70 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1">
          {activeInspect && (
            <button
              type="button"
              onClick={() => onChangeTab('unit')}
              className={`cursor-pointer px-2.5 py-1 text-[11px] font-display font-bold border transition-colors ${
                effectiveTab === 'unit'
                  ? 'bg-[#7f1d1d] text-[#fef2f2] border-[#dc2626]'
                  : 'border-transparent text-[#b8ab97] hover:text-white'
              }`}
            >
              Kart
            </button>
          )}
          <button
            type="button"
            onClick={() => onChangeTab('damage')}
            className={`cursor-pointer px-2.5 py-1 text-[11px] font-display font-bold border transition-colors ${
              effectiveTab === 'damage'
                ? 'bg-[#7f1d1d] text-[#fef2f2] border-[#dc2626]'
                : 'border-transparent text-[#b8ab97] hover:text-white'
            }`}
          >
            Hasar
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('guide')}
            className={`cursor-pointer px-2.5 py-1 text-[11px] font-display font-bold border transition-colors ${
              effectiveTab === 'guide'
                ? 'bg-[#7f1d1d] text-[#fef2f2] border-[#dc2626]'
                : 'border-transparent text-[#b8ab97] hover:text-white'
            }`}
          >
            Rehber
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Paneli Kapat"
          data-testid="close-right-drawer"
          className="cursor-pointer w-6 h-6 bg-[#171922] hover:bg-[#2a2520] border border-[#6e522b]/70 text-[#e2d6c2] hover:text-white flex items-center justify-center text-xs font-bold"
        >
          ✕
        </button>
      </div>

      {/* Drawer Content */}
      <div className="p-3 overflow-y-auto flex flex-col gap-2.5">
        {effectiveTab === 'damage' ? (
          <>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-display font-bold uppercase tracking-wider text-[#e2c799]">
                Tur Hasar Raporu
              </span>
              <span>Canlı</span>
            </div>

            {damageMeter.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 leading-relaxed">
                Savaş başladığında shinobilerinin verdiği hasar anlık olarak burada sıralanır.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {damageMeter.slice(0, 7).map((entry) => {
                  const uDef = SHINOBI_BY_ID[entry.defId];
                  const ratio = Math.min(1, entry.damage / maxDamage);
                  return (
                    <div key={entry.uid} className="flex items-center gap-2">
                      <img
                        src={getPortraitDataUrl(entry.defId)}
                        alt={uDef?.name ?? entry.defId}
                        className="w-7 h-7 rounded-md border border-slate-600 pixelated shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-100 truncate">
                            {uDef?.name} {'★'.repeat(entry.stars)}
                          </span>
                          <span className="font-mono-num text-[#fb923c] font-bold">
                            {Math.round(entry.damage)}
                          </span>
                        </div>
                        <div className="mt-0.5 h-1.5 rounded-full bg-slate-900 border border-slate-700/70 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#b91c1c] to-[#f97316] origin-left transition-transform duration-150"
                            style={{ transform: `scaleX(${ratio})` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : effectiveTab === 'unit' && activeInspect && def && stats ? (
          <>
            {/* Unit Header */}
            <div className="flex items-center gap-2.5">
              <div
                className="w-12 h-12 rounded-xl border-2 shrink-0 overflow-hidden bg-[#0a0c12]"
                style={{ borderColor: COST_COLORS[def.cost].border }}
              >
                <img
                  src={getPortraitDataUrl(def.id)}
                  alt={def.name}
                  className="w-full h-full object-cover pixelated"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-display font-bold text-sm text-[#f8fafc] truncate">
                    {def.name}
                  </span>
                  <span className="font-mono-num text-xs text-[#fde047] shrink-0">
                    {'★'.repeat(activeInspect.stars)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {activeInspect.isEnemy ? 'Rakip Birim · ' : ''}
                  {def.title}
                </div>
                <div className="text-[10px] text-[#d4b078] mt-0.5">
                  {TRAITS[def.origin].name} · {TRAITS[def.role].name}
                </div>
              </div>
            </div>

            {/* Compact Stats Grid */}
            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono-num">
              <div className="shinobi-slot px-2 py-1 flex justify-between">
                <span className="text-slate-400">CAN</span>
                <span className="text-[#4ade80] font-bold">{stats.maxHp}</span>
              </div>
              <div className="shinobi-slot px-2 py-1 flex justify-between">
                <span className="text-slate-400">ATK</span>
                <span className="text-[#fb923c] font-bold">{stats.atk}</span>
              </div>
              <div className="shinobi-slot px-2 py-1 flex justify-between">
                <span className="text-slate-400">HIZ</span>
                <span className="text-[#facc15] font-bold">{stats.atkSpeed.toFixed(2)}</span>
              </div>
              <div className="shinobi-slot px-2 py-1 flex justify-between">
                <span className="text-slate-400">ZIRH</span>
                <span className="text-[#93c5fd] font-bold">{stats.armor}</span>
              </div>
              <div className="shinobi-slot px-2 py-1 flex justify-between">
                <span className="text-slate-400">ÇAKRA</span>
                <span className="text-[#38bdf8] font-bold">
                  {stats.startMana}/{stats.maxMana}
                </span>
              </div>
              <div className="shinobi-slot px-2 py-1 flex justify-between">
                <span className="text-slate-400">MENZİL</span>
                <span className="text-slate-200 font-bold">{stats.range}</span>
              </div>
            </div>

            {/* Signature Jutsu */}
            <div className="shinobi-slot p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-display font-bold" style={{ color: def.accentColor }}>
                  {def.jutsuName}
                </span>
                <span className="text-[10px] text-slate-400">Jutsu</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-300 leading-snug">{def.jutsuDesc}</p>
            </div>

            {/* Equipped Items */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">
                Eşyalar ({activeInspect.items.length}/3)
              </span>
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((slot) => {
                  const itemId = activeInspect.items[slot];
                  const isCrafted = itemId && !ITEMS[itemId].isComponent;
                  return (
                    <div
                      key={slot}
                      className={`w-7 h-7 shinobi-slot flex items-center justify-center ${
                        isCrafted ? 'border-[#eab308]/90 bg-[#1e170a]' : ''
                      }`}
                      title={itemId ? `${ITEMS[itemId].name}: ${ITEMS[itemId].shortStat}` : 'Boş Yuva'}
                    >
                      {itemId && (
                        <img
                          src={getItemIconDataUrl(itemId)}
                          alt={ITEMS[itemId].name}
                          className="w-5 h-5 pixelated"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {!activeInspect.isEnemy &&
              activeInspect.uid &&
              selectedItemIndex !== null &&
              activeInspect.items.length <= 3 && (
                <button
                  type="button"
                  onClick={() => onEquipToSelected(activeInspect.uid!)}
                  className="shinobi-btn cursor-pointer rounded-xl w-full py-1.5 bg-[#0284c7] hover:bg-[#0ea5e9] text-white font-semibold text-xs border-[#7dd3fc]"
                >
                  Seçili Eşyayı Kuşan / Birleştir
                </button>
              )}

            {!activeInspect.isEnemy && activeInspect.uid && phase === 'prep' && (
              <button
                type="button"
                onClick={() => onSellUnit(activeInspect.uid!)}
                className="shinobi-btn cursor-pointer rounded-xl w-full py-1.5 bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fee2e2] font-semibold text-xs border-[#dc2626]"
              >
                Sat (+{getSellValue(def.cost, activeInspect.stars)} Ryo)
              </button>
            )}
          </>
        ) : (
          /* On-Demand Shinobi War Tactical Guide */
          <div className="flex flex-col gap-2 text-xs text-slate-300 leading-relaxed">
            <div className="font-display font-bold text-xs uppercase tracking-wider text-[#e2c799]">
              Savaş Taktikleri
            </div>
            <div className="shinobi-slot p-2 space-y-1.5 text-[11px]">
              <p>
                <strong className="text-[#4ade80]">Kage Hareketi (Sağ Tık):</strong> Arenada herhangi
                bir yere <strong className="text-white">sağ tıkla</strong> ve Kage’ni yürütüp düşen
                parlak ganimet kürelerini topla!
              </p>
              <p>
                <strong className="text-[#fde047]">Canavar Turları (1-2, 2-7, 3-7, 4-7):</strong>{' '}
                Tarafsız canavarları kestiğinde yere mavi, yeşil veya altın ganimet küreleri düşer.
              </p>
              <p>
                <strong className="text-[#38bdf8]">2 Bileşen = Efsanevi Eşya:</strong> Sol alttaki
                eşyaları direkt sürükleyip shinobiye bırak — iki temel bileşen birleşip 15 farklı
                efsanevi shinobi eşyasına dönüşür!
              </p>
              <p>
                <strong className="text-[#fde047]">Yıldız &amp; Faiz:</strong> 3 aynı shinobi
                otomatik ★★/★★★ olur. Her 10 Ryo, sol taş kenarda bir altın mühür yakar (+1 Ryo/tur).
              </p>
            </div>
            <div className="text-[10px] text-slate-400 font-mono-num">
              [Sağ Tık] Kage Yürüt · [D] Yenile · [F] Seviye · [W] Diz/Al · [E] Sat · [Space] Savaş
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
