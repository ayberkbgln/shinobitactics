import React, { useMemo, useState } from 'react';
import { ITEMS, SHINOBI_BY_ID } from '../game/data';
import { getItemIconDataUrl } from '../game/pixelSprites';
import {
  combineItems,
  getItemRecipesForComponent,
  isBaseComponent,
  previewItemCombineOnUnit,
} from '../game/rules';
import { ItemId, OwnedUnit } from '../game/types';

interface ItemArmoryTrayProps {
  inventoryItems: ItemId[];
  roster: OwnedUnit[];
  selectedItemIndex: number | null;
  draggedItemIndex: number | null;
  draggedItemId: ItemId | null;
  hoverItemIndex: number | null;
  onStartItemDrag: (itemIndex: number, itemId: ItemId, clientX: number, clientY: number) => void;
  onSelectItem: (index: number | null) => void;
}

export const ItemArmoryTray: React.FC<ItemArmoryTrayProps> = ({
  inventoryItems,
  roster,
  selectedItemIndex,
  draggedItemIndex,
  draggedItemId,
  hoverItemIndex,
  onStartItemDrag,
  onSelectItem,
}) => {
  const [hoveredSlotIdx, setHoveredSlotIdx] = useState<number | null>(null);

  // Collect all owned base components across bag + friendly units so the recipe matrix marks "HAZIR" crafts!
  const ownedComponentCounts = useMemo(() => {
    const counts = new Map<ItemId, number>();
    for (const it of inventoryItems) {
      if (isBaseComponent(it)) counts.set(it, (counts.get(it) ?? 0) + 1);
    }
    for (const u of roster) {
      for (const it of u.items) {
        if (isBaseComponent(it)) counts.set(it, (counts.get(it) ?? 0) + 1);
      }
    }
    return counts;
  }, [inventoryItems, roster]);

  if (inventoryItems.length === 0) return null;

  const inspectIdx =
    draggedItemIndex === null
      ? hoveredSlotIdx !== null && inventoryItems[hoveredSlotIdx]
        ? hoveredSlotIdx
        : selectedItemIndex !== null && inventoryItems[selectedItemIndex]
          ? selectedItemIndex
          : null
      : null;

  const inspectItemId = inspectIdx !== null ? inventoryItems[inspectIdx] : null;
  const inspectItem = inspectItemId ? ITEMS[inspectItemId] : null;
  const inspectRecipes =
    inspectItemId && isBaseComponent(inspectItemId)
      ? getItemRecipesForComponent(inspectItemId)
      : [];

  return (
    <div
      className="fixed left-3 bottom-3 z-25 select-none"
      aria-label="Shinobi Eşya Çantası"
      data-testid="item-rack"
    >
      {/* Floating Recipe Matrix / Artifact Inspector directly above the Armory Tray */}
      {inspectItem && inspectItemId && (
        <div
          data-testid="item-recipe-popover"
          className="absolute bottom-full left-0 mb-2 w-[300px] game-forge-card p-2.5 pointer-events-none z-40"
        >
          <div className="flex items-center gap-2 pb-1.5 border-b border-[#8a6738]/55">
            <div
              className="w-8 h-8 game-slot-recess flex items-center justify-center shrink-0"
              style={{ borderColor: inspectItem.color }}
            >
              <img
                src={getItemIconDataUrl(inspectItemId)}
                alt={inspectItem.name}
                className="w-6 h-6 pixelated"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-display font-bold text-xs text-[#fef3c7] truncate">
                  {inspectItem.name}
                </span>
                <span className="text-[9px] font-display font-bold uppercase tracking-wider text-[#d4a03a] shrink-0">
                  {inspectItem.isComponent ? 'Bileşen' : 'Efsanevi'}
                </span>
              </div>
              <div className="text-[10px] font-mono-num text-[#7dd3fc] truncate">
                {inspectItem.shortStat}
              </div>
            </div>
          </div>

          {inspectItem.isComponent && inspectRecipes.length > 0 ? (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[9px] font-display font-bold uppercase tracking-wider text-[#c9a975] mb-1">
                <span>Birleştirme Tarifleri</span>
                <span className="text-slate-400">Üst Üste Sürükle</span>
              </div>
              <div className="flex flex-col gap-1">
                {inspectRecipes.map((rec) => {
                  const partner = ITEMS[rec.partnerId];
                  const result = ITEMS[rec.resultId];
                  const neededCount = rec.partnerId === inspectItemId ? 2 : 1;
                  const canCraftNow = (ownedComponentCounts.get(rec.partnerId) ?? 0) >= neededCount;

                  return (
                    <div
                      key={rec.resultId}
                      className={`flex items-center gap-1.5 px-1.5 py-1 border ${
                        canCraftNow
                          ? 'bg-[#2a1f0e]/95 border-[#eab308]/85'
                          : 'bg-[#0b0d14]/85 border-[#3f3730]/70 opacity-80'
                      }`}
                    >
                      <img
                        src={getItemIconDataUrl(rec.partnerId)}
                        alt={partner.name}
                        className="w-4 h-4 pixelated shrink-0"
                      />
                      <span className="text-[10px] text-[#d4a03a] font-bold shrink-0">➜</span>
                      <img
                        src={getItemIconDataUrl(rec.resultId)}
                        alt={result.name}
                        className="w-5 h-5 pixelated shrink-0"
                      />
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-display font-bold text-[10px] text-[#fef3c7] truncate">
                            {result.name}
                          </span>
                          {canCraftNow && (
                            <span className="text-[8px] font-display font-bold uppercase tracking-wider text-[#facc15] shrink-0">
                              HAZIR
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] font-mono-num text-slate-300 truncate">
                          {result.shortStat}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-1.5">
              <p className="text-[11px] text-slate-300 leading-snug">{inspectItem.description}</p>
              {inspectItem.recipe && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-[#8a6738]/35 text-[10px] text-[#d4b078]">
                  <span>Tarif:</span>
                  <img
                    src={getItemIconDataUrl(inspectItem.recipe[0])}
                    alt={ITEMS[inspectItem.recipe[0]].name}
                    className="w-4 h-4 pixelated"
                  />
                  <span>+</span>
                  <img
                    src={getItemIconDataUrl(inspectItem.recipe[1])}
                    alt={ITEMS[inspectItem.recipe[1]].name}
                    className="w-4 h-4 pixelated"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Forged Iron & Bronze Shinobi Armory Tray */}
      <div className="game-console p-2 flex flex-col gap-1.5 min-w-[116px] max-w-[196px]">
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-[#7d5d33]/50">
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-[#eab308]" aria-hidden="true">
              <path
                d="M2 11h12v2H2zm2-2l1-5h6l1 5H4zm2-7h4v2H6z"
                fill="currentColor"
                stroke="#07080d"
                strokeWidth="0.8"
              />
            </svg>
            <span className="font-display font-bold text-[10px] uppercase tracking-wider text-[#e5c489]">
              Teçhizat
            </span>
          </div>
          <span className="font-mono-num text-[10px] font-bold text-[#fde047]">
            {inventoryItems.length}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {inventoryItems.map((itemId, idx) => {
            const item = ITEMS[itemId];
            const isSelected = selectedItemIndex === idx;
            const isCrafted = !item.isComponent;
            const isBeingDragged = draggedItemIndex === idx;

            const combineResultId =
              draggedItemId !== null && draggedItemIndex !== idx
                ? combineItems(draggedItemId, itemId)
                : null;
            const isCombineTarget = Boolean(combineResultId);
            const isCombineHover = hoverItemIndex === idx && isCombineTarget;

            return (
              <button
                key={`${itemId}_${idx}`}
                type="button"
                data-item-slot={idx}
                onPointerDown={(e) => {
                  if (e.button === 0) onStartItemDrag(idx, itemId, e.clientX, e.clientY);
                }}
                onMouseEnter={() => setHoveredSlotIdx(idx)}
                onMouseLeave={() => setHoveredSlotIdx((cur) => (cur === idx ? null : cur))}
                onClick={() => onSelectItem(isSelected ? null : idx)}
                aria-label={`${item.name} eşyası`}
                className={`relative game-slot-recess cursor-grab active:cursor-grabbing w-10 h-10 flex items-center justify-center transition-transform ${
                  isBeingDragged ? 'opacity-25 scale-90' : ''
                } ${
                  isCombineHover
                    ? 'border-[#fde047] bg-[#422006]/95 scale-110 forge-glow'
                    : isCombineTarget
                      ? 'border-[#eab308] bg-[#2a1d0b]/90 forge-glow'
                      : isSelected
                        ? 'border-[#38bdf8] bg-[#0e2236]'
                        : isCrafted
                          ? 'border-[#d4a03a] bg-[#21180a] hover:border-[#fde047]'
                          : 'hover:border-[#d4a03a]'
                }`}
              >
                <img
                  src={getItemIconDataUrl(itemId)}
                  alt={item.name}
                  draggable={false}
                  className="w-7 h-7 pixelated pointer-events-none"
                />

                {/* Mini corner result preview icon while dragging another component! */}
                {combineResultId && !isBeingDragged && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#07080d] border border-[#facc15] flex items-center justify-center pointer-events-none shadow-md">
                    <img
                      src={getItemIconDataUrl(combineResultId)}
                      alt=""
                      className="w-3.5 h-3.5 pixelated"
                    />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface ItemDragPreviewOverlayProps {
  draggedItemId: ItemId;
  clientX: number;
  clientY: number;
  hoverItemIndex: number | null;
  hoverUnitUid: string | null;
  inventoryItems: ItemId[];
  roster: OwnedUnit[];
}

export const ItemDragPreviewOverlay: React.FC<ItemDragPreviewOverlayProps> = ({
  draggedItemId,
  clientX,
  clientY,
  hoverItemIndex,
  hoverUnitUid,
  inventoryItems,
  roster,
}) => {
  const draggedDef = ITEMS[draggedItemId];

  // Determine exact combine OR equip preview target
  let combinePartnerId: ItemId | null = null;
  let combineResultId: ItemId | null = null;
  let targetUnitName: string | null = null;
  let unitBlockedFull = false;

  if (hoverItemIndex !== null && inventoryItems[hoverItemIndex]) {
    const partner = inventoryItems[hoverItemIndex];
    const crafted = combineItems(draggedItemId, partner);
    if (crafted) {
      combinePartnerId = partner;
      combineResultId = crafted;
    }
  } else if (hoverUnitUid) {
    const hoverUnit = roster.find((u) => u.uid === hoverUnitUid);
    if (hoverUnit) {
      targetUnitName = SHINOBI_BY_ID[hoverUnit.defId]?.name ?? hoverUnit.defId;
      const preview = previewItemCombineOnUnit(hoverUnit.items, draggedItemId);
      if (!preview.canEquip) {
        unitBlockedFull = true;
      } else if (preview.resultId && preview.partnerId) {
        combinePartnerId = preview.partnerId;
        combineResultId = preview.resultId;
      }
    }
  }

  // Keep preview card safely inside viewport even near the left/right/top edges!
  const clampedCardShiftX =
    typeof window !== 'undefined'
      ? clientX < 160
        ? 160 - clientX
        : clientX > window.innerWidth - 160
          ? window.innerWidth - 160 - clientX
          : 0
      : 0;
  const placeBelowCursor = clientY < 168;

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        left: clientX,
        top: clientY,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="relative flex flex-col items-center">
        {/* FULL TFT ITEM COMBINE PREVIEW CARD */}
        {combineResultId && combinePartnerId && (
          <div
            data-testid="live-combine-preview"
            className="absolute w-[284px] game-forge-card p-2.5"
            style={{
              left: '50%',
              transform: `translateX(calc(-50% + ${clampedCardShiftX}px))`,
              ...(placeBelowCursor ? { top: '36px' } : { bottom: '36px' }),
            }}
          >
            <div className="flex items-center justify-between text-[9px] font-display font-bold uppercase tracking-wider text-[#facc15] pb-1.5 border-b border-[#8a6738]/60">
              <span>
                {targetUnitName ? `${targetUnitName} · Eşya Birleştirme` : 'Eşya Birleştirme'}
              </span>
              <span className="text-[#fde047]">Efsanevi</span>
            </div>

            {/* Formula Row: [A] + [B] => [Result] */}
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-8 game-slot-recess border-[#7dd3fc]/70 flex items-center justify-center">
                  <img
                    src={getItemIconDataUrl(draggedItemId)}
                    alt=""
                    className="w-6 h-6 pixelated"
                  />
                </div>
                <span className="font-display font-bold text-sm text-[#e5c489]">+</span>
                <div className="w-8 h-8 game-slot-recess border-[#7dd3fc]/70 flex items-center justify-center">
                  <img
                    src={getItemIconDataUrl(combinePartnerId)}
                    alt=""
                    className="w-6 h-6 pixelated"
                  />
                </div>
                <span className="font-display font-bold text-sm text-[#facc15] px-0.5">➜</span>
              </div>

              <div className="w-11 h-11 bg-[#2b1e0a] border-2 border-[#facc15] forge-glow flex items-center justify-center shrink-0">
                <img
                  src={getItemIconDataUrl(combineResultId)}
                  alt=""
                  className="w-9 h-9 pixelated"
                />
              </div>
            </div>

            {/* Resulting Artifact Details */}
            <div className="mt-2 pt-1.5 border-t border-[#8a6738]/40">
              <div className="font-display font-bold text-sm text-[#fef3c7] leading-tight">
                {ITEMS[combineResultId].name}
              </div>
              <div className="mt-0.5 font-mono-num font-bold text-[11px] text-[#38bdf8]">
                {ITEMS[combineResultId].shortStat}
              </div>
              <p className="mt-1 text-[10px] text-slate-300 leading-snug">
                {ITEMS[combineResultId].description}
              </p>
            </div>
          </div>
        )}

        {/* EQUIP PREVIEW (When hovering a friendly unit that won't combine) */}
        {!combineResultId && targetUnitName && (
          <div
            data-testid="live-equip-preview"
            className={`absolute w-[216px] p-2 ${
              unitBlockedFull
                ? 'bg-[#2a0b0f]/98 border border-[#ef4444] shadow-[0_10px_24px_rgba(0,0,0,0.88)]'
                : 'game-plaque border-[#38bdf8]/80'
            }`}
            style={{
              left: '50%',
              transform: `translateX(calc(-50% + ${clampedCardShiftX}px))`,
              ...(placeBelowCursor ? { top: '34px' } : { bottom: '34px' }),
            }}
          >
            {unitBlockedFull ? (
              <div className="text-center">
                <div className="font-display font-bold text-[11px] text-[#fca5a5]">
                  {targetUnitName} · Yuvalar Dolu (3/3)
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-[9px] font-display font-bold uppercase tracking-wider text-[#7dd3fc]">
                  <span>{targetUnitName}</span>
                  <span>Kuşan</span>
                </div>
                <div className="mt-0.5 font-display font-bold text-xs text-[#f8fafc]">
                  {draggedDef.name}
                </div>
                <div className="font-mono-num text-[10px] text-[#fde047]">
                  {draggedDef.shortStat}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Direct floating pixel-art item icon — crisp TFT feel */}
        <img
          src={getItemIconDataUrl(draggedItemId)}
          alt=""
          className="w-11 h-11 pixelated drop-shadow-[0_6px_12px_rgba(0,0,0,0.95)]"
        />
      </div>
    </div>
  );
};
