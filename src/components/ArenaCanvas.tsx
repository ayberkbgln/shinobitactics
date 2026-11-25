import React, { useEffect, useRef } from 'react';
import {
  ARENA_MAPS,
  BENCH_SIZE,
  BOARD_COLS,
  BOARD_ROWS,
  PLAYER_START_ROW,
  SHINOBI_BY_ID,
} from '../game/data';
import { getBattleSprite, getFlashSprite, getItemIconCanvas } from '../game/pixelSprites';
import {
  ArenaLootOrb,
  ArenaMapId,
  CombatProjectile,
  CombatState,
  EnemyWaveDef,
  EnemyWaveUnit,
  HexCoord,
  ItemId,
  OwnedUnit,
  RoundPhase,
  StarLevel,
  UnitDirection,
} from '../game/types';
import { ITEMS } from '../game/data';
import { previewItemCombineOnUnit } from '../game/rules';

export interface MergeCelebration {
  col: number;
  row: number;
  stars: StarLevel;
  startedAt: number;
}

export interface ArenaRenderBridge {
  phase: RoundPhase;
  arenaId: ArenaMapId;
  arenaOwnerName: string | null;
  wave: EnemyWaveDef;
  playerBoardUnits: OwnedUnit[];
  playerBenchUnits: OwnedUnit[];
  playerAvatarId: string;
  playerHp: number;
  gold: number;
  maxInterest: number;
  opponentAvatarId: string | null;
  opponentName: string | null;
  scoutedOpponent: { name: string; arenaId: ArenaMapId; avatarId: string; units: EnemyWaveUnit[] } | null;
  mergeCelebrations: MergeCelebration[];
  selectedUnitUid: string | null;
  selectedItemActive: boolean;
  draggedUnitUid: string | null;
  isDraggingUnit: boolean;
  isDraggingItem: boolean;
  draggedItemId: ItemId | null;
  hoverCombineUnitUid: string | null;
  dragClientPos: { x: number; y: number } | null;
  combatState: CombatState | null;
  lootOrbs: ArenaLootOrb[];
  roundBanner: { text: string; subtext: string; tone: 'win' | 'loss' | 'merge' } | null;
}

export interface ArenaCanvasApi {
  getHexAtClientPos: (clientX: number, clientY: number) => HexCoord | null;
  getBenchSlotAtClientPos: (clientX: number, clientY: number) => number | null;
  getUnitAtClientPos: (clientX: number, clientY: number) => { uid: string; location: 'board' | 'bench' } | null;
}

interface ArenaCanvasProps {
  bridgeRef: React.MutableRefObject<ArenaRenderBridge>;
  canvasApiRef: React.MutableRefObject<ArenaCanvasApi | null>;
  onHexClick: (hex: HexCoord) => void;
  onBenchSlotClick: (benchIndex: number) => void;
  onBoardUnitPointerDown: (unit: OwnedUnit, clientX: number, clientY: number) => void;
  onCollectLootOrb: (orbId: string) => { label: string; color: string } | null;
  onTacticianMove?: () => void;
}

interface HexLayout {
  width: number;
  height: number;
  centerX: number;
  topY: number;
  bottomY: number;
  topW: number;
  bottomW: number;
  hexRadius: number; // reference mid-board radius for VFX sizing
  hexW: number;
  benchY: number;
  benchSlotW: number;
  benchSlotH: number;
  benchLeftX: number;
}

const SHOP_CLEARANCE_PX = 126;
const DEFAULT_ARENA_ASPECT = 16 / 9;

interface ArenaImageCalibration {
  imgTopY: number;
  imgBotY: number;
  imgTopW: number;
  imgBotW: number;
  imgBenchY: number;
  imgBenchW: number;
  bgZoom: number;
  bgFocusY: number;
}

const ARENA_IMAGE_CALIBRATION: Record<ArenaMapId, ArenaImageCalibration> = {
  // Exact normalized image-space calibration so hexes & bench weld 100% onto each painted stone surface!
  kanli_ay: {
    imgTopY: 0.295,
    imgBotY: 0.68,
    imgTopW: 0.41,
    imgBotW: 0.622,
    imgBenchY: 0.875,
    imgBenchW: 0.63,
    bgZoom: 1.04,
    bgFocusY: 0.54,
  },
  final_vadisi: {
    imgTopY: 0.215,
    imgBotY: 0.536,
    imgTopW: 0.355,
    imgBotW: 0.502,
    imgBenchY: 0.935,
    imgBenchW: 0.64,
    bgZoom: 1.03,
    bgFocusY: 0.51,
  },
  yagmur_kulesi: {
    imgTopY: 0.305,
    imgBotY: 0.625,
    imgTopW: 0.375,
    imgBotW: 0.532,
    imgBenchY: 0.865,
    imgBenchW: 0.58,
    bgZoom: 1.08,
    bgFocusY: 0.54,
  },
  ates_kalesi: {
    imgTopY: 0.335,
    imgBotY: 0.755,
    imgTopW: 0.4,
    imgBotW: 0.645,
    imgBenchY: 0.915,
    imgBenchW: 0.62,
    bgZoom: 1.04,
    bgFocusY: 0.57,
  },
};

function computeArenaBgRect(
  width: number,
  height: number,
  arenaId: ArenaMapId,
  imgAspect = DEFAULT_ARENA_ASPECT,
): { dx: number; dy: number; dw: number; dh: number; cal: ArenaImageCalibration } {
  const cal = ARENA_IMAGE_CALIBRATION[arenaId] ?? ARENA_IMAGE_CALIBRATION.kanli_ay;
  const stageH = Math.max(380, height - SHOP_CLEARANCE_PX);
  const viewAspect = width / stageH;
  let baseW = width;
  let baseH = stageH;
  if (viewAspect > imgAspect) {
    baseH = width / imgAspect;
  } else {
    baseW = stageH * imgAspect;
  }
  const dw = baseW * cal.bgZoom;
  const dh = baseH * cal.bgZoom;
  const dx = (width - dw) / 2;
  const dy = stageH * 0.5 - dh * cal.bgFocusY;
  return { dx, dy, dw, dh, cal };
}

function computeHexLayout(
  width: number,
  height: number,
  arenaId: ArenaMapId = 'kanli_ay',
  imgAspect = DEFAULT_ARENA_ASPECT,
): HexLayout {
  const { dx, dy, dw, dh, cal } = computeArenaBgRect(width, height, arenaId, imgAspect);
  const centerX = dx + dw * 0.5;

  const topY = Math.max(66, dy + dh * cal.imgTopY);
  const bottomY = Math.min(height - SHOP_CLEARANCE_PX - 76, dy + dh * cal.imgBotY);
  const topW = Math.min(width - 210, dw * cal.imgTopW);
  const bottomW = Math.min(width - 150, dw * cal.imgBotW);

  const midW = (topW + bottomW) * 0.5;
  const hexW = midW / (BOARD_COLS + 0.5);
  const hexRadius = Math.max(24, Math.min(54, hexW / Math.sqrt(3)));

  // Foreground bench projected directly onto the arena's painted stone ledge (always cleanly above shop bar!)
  const benchW = Math.min(width - 220, Math.max(540, dw * cal.imgBenchW));
  const benchSlotW = benchW / BENCH_SIZE;
  const benchSlotH = Math.max(36, Math.min(48, (height - SHOP_CLEARANCE_PX) * 0.062));
  const rawBenchY = dy + dh * cal.imgBenchY;
  const benchY = Math.min(height - SHOP_CLEARANCE_PX - 22, Math.max(bottomY + 62, rawBenchY));
  const benchLeftX = centerX - benchW / 2;

  return {
    width,
    height,
    centerX,
    topY,
    bottomY,
    topW,
    bottomW,
    hexRadius,
    hexW,
    benchY,
    benchSlotW,
    benchSlotH,
    benchLeftX,
  };
}

function getRowMetrics(row: number, layout: HexLayout): {
  y: number;
  rowW: number;
  cellW: number;
  hexR: number;
  depthScale: number;
  t: number;
} {
  const clamped = Math.max(-0.5, Math.min(BOARD_ROWS - 0.3, row));
  const linearT = clamped / (BOARD_ROWS - 1);
  // Subtle perspective foreshortening: distant rows sit tighter, foreground rows expand
  const t = linearT >= 0 ? Math.pow(linearT, 1.07) : linearT * 0.92;
  const y = layout.topY + (layout.bottomY - layout.topY) * t;
  const rowW = layout.topW + (layout.bottomW - layout.topW) * t;
  const cellW = rowW / (BOARD_COLS + 0.5);
  const hexR = cellW / Math.sqrt(3);
  // Gentle, natural single-pass perspective scale (0.89 back row -> 1.03 front row)
  const depthScale = 0.89 + Math.max(0, Math.min(1.1, t)) * 0.14;
  return { y, rowW, cellW, hexR, depthScale, t };
}

function hexToScreen(
  col: number,
  row: number,
  layout: HexLayout,
): { x: number; y: number; scale: number; hexR: number } {
  const m = getRowMetrics(row, layout);
  const rowFloor = Math.floor(row);
  const rowFrac = row - rowFloor;
  const off0 = (rowFloor & 1) === 1 ? 0.5 : 0;
  const off1 = ((rowFloor + 1) & 1) === 1 ? 0.5 : 0;
  const oddColShift = rowFrac === 0 ? off0 : off0 + (off1 - off0) * rowFrac;

  const leftEdge = layout.centerX - m.rowW / 2 + m.cellW * 0.5;
  return {
    x: leftEdge + (col + oddColShift) * m.cellW,
    y: m.y,
    scale: m.depthScale,
    hexR: m.hexR,
  };
}

function benchSlotToScreen(
  slotIdx: number,
  layout: HexLayout,
): { x: number; y: number; w: number; h: number } {
  return {
    x: layout.benchLeftX + (slotIdx + 0.5) * layout.benchSlotW,
    y: layout.benchY,
    w: layout.benchSlotW - 5,
    h: layout.benchSlotH,
  };
}

function screenToBenchSlot(px: number, py: number, layout: HexLayout): number | null {
  const top = layout.benchY - layout.benchSlotH * 1.15;
  const bottom = layout.benchY + layout.benchSlotH * 0.65;
  if (py < top || py > bottom) return null;
  const rel = px - layout.benchLeftX;
  if (rel < 0 || rel > layout.benchSlotW * BENCH_SIZE) return null;
  const idx = Math.floor(rel / layout.benchSlotW);
  return idx >= 0 && idx < BENCH_SIZE ? idx : null;
}

function screenToHex(px: number, py: number, layout: HexLayout): HexCoord | null {
  let best: HexCoord | null = null;
  let bestDist = Infinity;

  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const center = hexToScreen(c, r, layout);
      // Account for 2.5D flattened vertical aspect of perspective hex tiles
      const dx = px - center.x;
      const dy = (py - center.y) * 1.38;
      const d = Math.hypot(dx, dy);
      if (d < center.hexR * 0.96 && d < bestDist) {
        bestDist = d;
        best = { col: c, row: r };
      }
    }
  }
  return best;
}

function drawPerspectiveHex(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const vx = cx + Math.cos(angle) * radius;
    const vy = cy + Math.sin(angle) * radius * 0.68;
    if (i === 0) ctx.moveTo(vx, vy);
    else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
}

function draw3DBenchPedestal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  state: 'empty' | 'occupied' | 'selected' | 'hover' | 'drop' | 'itemTarget',
): void {
  // Idle bench slots stay 100% seamless with the painted 3D stone ledge — highlight ONLY on active interaction!
  if (state === 'empty' || state === 'occupied') {
    return;
  }

  const topW = w * 0.88;
  const botW = w * 0.96;
  const halfH = h * 0.42;

  ctx.beginPath();
  ctx.moveTo(cx - topW / 2, cy - halfH);
  ctx.lineTo(cx + topW / 2, cy - halfH);
  ctx.lineTo(cx + botW / 2, cy + halfH);
  ctx.lineTo(cx - botW / 2, cy + halfH);
  ctx.closePath();

  if (state === 'selected') {
    ctx.fillStyle = 'rgba(217, 154, 60, 0.16)';
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.82)';
    ctx.lineWidth = 1.6;
    ctx.fill();
    ctx.stroke();
  } else if (state === 'itemTarget') {
    ctx.fillStyle = 'rgba(14, 165, 233, 0.22)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 1.8;
    ctx.fill();
    ctx.stroke();
  } else if (state === 'drop') {
    ctx.fillStyle = 'rgba(34, 197, 94, 0.16)';
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
  } else if (state === 'hover') {
    ctx.fillStyle = 'rgba(234, 179, 8, 0.12)';
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.fill();
    ctx.stroke();
  }
}

// ---- CRISP PIXEL-GRID VFX HELPERS ----

function pRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  snap = 2,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(
    Math.round(x / snap) * snap,
    Math.round(y / snap) * snap,
    Math.max(snap, Math.round(w / snap) * snap),
    Math.max(snap, Math.round(h / snap) * snap),
  );
}

function drawPixelRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  segments: number,
  blockSize: number,
  color: string,
  rotOffset = 0,
): void {
  ctx.fillStyle = color;
  for (let i = 0; i < segments; i++) {
    const a = rotOffset + (i / segments) * Math.PI * 2;
    const px = Math.round((cx + Math.cos(a) * rx - blockSize / 2) / 2) * 2;
    const py = Math.round((cy + Math.sin(a) * ry - blockSize / 2) / 2) * 2;
    ctx.fillRect(px, py, blockSize, blockSize);
  }
}

function drawPixelBolt(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  steps: number,
  amp: number,
  seed: number,
  outerColor: string,
  innerColor: string,
  thickness = 4,
): void {
  const pts: Array<{ x: number; y: number }> = [{ x: x1, y: y1 }];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;

  for (let s = 1; s < steps; s++) {
    const frac = s / steps;
    const wave = Math.sin(s * 3.7 + seed * 11.3) * amp;
    pts.push({
      x: x1 + dx * frac + nx * wave,
      y: y1 + dy * frac + ny * wave,
    });
  }
  pts.push({ x: x2, y: y2 });

  const drawPass = (color: string, size: number) => {
    ctx.fillStyle = color;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const segLen = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const dots = Math.max(3, Math.ceil(segLen / (size * 0.85)));
      for (let d = 0; d <= dots; d++) {
        const f = d / dots;
        const px = Math.round((a.x + (b.x - a.x) * f - size / 2) / 2) * 2;
        const py = Math.round((a.y + (b.y - a.y) * f - size / 2) / 2) * 2;
        ctx.fillRect(px, py, size, size);
      }
    }
  };

  drawPass(outerColor, thickness + 3);
  drawPass(innerColor, Math.max(2, thickness - 1));
}

function drawPixelProjectile(
  ctx: CanvasRenderingContext2D,
  proj: CombatProjectile,
  layout: HexLayout,
  now: number,
): void {
  const p = hexToScreen(proj.x, proj.y, layout);
  const start = hexToScreen(proj.startX, proj.startY, layout);
  const end = hexToScreen(proj.targetX, proj.targetY, layout);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);

  // Crisp 4-step pixel motion trail behind every projectile
  const trailSteps = proj.isSpell ? 5 : 3;
  for (let i = 1; i <= trailSteps; i++) {
    const back = Math.max(0, proj.progress - i * 0.065);
    const arcLift = proj.arcHeight ? Math.sin(back * Math.PI) * proj.arcHeight : 0;
    const tx = proj.startX + (proj.targetX - proj.startX) * back;
    const ty = proj.startY + (proj.targetY - proj.startY) * back - arcLift;
    const tp = hexToScreen(tx, ty, layout);
    const sz = Math.max(2, (proj.isSpell ? 7 : 5) - i);
    ctx.save();
    ctx.globalAlpha = Math.max(0.15, 0.72 - i * 0.14);
    pRect(ctx, tp.x - sz / 2, tp.y - 14 - sz / 2, sz, sz, i === 1 ? '#ffffff' : proj.color);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y - 14));

  switch (proj.kind) {
    case 'shuriken': {
      ctx.rotate(now * 0.026);
      // 4-blade pixel steel shuriken
      pRect(ctx, -9, -3, 18, 6, '#140e1a', 1);
      pRect(ctx, -3, -9, 6, 18, '#140e1a', 1);
      pRect(ctx, -8, -2, 16, 4, '#cbd5e1', 1);
      pRect(ctx, -2, -8, 4, 16, '#cbd5e1', 1);
      pRect(ctx, -6, -1, 12, 2, '#ffffff', 1);
      pRect(ctx, -2, -2, 4, 4, '#334155', 1);
      break;
    }

    case 'kunai':
    case 'hiraishin_kunai': {
      ctx.rotate(angle);
      const isGold = proj.kind === 'hiraishin_kunai';
      pRect(ctx, -10, -4, 22, 8, '#140e1a', 1);
      pRect(ctx, -8, -1, 7, 2, isGold ? '#facc15' : '#94a3b8', 1); // handle
      pRect(ctx, -11, -3, 4, 6, isGold ? '#fde047' : '#eab308', 1); // ring
      pRect(ctx, -1, -3, 9, 6, isGold ? '#fef08a' : '#e2e8f0', 1); // blade
      pRect(ctx, 8, -2, 4, 4, '#ffffff', 1); // tip
      break;
    }

    case 'needle': {
      ctx.rotate(angle);
      pRect(ctx, -11, -2, 22, 4, '#140e1a', 1);
      pRect(ctx, -10, -1, 18, 2, '#e2e8f0', 1);
      pRect(ctx, 4, -2, 7, 4, '#c084fc', 1); // glowing venom tip
      pRect(ctx, 8, -1, 3, 2, '#f5d0fe', 1);
      break;
    }

    case 'rasen': {
      const spin = now * 0.022;
      // Swirling pixel Rasengan chakra orb
      drawPixelRing(ctx, 0, 0, 14, 14, 10, 4, '#0284c7', spin);
      drawPixelRing(ctx, 0, 0, 10, 10, 8, 4, '#38bdf8', -spin * 1.4);
      drawPixelRing(ctx, 0, 0, 6, 6, 6, 3, '#bae6fd', spin * 2);
      pRect(ctx, -4, -4, 8, 8, '#ffffff');
      // 4 orbiting pixel spiral tails
      for (let k = 0; k < 4; k++) {
        const a = spin * 1.6 + (k * Math.PI) / 2;
        pRect(ctx, Math.cos(a) * 16 - 2, Math.sin(a) * 16 - 2, 4, 4, '#e0f2fe');
      }
      break;
    }

    case 'lion_fist': {
      ctx.rotate(angle);
      // Glowing pixel-art Twin Lion chakra head surging forward!
      pRect(ctx, -14, -10, 26, 20, '#312e81');
      pRect(ctx, -12, -8, 24, 16, '#6366f1');
      pRect(ctx, -8, -6, 18, 12, '#38bdf8');
      pRect(ctx, 6, -4, 8, 8, '#e0f2fe');
      // Fierce glowing lion eyes & jaws
      pRect(ctx, 2, -5, 4, 3, '#ffffff');
      pRect(ctx, 2, 2, 4, 3, '#ffffff');
      pRect(ctx, -18, -6, 6, 4, '#818cf8');
      pRect(ctx, -18, 2, 6, 4, '#818cf8');
      break;
    }

    case 'clay_bird': {
      ctx.rotate(angle);
      const wing = Math.sin(now * 0.03) > 0 ? -9 : -4;
      // Crisp flapping pixel origami clay bird!
      pRect(ctx, -10, -4, 20, 8, '#140e1a');
      pRect(ctx, -9, -3, 18, 6, '#fef3c7');
      pRect(ctx, 7, -2, 5, 4, '#fde68a'); // beak/head
      pRect(ctx, -4, wing, 8, 6, '#fffbeb'); // upper wing
      pRect(ctx, -4, -wing - 4, 8, 6, '#f5e1b8'); // lower wing
      // Sparkling explosive fuse at tail
      pRect(ctx, -13, -2, 4, 4, now % 120 < 60 ? '#ef4444' : '#facc15');
      break;
    }

    case 'fireball': {
      ctx.rotate(angle);
      pRect(ctx, -10, -8, 18, 16, '#991b1b');
      pRect(ctx, -8, -6, 16, 12, '#ea580c');
      pRect(ctx, -4, -4, 12, 8, '#facc15');
      pRect(ctx, 0, -2, 6, 4, '#ffffff');
      pRect(ctx, -14, -4, 5, 3, '#f97316');
      pRect(ctx, -13, 2, 5, 3, '#ef4444');
      break;
    }

    case 'sand': {
      const spin = now * 0.018;
      pRect(ctx, -8, -8, 16, 16, '#92400e');
      pRect(ctx, -6, -6, 12, 12, '#d97706');
      pRect(ctx, -4, -4, 8, 8, '#fcd34d');
      drawPixelRing(ctx, 0, 0, 11, 11, 6, 3, '#fbbf24', spin);
      break;
    }

    default: {
      pRect(ctx, -5, -5, 10, 10, '#140e1a');
      pRect(ctx, -4, -4, 8, 8, proj.color);
      pRect(ctx, -2, -2, 4, 4, '#ffffff');
      break;
    }
  }

  ctx.restore();
}

export const ArenaCanvas: React.FC<ArenaCanvasProps> = ({
  bridgeRef,
  canvasApiRef,
  onHexClick,
  onBenchSlotClick,
  onBoardUnitPointerDown,
  onCollectLootOrb,
  onTacticianMove,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbacksRef = useRef({
    onHexClick,
    onBenchSlotClick,
    onBoardUnitPointerDown,
    onCollectLootOrb,
    onTacticianMove,
  });
  callbacksRef.current = {
    onHexClick,
    onBenchSlotClick,
    onBoardUnitPointerDown,
    onCollectLootOrb,
    onTacticianMove,
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const arenaKeys = Object.keys(ARENA_MAPS) as ArenaMapId[];
    const arenaImages: Record<ArenaMapId, HTMLImageElement> = {} as Record<ArenaMapId, HTMLImageElement>;
    const arenaAspects: Partial<Record<ArenaMapId, number>> = {};
    const bgCache: Partial<Record<ArenaMapId, HTMLCanvasElement>> = {};

    let width = container.clientWidth || 1280;
    let height = container.clientHeight || 720;
    let dpr = Math.min(2, window.devicePixelRatio || 1);

    const getArenaAspect = (key: ArenaMapId): number =>
      arenaAspects[key] ?? DEFAULT_ARENA_ASPECT;

    // One-time crisp 3x3 unsharp-mask sharpen pass on cached arena backdrop so pixel-art stone stays razor-sharp!
    const sharpenCanvas = (octx: CanvasRenderingContext2D, w: number, h: number, strength = 0.36) => {
      try {
        const imgData = octx.getImageData(0, 0, w, h);
        const src = new Uint8ClampedArray(imgData.data);
        const dst = imgData.data;
        const centerW = 1 + 4 * strength;
        for (let y = 1; y < h - 1; y++) {
          let rowOff = y * w * 4;
          for (let x = 1; x < w - 1; x++) {
            const idx = rowOff + x * 4;
            const up = idx - w * 4;
            const dn = idx + w * 4;
            const lf = idx - 4;
            const rt = idx + 4;
            dst[idx] = Math.max(0, Math.min(255, src[idx] * centerW - (src[up] + src[dn] + src[lf] + src[rt]) * strength));
            dst[idx + 1] = Math.max(0, Math.min(255, src[idx + 1] * centerW - (src[up + 1] + src[dn + 1] + src[lf + 1] + src[rt + 1]) * strength));
            dst[idx + 2] = Math.max(0, Math.min(255, src[idx + 2] * centerW - (src[up + 2] + src[dn + 2] + src[lf + 2] + src[rt + 2]) * strength));
          }
        }
        octx.putImageData(imgData, 0, 0);
      } catch {
        // Ignore if tainted
      }
    };

    const buildBgCache = (key: ArenaMapId, img: HTMLImageElement) => {
      if (!img.complete || img.naturalWidth === 0) return;
      const imgAspect = img.naturalWidth / img.naturalHeight;
      arenaAspects[key] = imgAspect;

      // Render backdrop at FULL NATIVE DPR resolution (never 1x CSS stretched!)
      const cacheW = Math.max(1, Math.round(width * dpr));
      const cacheH = Math.max(1, Math.round(height * dpr));
      const off = document.createElement('canvas');
      off.width = cacheW;
      off.height = cacheH;
      const octx = off.getContext('2d');
      if (!octx) return;

      octx.fillStyle = '#08090d';
      octx.fillRect(0, 0, cacheW, cacheH);

      const rect = computeArenaBgRect(width, height, key, imgAspect);
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = 'high';
      octx.drawImage(
        img,
        Math.round(rect.dx * dpr),
        Math.round(rect.dy * dpr),
        Math.round(rect.dw * dpr),
        Math.round(rect.dh * dpr),
      );

      // Apply crisp pixel-edge sharpening pass once on resize
      sharpenCanvas(octx, cacheW, cacheH, 0.34);

      // Tight bottom transition directly behind the flush-anchored TFT shop bar
      const fadeH = (SHOP_CLEARANCE_PX + 14) * dpr;
      const botGrad = octx.createLinearGradient(0, cacheH - fadeH, 0, cacheH);
      botGrad.addColorStop(0, 'rgba(8, 9, 13, 0)');
      botGrad.addColorStop(0.42, 'rgba(8, 9, 13, 0.72)');
      botGrad.addColorStop(1, 'rgba(8, 9, 13, 0.98)');
      octx.fillStyle = botGrad;
      octx.fillRect(0, cacheH - fadeH, cacheW, fadeH);

      // Subtle grimdark edge vignette so floating Synergies/Standings read crisply
      const stageH = Math.max(380, height - SHOP_CLEARANCE_PX) * dpr;
      const vig = octx.createRadialGradient(
        cacheW / 2,
        stageH * 0.5,
        Math.min(cacheW, stageH) * 0.32,
        cacheW / 2,
        stageH * 0.5,
        Math.max(cacheW, cacheH) * 0.74,
      );
      vig.addColorStop(0, 'rgba(6, 7, 12, 0.02)');
      vig.addColorStop(1, 'rgba(6, 7, 12, 0.52)');
      octx.fillStyle = vig;
      octx.fillRect(0, 0, cacheW, cacheH);

      bgCache[key] = off;
    };

    const rebuildAllBgCaches = () => {
      for (const key of arenaKeys) {
        delete bgCache[key];
        if (arenaImages[key]) buildBgCache(key, arenaImages[key]);
      }
    };

    for (const key of arenaKeys) {
      const img = new Image();
      img.src = ARENA_MAPS[key].imageUrl;
      img.onload = () => buildBgCache(key, img);
      arenaImages[key] = img;
    }

    const resize = () => {
      width = Math.max(320, container.clientWidth);
      height = Math.max(240, container.clientHeight);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      rebuildAllBgCaches();
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const getActiveArenaId = (): ArenaMapId => {
      const b = bridgeRef.current;
      return b.scoutedOpponent?.arenaId ?? b.arenaId;
    };

    const getActiveLayout = (): HexLayout => {
      const id = getActiveArenaId();
      return computeHexLayout(width, height, id, getArenaAspect(id));
    };

    // Movable Kage Tactician state (TFT right-click navigation + Loot Orb collection!)
    const tactician = {
      x: 180,
      y: 620,
      targetX: 180,
      targetY: 620,
      dir: 'down' as UnitDirection,
      moving: false,
      userMoved: false,
      ripples: [] as Array<{ x: number; y: number; age: number; duration: number }>,
      pickupBursts: [] as Array<{
        x: number;
        y: number;
        color: string;
        label: string;
        age: number;
        duration: number;
      }>,
    };

    const moveTacticianTo = (px: number, py: number) => {
      const clampedX = Math.max(54, Math.min(width - 54, px));
      const clampedY = Math.max(76, Math.min(height - SHOP_CLEARANCE_PX - 14, py));
      tactician.targetX = clampedX;
      tactician.targetY = clampedY;
      tactician.moving = true;
      tactician.userMoved = true;
      tactician.ripples.push({ x: clampedX, y: clampedY, age: 0, duration: 0.48 });
      callbacksRef.current.onTacticianMove?.();
    };

    canvasApiRef.current = {
      getHexAtClientPos: (clientX: number, clientY: number) => {
        const rect = canvas.getBoundingClientRect();
        if (
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          return null;
        }
        return screenToHex(clientX - rect.left, clientY - rect.top, getActiveLayout());
      },
      getBenchSlotAtClientPos: (clientX: number, clientY: number) => {
        const rect = canvas.getBoundingClientRect();
        if (
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          return null;
        }
        return screenToBenchSlot(clientX - rect.left, clientY - rect.top, getActiveLayout());
      },
      getUnitAtClientPos: (clientX: number, clientY: number) => {
        const rect = canvas.getBoundingClientRect();
        if (
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          return null;
        }
        const lx = clientX - rect.left;
        const ly = clientY - rect.top;
        const layout = getActiveLayout();
        const bridge = bridgeRef.current;

        // 1. Check bench units (always available in prep & combat)
        const bSlot = screenToBenchSlot(lx, ly, layout);
        if (bSlot !== null) {
          const bu = bridge.playerBenchUnits.find((u) => u.benchIndex === bSlot);
          if (bu) return { uid: bu.uid, location: 'bench' };
        }

        // 2. During combat, check live moving player combat units so TFT mid-combat item slamming works!
        if (bridge.phase === 'combat' && bridge.combatState) {
          let bestUid: string | null = null;
          let bestDist = 48;
          for (const cu of bridge.combatState.units) {
            if (cu.team !== 'player' || !cu.alive) continue;
            const pos = hexToScreen(cu.x + cu.lungeX, cu.y + cu.lungeY, layout);
            const d = Math.hypot(lx - pos.x, ly - (pos.y - 24));
            if (d < bestDist) {
              bestDist = d;
              bestUid = cu.uid;
            }
          }
          if (bestUid) return { uid: bestUid, location: 'board' };
        }

        // 3. During prep, check board hexes
        const hex = screenToHex(lx, ly, layout);
        if (hex && hex.row >= PLAYER_START_ROW) {
          const pu = bridge.playerBoardUnits.find(
            (u) => u.hex?.col === hex.col && u.hex?.row === hex.row,
          );
          if (pu) return { uid: pu.uid, location: 'board' };
        }
        return null;
      },
    };

    // Ambient dark weather particles (embers / rain / ash)
    const weatherDots = Array.from({ length: 30 }, (_, i) => ({
      x: (i * 113) % 1440,
      y: (i * 71) % 900,
      speed: 0.75 + (i % 5) * 0.24,
      size: i % 3 === 0 ? 4 : 3,
      phase: i * 0.9,
    }));

    let hoverHex: HexCoord | null = null;
    let hoverBenchSlot: number | null = null;
    let pointerDownPos: { x: number; y: number } | null = null;

    const getCanvasPos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handlePointerMove = (e: PointerEvent) => {
      const pos = getCanvasPos(e);
      const layout = getActiveLayout();
      hoverBenchSlot = screenToBenchSlot(pos.x, pos.y, layout);
      hoverHex = hoverBenchSlot === null ? screenToHex(pos.x, pos.y, layout) : null;
    };

    const handlePointerDown = (e: PointerEvent) => {
      const pos = getCanvasPos(e);
      const bridge = bridgeRef.current;

      // TFT Right-Click: Move Kage Tactician directly to clicked coordinate on the arena!
      if (e.button === 2) {
        e.preventDefault();
        if (!bridge.scoutedOpponent) {
          moveTacticianTo(pos.x, pos.y);
        }
        return;
      }

      if (e.button !== 0) return;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      const layout = getActiveLayout();

      // Clicking directly on a glowing Loot Orb sends the Kage Tactician running to collect it!
      if (!bridge.scoutedOpponent && !bridge.selectedItemActive && bridge.lootOrbs.length > 0) {
        for (const orb of bridge.lootOrbs) {
          const op = hexToScreen(orb.col, orb.row, layout);
          if (Math.hypot(pos.x - op.x, pos.y - (op.y - 6)) <= 32) {
            moveTacticianTo(op.x, op.y);
            pointerDownPos = null;
            return;
          }
        }
      }

      // 1. Check live 3D bench pedestals first (draggable in Prep!)
      const bSlot = screenToBenchSlot(pos.x, pos.y, layout);
      if (bSlot !== null && bridge.phase === 'prep' && !bridge.selectedItemActive) {
        const benchUnit = bridge.playerBenchUnits.find((u) => u.benchIndex === bSlot);
        if (benchUnit) {
          callbacksRef.current.onBoardUnitPointerDown(benchUnit, e.clientX, e.clientY);
          return;
        }
      }

      // 2. Check player arena hexes
      const hex = screenToHex(pos.x, pos.y, layout);
      if (
        hex &&
        bridge.phase === 'prep' &&
        !bridge.scoutedOpponent &&
        hex.row >= PLAYER_START_ROW &&
        !bridge.selectedItemActive
      ) {
        const unit = bridge.playerBoardUnits.find(
          (u) => u.hex && u.hex.col === hex.col && u.hex.row === hex.row,
        );
        if (unit) {
          callbacksRef.current.onBoardUnitPointerDown(unit, e.clientX, e.clientY);
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const down = pointerDownPos;
      pointerDownPos = null;
      if (!down) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) >= 6) return;

      const pos = getCanvasPos(e);
      const layout = getActiveLayout();
      const bSlot = screenToBenchSlot(pos.x, pos.y, layout);
      if (bSlot !== null) {
        callbacksRef.current.onBenchSlotClick(bSlot);
        return;
      }
      const hex = screenToHex(pos.x, pos.y, layout);
      if (hex) {
        callbacksRef.current.onHexClick(hex);
      }
    };

    const handlePointerLeave = () => {
      hoverHex = null;
      hoverBenchSlot = null;
      pointerDownPos = null;
    };

    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerLeave);

    let rafId = 0;
    let lastTime = performance.now();

    const drawUnit = (
      defId: string,
      stars: StarLevel,
      team: 'player' | 'enemy',
      sx: number,
      sy: number,
      hexR: number,
      opts: {
        hp: number;
        maxHp: number;
        ghostHp: number;
        shield: number;
        mana: number;
        maxMana: number;
        anim: 'idle' | 'walk' | 'attack' | 'cast' | 'ko';
        dir: UnitDirection;
        animProgress?: number; // 0..1 progress through attack/cast/ko
        hitFlash: boolean;
        stunned: boolean;
        burning: boolean;
        koTimer: number;
        koDuration?: number;
        selected: boolean;
        dimmed?: boolean;
        isBench?: boolean;
        depthScale?: number;
        items: ItemId[];
        forgePreview?: { resultId: ItemId; hovered: boolean } | null;
        now: number;
      },
    ) => {
      const phaseSeed = (defId.charCodeAt(0) + defId.charCodeAt(defId.length - 1)) * 0.7;
      let frameIdx = 0;
      if (opts.anim === 'idle') {
        frameIdx = Math.floor((opts.now * 0.004 + phaseSeed) % 4);
      } else if (opts.anim === 'walk') {
        frameIdx = Math.floor((opts.now * 0.0115 + phaseSeed) % 4);
      } else if (opts.anim === 'attack' || opts.anim === 'cast') {
        const p = Math.max(0, Math.min(0.999, opts.animProgress ?? 0));
        frameIdx = Math.floor(p * 4);
      } else if (opts.anim === 'ko') {
        const koDur = opts.koDuration ?? 0.85;
        const p = Math.max(0, Math.min(0.999, 1 - opts.koTimer / Math.max(0.01, koDur)));
        frameIdx = Math.floor(p * 5);
      }

      const sprite = getBattleSprite(defId, opts.anim, frameIdx, opts.dir);
      const scaleMult = opts.depthScale ?? 1;
      // Up-close bold TFT shinobi stature (standing body ~82..98px inside 180x140 frame -> zero clipping of Rasengan/swords/kicks!)
      const baseH = Math.max(108, Math.min(132, hexR * 2.58));
      const drawH = Math.round(baseH * scaleMult);
      const drawW = Math.round(drawH * (sprite.width / Math.max(1, sprite.height)));
      const footY = sy + hexR * (opts.isBench ? 0.2 : 0.28);
      // Subtle 3px airborne stride lift on odd walk frames for crisp rhythmic footfalls
      const strideLift = opts.anim === 'walk' && frameIdx % 2 === 1 ? -3 : 0;

      ctx.save();
      if (opts.anim === 'ko' && frameIdx >= 4) {
        const koDur = opts.koDuration ?? 0.85;
        ctx.globalAlpha = Math.max(0.15, (opts.koTimer / Math.max(0.01, koDur)) * 3.5);
      } else if (opts.dimmed) {
        ctx.globalAlpha = 0.28;
      }

      // Grounded 3D contact shadow beneath stepping feet
      if (opts.anim !== 'ko' || frameIdx < 4) {
        ctx.fillStyle = 'rgba(4, 5, 10, 0.68)';
        ctx.beginPath();
        ctx.ellipse(sx, footY, drawH * 0.2, drawH * 0.072, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cast rising pixel chakra ring on ground during jutsu release
      if (opts.anim === 'cast') {
        const accent = SHINOBI_BY_ID[defId]?.accentColor ?? '#38bdf8';
        drawPixelRing(ctx, sx, footY - 2, drawH * 0.28, drawH * 0.105, 12, 4, accent, opts.now * 0.01);
        for (let k = 0; k < 5; k++) {
          const wy = (opts.now * 0.09 + k * 14) % 44;
          const wx = sx + Math.sin(opts.now * 0.015 + k * 2.1) * (drawH * 0.18);
          pRect(ctx, wx - 2, footY - wy, 4, 4, k % 2 === 0 ? '#ffffff' : accent);
        }
      }

      // Star aura / selection ring on stone floor
      if ((stars >= 2 || opts.selected) && opts.anim !== 'ko') {
        ctx.strokeStyle = opts.selected
          ? '#fde047'
          : stars === 3
            ? '#f97316'
            : '#d99a3c';
        ctx.lineWidth = stars === 3 || opts.selected ? 2.2 : 1.5;
        ctx.beginPath();
        ctx.ellipse(sx, footY - 1, drawH * 0.22, drawH * 0.085, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Live TFT Item Combine Forge Halo beneath compatible friendly shinobi while dragging a component!
      if (opts.forgePreview && opts.anim !== 'ko') {
        const pulse = 0.5 + 0.5 * Math.sin(opts.now * 0.011);
        const haloR = drawH * (opts.forgePreview.hovered ? 0.31 : 0.25 + pulse * 0.03);
        drawPixelRing(
          ctx,
          sx,
          footY - 1,
          haloR,
          haloR * 0.4,
          16,
          opts.forgePreview.hovered ? 4 : 3,
          opts.forgePreview.hovered ? '#fef08a' : '#facc15',
          opts.now * 0.008,
        );
      }

      // Crisp 1:1 pixel-art frame blit (feet locked at y=136/140 -> align cleanly onto footY)
      const blitX = Math.round(sx - drawW / 2);
      const blitY = Math.round(footY - drawH * 0.965 + strideLift);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, blitX, blitY, drawW, drawH);

      if ((opts.hitFlash || (opts.anim === 'ko' && frameIdx === 0)) && opts.anim !== 'ko') {
        const flashSprite = getFlashSprite(defId, opts.anim, frameIdx, opts.dir);
        ctx.globalAlpha = 0.72;
        ctx.drawImage(flashSprite, blitX, blitY, drawW, drawH);
      } else if (opts.anim === 'ko' && frameIdx === 0) {
        const flashSprite = getFlashSprite(defId, opts.anim, frameIdx, opts.dir);
        ctx.globalAlpha = 0.55;
        ctx.drawImage(flashSprite, blitX, blitY, drawW, drawH);
      }
      ctx.restore();

      if (opts.anim === 'ko' || opts.dimmed) return;

      // Overhead bars anchored neatly right above standing head (104/140 = 74.3% above footY)
      const headTopY = Math.round(footY - drawH * 0.76);

      // On 3D Bench: TFT clean silhouette (star crown + item diamonds, no cluttered HP bar!)
      if (opts.isBench) {
        const crownY = headTopY - 2;
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = stars === 3 ? '#fb923c' : stars === 2 ? '#fde047' : '#cbd5e1';
        ctx.strokeStyle = '#07080d';
        ctx.lineWidth = 3;
        const starStr = '★'.repeat(stars);
        ctx.strokeText(starStr, sx, crownY);
        ctx.fillText(starStr, sx, crownY);

        if (opts.items.length > 0) {
          const iconSz = 12;
          const gap = 2;
          const totalW = opts.items.length * iconSz + (opts.items.length - 1) * gap;
          const startX = Math.round(sx - totalW / 2);
          ctx.imageSmoothingEnabled = false;
          for (let i = 0; i < opts.items.length; i++) {
            const itemId = opts.items[i];
            const ix = startX + i * (iconSz + gap);
            const iy = crownY + 3;
            const isCrafted = ITEMS[itemId] && !ITEMS[itemId].isComponent;
            ctx.fillStyle = '#07080d';
            ctx.fillRect(ix - 1, iy - 1, iconSz + 2, iconSz + 2);
            ctx.strokeStyle = isCrafted ? '#facc15' : '#38bdf8';
            ctx.lineWidth = 1;
            ctx.strokeRect(ix - 0.5, iy - 0.5, iconSz + 1, iconSz + 1);
            const iconCanvas = getItemIconCanvas(itemId);
            if (iconCanvas) ctx.drawImage(iconCanvas, ix, iy, iconSz, iconSz);
          }
        }

        // Overhead resulting-artifact preview badge when dragging a compatible base component
        if (opts.forgePreview) {
          const badgeSz = opts.forgePreview.hovered ? 26 : 20;
          const bx = Math.round(sx - badgeSz / 2);
          const by = Math.round(crownY - badgeSz - 8);
          ctx.fillStyle = '#1d1407';
          ctx.fillRect(bx - 2, by - 2, badgeSz + 4, badgeSz + 4);
          ctx.strokeStyle = opts.forgePreview.hovered ? '#fef08a' : '#facc15';
          ctx.lineWidth = 2;
          ctx.strokeRect(bx - 1, by - 1, badgeSz + 2, badgeSz + 2);
          ctx.imageSmoothingEnabled = false;
          const resIcon = getItemIconCanvas(opts.forgePreview.resultId);
          if (resIcon) ctx.drawImage(resIcon, bx, by, badgeSz, badgeSz);
        }
        return;
      }

      // TFT Segmented Dark-Steel Overhead HP + Mana Bar (uniform scale)
      const barW = Math.round(Math.max(48, Math.min(68, drawH * 0.58)));
      const barH = 7;
      const barX = Math.round(sx - barW / 2);
      const barY = headTopY - 8;

      // Star Tier Crown
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = stars === 3 ? '#fb923c' : stars === 2 ? '#fde047' : '#cbd5e1';
      ctx.strokeStyle = '#07080d';
      ctx.lineWidth = 3;
      const starStr = '★'.repeat(stars);
      ctx.strokeText(starStr, sx, barY - 3);
      ctx.fillText(starStr, sx, barY - 3);

      // Dark obsidian steel bezel
      ctx.fillStyle = '#06070b';
      ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 7);
      ctx.fillStyle = '#1b1f2c';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 5);

      // Ghost drain trail
      const ghostRatio = Math.max(0, Math.min(1, opts.ghostHp / opts.maxHp));
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(barX, barY, Math.round(barW * ghostRatio), barH);

      // Current HP fill (Emerald vs Blood Crimson)
      const hpRatio = Math.max(0, Math.min(1, opts.hp / opts.maxHp));
      ctx.fillStyle = team === 'player' ? '#22c55e' : '#dc2626';
      ctx.fillRect(barX, barY, Math.round(barW * hpRatio), barH);

      // Top highlight strip for crisp TFT steel polish
      ctx.fillStyle = team === 'player' ? 'rgba(134, 239, 172, 0.45)' : 'rgba(252, 165, 165, 0.4)';
      ctx.fillRect(barX, barY, Math.round(barW * hpRatio), 2);

      // TFT 250-HP vertical segment tick dividers
      const segments = Math.max(2, Math.min(10, Math.floor(opts.maxHp / 250)));
      ctx.fillStyle = 'rgba(6, 7, 11, 0.72)';
      for (let s = 1; s < segments; s++) {
        const tickX = barX + Math.round((barW * s) / segments);
        ctx.fillRect(tickX, barY, 1, barH);
      }

      // Shield overlay
      if (opts.shield > 0) {
        const shieldRatio = Math.min(1, opts.shield / opts.maxHp);
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(barX, barY, Math.round(barW * shieldRatio), 2.5);
      }

      // Mana Bar
      const manaRatio = Math.max(0, Math.min(1, opts.mana / opts.maxMana));
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(barX, barY + barH + 1, barW, 2.5);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(barX, barY + barH + 1, Math.round(barW * manaRatio), 2.5);

      // Real crisp pixel-art equipped item icons neatly beside/above HP bar (like TFT!)
      if (opts.items.length > 0) {
        const iconSz = 12;
        const gap = 2;
        ctx.imageSmoothingEnabled = false;
        for (let i = 0; i < opts.items.length; i++) {
          const itemId = opts.items[i];
          const ix = barX + barW + 4 + i * (iconSz + gap);
          const iy = barY - 2;
          const isCrafted = ITEMS[itemId] && !ITEMS[itemId].isComponent;
          ctx.fillStyle = '#07080d';
          ctx.fillRect(ix - 1, iy - 1, iconSz + 2, iconSz + 2);
          ctx.strokeStyle = isCrafted ? '#facc15' : '#38bdf8';
          ctx.lineWidth = 1;
          ctx.strokeRect(ix - 0.5, iy - 0.5, iconSz + 1, iconSz + 1);
          const iconCanvas = getItemIconCanvas(itemId);
          if (iconCanvas) ctx.drawImage(iconCanvas, ix, iy, iconSz, iconSz);
        }
      }

      if (opts.stunned) {
        const angle = opts.now * 0.009;
        pRect(ctx, sx + Math.cos(angle) * 14 - 2, barY - 12, 4, 4, '#fde047');
        pRect(ctx, sx + Math.cos(angle + Math.PI) * 14 - 2, barY - 12, 4, 4, '#ffffff');
      }
      if (opts.burning) {
        const flicker = Math.sin(opts.now * 0.025) * 3;
        pRect(ctx, sx - 8, sy - 8 + flicker, 4, 6, '#18181b');
        pRect(ctx, sx - 7, sy - 7 + flicker, 2, 4, '#ef4444');
        pRect(ctx, sx + 5, sy - 12 - flicker, 4, 5, '#fb923c');
      }

      // Overhead resulting-artifact preview badge on board unit while dragging a compatible component!
      if (opts.forgePreview) {
        const badgeSz = opts.forgePreview.hovered ? 26 : 20;
        const bx = Math.round(sx - badgeSz / 2);
        const by = Math.round(barY - badgeSz - 16);
        ctx.fillStyle = '#1d1407';
        ctx.fillRect(bx - 2, by - 2, badgeSz + 4, badgeSz + 4);
        ctx.strokeStyle = opts.forgePreview.hovered ? '#fef08a' : '#facc15';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - 1, by - 1, badgeSz + 2, badgeSz + 2);
        ctx.imageSmoothingEnabled = false;
        const resIcon = getItemIconCanvas(opts.forgePreview.resultId);
        if (resIcon) ctx.drawImage(resIcon, bx, by, badgeSz, badgeSz);
      }
    };

    const drawVfx = (combat: CombatState, layout: HexLayout, now: number) => {
      for (const v of combat.vfx) {
        const t = Math.min(1, v.age / v.duration);
        const pos = hexToScreen(v.x, v.y, layout);
        const r = layout.hexRadius * v.scale;

        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t * 0.88);

        switch (v.kind) {
          case 'cast_seal': {
            // Expanding octagonal pixel chakra seal + glowing corner runes under caster
            const rx = r * (0.45 + t * 0.52);
            const ry = rx * 0.48;
            drawPixelRing(ctx, pos.x, pos.y + layout.hexRadius * 0.34, rx, ry, 16, 3, v.color, t * 2.5);
            drawPixelRing(ctx, pos.x, pos.y + layout.hexRadius * 0.34, rx * 0.6, ry * 0.6, 8, 3, '#ffffff', -t * 3.5);
            break;
          }

          case 'melee_slash': {
            // Crisp curved 3-layer pixel blade crescent sweeping across target
            const target = hexToScreen(v.tx ?? v.x, v.ty ?? v.y, layout);
            const baseAngle = Math.atan2(target.y - pos.y, target.x - pos.x);
            const sweep = -1.1 + t * 2.2;
            const arcR = r * 0.72;
            for (let k = -4; k <= 4; k++) {
              const a = baseAngle + sweep + k * 0.14;
              const sx = target.x + Math.cos(a) * arcR * 0.62;
              const sy = target.y - 12 + Math.sin(a) * arcR * 0.55;
              const sz = 6 - Math.abs(k) * 0.5;
              pRect(ctx, sx - sz / 2, sy - sz / 2, sz + 2, sz + 2, '#140e1a');
              pRect(ctx, sx - sz / 2, sy - sz / 2, sz, sz, Math.abs(k) <= 1 ? '#ffffff' : v.color);
            }
            break;
          }

          case 'rasen_burst': {
            // Spinning multi-arm pixel Rasengan vortex + crater shockwave + flying cyan shards
            const rad = r * (0.4 + t * 1.05);
            drawPixelRing(ctx, pos.x, pos.y - 10, rad, rad * 0.88, 22, 4, '#0284c7', t * 8);
            drawPixelRing(ctx, pos.x, pos.y - 10, rad * 0.72, rad * 0.64, 16, 4, '#38bdf8', -t * 11);
            drawPixelRing(ctx, pos.x, pos.y - 10, rad * 0.38, rad * 0.34, 10, 4, '#ffffff', t * 14);
            // 4 spiraling wind-chakra pixel blades
            for (let arm = 0; arm < 4; arm++) {
              for (let s = 1; s <= 5; s++) {
                const a = t * 12 + (arm * Math.PI) / 2 + s * 0.35;
                const d = (s / 5) * rad * 1.1;
                pRect(
                  ctx,
                  pos.x + Math.cos(a) * d - 2,
                  pos.y - 10 + Math.sin(a) * d * 0.82 - 2,
                  5 - s * 0.5,
                  5 - s * 0.5,
                  s <= 2 ? '#ffffff' : '#7dd3fc',
                );
              }
            }
            break;
          }

          case 'chidori_arc': {
            // Multi-branch jagged pixel Chidori lightning spear + crackling target shock cage
            const target = hexToScreen(v.tx ?? v.x, v.ty ?? v.y, layout);
            const seed = Math.floor(now / 45);
            drawPixelBolt(ctx, pos.x, pos.y - 12, target.x, target.y - 12, 8, 16, seed, '#0284c7', '#e0f2fe', 5);
            drawPixelBolt(ctx, pos.x, pos.y - 12, target.x, target.y - 12, 7, 22, seed + 5, '#38bdf8', '#ffffff', 3);
            // Crackling lightning burst cage at impact
            for (let k = 0; k < 5; k++) {
              const a = (k / 5) * Math.PI * 2 + seed;
              drawPixelBolt(
                ctx,
                target.x,
                target.y - 12,
                target.x + Math.cos(a) * r * 0.65,
                target.y - 12 + Math.sin(a) * r * 0.55,
                4,
                7,
                seed + k,
                '#38bdf8',
                '#ffffff',
                2,
              );
            }
            break;
          }

          case 'raikiri_beam': {
            // Piercing electric Raikiri lance + vertical sky thunderbolt pillar on target!
            const target = hexToScreen(v.tx ?? v.x, v.ty ?? v.y, layout);
            const seed = Math.floor(now / 40);
            drawPixelBolt(ctx, pos.x, pos.y - 14, target.x, target.y - 14, 9, 10, seed, '#2563eb', '#ffffff', 6);
            // Sky-to-ground pixel thunder pillar
            drawPixelBolt(ctx, target.x, target.y - 170, target.x, target.y + 8, 10, 14, seed + 3, '#38bdf8', '#ffffff', 7);
            drawPixelRing(ctx, target.x, target.y + 6, r * (0.4 + t * 0.7), r * 0.35, 16, 4, '#93c5fd', t * 6);
            break;
          }

          case 'lotus_slash': {
            // Emerald 8-Gates steam burst + 3 staggered diagonal green kick slashes
            for (let s = 0; s < 3; s++) {
              const prog = Math.min(1, Math.max(0, (t - s * 0.14) * 2.2));
              if (prog <= 0) continue;
              const angle = -0.9 + s * 0.95;
              const len = r * 0.95;
              const x1 = pos.x - Math.cos(angle) * len;
              const y1 = pos.y - 12 - Math.sin(angle) * len * 0.7;
              const x2 = pos.x + Math.cos(angle) * len;
              const y2 = pos.y - 12 + Math.sin(angle) * len * 0.7;
              drawPixelBolt(ctx, x1, y1, x2, y2, 6, 4, s + 1, '#16a34a', '#bbf7d0', 5);
            }
            drawPixelRing(ctx, pos.x, pos.y - 6, r * (0.45 + t * 0.8), r * 0.45, 14, 4, '#4ade80', t * 9);
            break;
          }

          case 'sakura_storm': {
            // Seismic ground fissures + swirling vortex of crisp pink pixel sakura petals
            const rad = r * (0.35 + t * 1.1);
            drawPixelRing(ctx, pos.x, pos.y + 6, rad, rad * 0.48, 18, 4, '#f472b6', t * 5);
            for (let k = 0; k < 14; k++) {
              const a = t * 8 + (k / 14) * Math.PI * 2;
              const pr = rad * (0.4 + (k % 3) * 0.25);
              const px = pos.x + Math.cos(a) * pr;
              const py = pos.y - 12 - t * 28 + Math.sin(a) * pr * 0.5;
              pRect(ctx, px, py, 6, 4, k % 2 === 0 ? '#f9a8d4' : '#ffffff');
            }
            break;
          }

          case 'heal_ring': {
            // Expanding pixel blessing ring + rising green pixel heal '+' crosses
            const rad = r * (0.35 + t * 0.65);
            drawPixelRing(ctx, pos.x, pos.y + 8, rad, rad * 0.45, 14, 4, v.color, -t * 5);
            for (let k = 0; k < 4; k++) {
              const a = (k / 4) * Math.PI * 2 + t * 2;
              const cx = pos.x + Math.cos(a) * (r * 0.42);
              const cy = pos.y - 6 - t * 34 + (k % 2) * 8;
              pRect(ctx, cx - 1, cy - 5, 3, 11, '#4ade80', 1);
              pRect(ctx, cx - 5, cy - 1, 11, 3, '#4ade80', 1);
            }
            break;
          }

          case 'lion_burst': {
            // Octagonal Byakugan 64-Palms pixel dome + glowing blue-violet lion aura rings
            const rad = r * (0.4 + t * 0.85);
            drawPixelRing(ctx, pos.x, pos.y + 8, rad, rad * 0.5, 16, 4, '#818cf8', t * 4);
            drawPixelRing(ctx, pos.x, pos.y - 10, rad * 0.7, rad * 0.7, 12, 4, '#38bdf8', -t * 8);
            // Twin chakra lion sparks orbiting
            for (let side = -1; side <= 1; side += 2) {
              const lx = pos.x + side * rad * 0.55;
              const ly = pos.y - 16 - Math.sin(t * Math.PI) * 12;
              pRect(ctx, lx - 6, ly - 6, 12, 12, '#6366f1');
              pRect(ctx, lx - 4, ly - 4, 8, 8, '#bae6fd');
            }
            break;
          }

          case 'poison_cloud': {
            // Bubbling toxic purple & acid-green pixel venom cloud
            const rad = r * (0.3 + t * 0.72);
            for (let k = 0; k < 10; k++) {
              const a = (k / 10) * Math.PI * 2 + t * 2.2;
              const d = rad * (0.35 + (k % 3) * 0.25);
              const px = pos.x + Math.cos(a) * d;
              const py = pos.y - 10 + Math.sin(a) * d * 0.65 - t * 14;
              pRect(ctx, px - 6, py - 6, 12, 12, k % 3 === 0 ? '#4c1d95' : '#7e22ce');
              pRect(ctx, px - 3, py - 3, 6, 6, k % 2 === 0 ? '#c084fc' : '#a3e635');
            }
            break;
          }

          case 'shadow_line': {
            // Creeping jagged pitch-black pixel shadow tendril along floor + binding ink ring!
            const target = hexToScreen(v.tx ?? v.x, v.ty ?? v.y, layout);
            const reach = Math.min(1, t * 2.6);
            const ex = pos.x + (target.x - pos.x) * reach;
            const ey = pos.y + 10 + (target.y - pos.y) * reach;
            drawPixelBolt(ctx, pos.x, pos.y + 10, ex, ey, 10, 8, 2, '#09090b', '#475569', 6);
            if (reach >= 0.85) {
              drawPixelRing(ctx, target.x, target.y + 8, r * 0.55, r * 0.28, 14, 5, '#09090b', t * 3);
              drawPixelRing(ctx, target.x, target.y + 8, r * 0.42, r * 0.22, 10, 3, '#94a3b8', -t * 4);
            }
            break;
          }

          case 'sand_pillar': {
            // Towering desert pixel sand vortex crushing upward around target!
            const heightPx = r * 1.85 * Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5);
            const bands = 8;
            for (let b = 0; b < bands; b++) {
              const frac = b / bands;
              const bw = r * (0.35 + frac * 0.55) * (1 - t * 0.25);
              const by = pos.y + 12 - frac * heightPx;
              const sway = Math.sin(t * 14 + b * 1.1) * 7;
              pRect(ctx, pos.x - bw + sway, by - 4, bw * 2, 6, b % 2 === 0 ? '#b45309' : '#d97706');
              pRect(ctx, pos.x - bw * 0.7 + sway, by - 3, bw * 1.4, 3, '#fcd34d');
            }
            drawPixelRing(ctx, pos.x, pos.y + 10, r * (0.5 + t * 0.7), r * 0.35, 16, 4, '#f59e0b', t * 7);
            break;
          }

          case 'clay_boom': {
            // Iconic 4-layer pixel C3 fireball explosion + shockwave ring + rising dark smoke!
            const rad = r * (0.35 + Math.sin(t * Math.PI * 0.65) * 1.05);
            // Outer dark smoke puffs
            for (let k = 0; k < 10; k++) {
              const a = (k / 10) * Math.PI * 2 + 0.3;
              const sx = pos.x + Math.cos(a) * rad * 0.9;
              const sy = pos.y - 10 + Math.sin(a) * rad * 0.72 - t * 16;
              pRect(ctx, sx - 8, sy - 8, 16, 16, '#27272a');
            }
            // Layered crimson -> orange -> gold -> blinding white core
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * Math.PI * 2 + t * 2;
              pRect(ctx, pos.x + Math.cos(a) * rad * 0.62 - 9, pos.y - 10 + Math.sin(a) * rad * 0.5 - 9, 18, 18, '#dc2626');
              pRect(ctx, pos.x + Math.cos(a) * rad * 0.42 - 7, pos.y - 10 + Math.sin(a) * rad * 0.35 - 7, 14, 14, '#f97316');
            }
            pRect(ctx, pos.x - rad * 0.38, pos.y - 10 - rad * 0.34, rad * 0.76, rad * 0.68, '#facc15');
            if (t < 0.45) {
              pRect(ctx, pos.x - rad * 0.22, pos.y - 10 - rad * 0.2, rad * 0.44, rad * 0.4, '#ffffff');
            }
            drawPixelRing(ctx, pos.x, pos.y + 6, rad * 1.25, rad * 0.55, 20, 4, '#fde047', t * 4);
            break;
          }

          case 'crimson_flame': {
            // Spinning crimson Mangekyo pixel eye flash + jagged black Amaterasu flames + crow feathers!
            if (t < 0.45) {
              const eyeY = pos.y - 46;
              drawPixelRing(ctx, pos.x, eyeY, 16, 16, 12, 4, '#dc2626', t * 9);
              pRect(ctx, pos.x - 10, eyeY - 10, 20, 20, '#991b1b');
              drawPixelRing(ctx, pos.x, eyeY, 8, 8, 6, 3, '#09090b', -t * 14);
              pRect(ctx, pos.x - 3, eyeY - 3, 6, 6, '#ef4444');
            }
            // Pitch-black crimson-rimmed dancing Amaterasu flames
            for (let k = -3; k <= 3; k++) {
              const fx = pos.x + k * 7;
              const fh = (22 + ((Math.abs(k) * 9 + Math.floor(now / 60) * 5) % 18)) * (1 - t * 0.35);
              const fy = pos.y + 10 - fh;
              pRect(ctx, fx - 5, fy - 2, 10, fh + 2, '#dc2626');
              pRect(ctx, fx - 3, fy + 2, 6, Math.max(4, fh - 4), '#09090b');
            }
            // Fluttering black pixel crow feathers
            for (let f = 0; f < 5; f++) {
              const fa = t * 5 + f * 1.3;
              const fx = pos.x + Math.cos(fa) * r * (0.4 + t * 0.7);
              const fy = pos.y - 14 - t * 32 + Math.sin(fa * 2) * 8;
              pRect(ctx, fx, fy, 7, 3, '#09090b');
              pRect(ctx, fx + 2, fy, 3, 2, '#7f1d1d');
            }
            break;
          }

          case 'fire_cone': {
            // Roaring directional pixel flame wave cone from caster to target!
            const target = hexToScreen(v.tx ?? v.x, v.ty ?? v.y, layout);
            const baseAngle = Math.atan2(target.y - pos.y, target.x - pos.x);
            const maxLen = Math.max(r * 1.5, Math.hypot(target.x - pos.x, target.y - pos.y) * 1.15);
            for (let i = 0; i < 18; i++) {
              const distFrac = ((i * 0.065 + t * 1.2) % 1);
              const spread = (((i % 5) - 2) * 0.16) * (0.35 + distFrac);
              const a = baseAngle + spread;
              const dist = distFrac * maxLen;
              const fx = pos.x + Math.cos(a) * dist;
              const fy = pos.y - 12 + Math.sin(a) * dist;
              const sz = 10 + distFrac * 12;
              const col =
                distFrac < 0.25 ? '#ffffff' : distFrac < 0.5 ? '#facc15' : distFrac < 0.78 ? '#f97316' : '#dc2626';
              pRect(ctx, fx - sz / 2, fy - sz / 2, sz, sz, col);
            }
            break;
          }

          case 'flash_line': {
            // Blistering golden Hiraishin teleport zig-zag flash + golden kunai strike seal!
            const target = hexToScreen(v.tx ?? v.x, v.ty ?? v.y, layout);
            drawPixelBolt(ctx, pos.x, pos.y - 12, target.x, target.y - 12, 7, 14, 4, '#eab308', '#ffffff', 5);
            // Golden 4-point star flash at destination
            const starSize = Math.round(r * (0.65 - t * 0.4));
            if (starSize > 3) {
              pRect(ctx, target.x - starSize, target.y - 14, starSize * 2, 4, '#fef08a');
              pRect(ctx, target.x - 2, target.y - 12 - starSize, 4, starSize * 2, '#fef08a');
              pRect(ctx, target.x - 4, target.y - 16, 8, 8, '#ffffff');
            }
            break;
          }

          case 'meteor': {
            // Colossal flaming pixel meteor descent -> dual Susanoo shockwave + purple blade slash!
            const impactT = 0.44;
            if (t <= impactT + 0.12) {
              const dropFrac = Math.min(1, t / impactT);
              const mx = pos.x + (1 - dropFrac) * 95;
              const my = pos.y - (1 - dropFrac) * 230;
              const mr = r * 0.62;
              // Blazing pixel tail
              for (let k = 1; k <= 7; k++) {
                pRect(
                  ctx,
                  mx + k * 11 - mr * 0.45,
                  my - k * 24 - mr * 0.45,
                  mr * (0.95 - k * 0.1),
                  mr * (0.95 - k * 0.1),
                  k % 2 === 0 ? '#f97316' : '#facc15',
                );
              }
              // Rocky pixel meteor body with glowing cracks
              pRect(ctx, mx - mr * 0.7, my - mr * 0.7, mr * 1.4, mr * 1.4, '#ea580c');
              pRect(ctx, mx - mr * 0.56, my - mr * 0.56, mr * 1.12, mr * 1.12, '#3b0764');
              pRect(ctx, mx - mr * 0.35, my - mr * 0.25, mr * 0.7, mr * 0.2, '#f97316');
              pRect(ctx, mx - mr * 0.2, my + mr * 0.1, mr * 0.5, mr * 0.18, '#facc15');
            }
            if (t >= impactT * 0.85) {
              const st = Math.min(1, (t - impactT * 0.85) / (1 - impactT * 0.85));
              // Dual expanding Susanoo purple + molten orange shockwave rings
              drawPixelRing(ctx, pos.x, pos.y + 6, r * (0.4 + st * 1.75), r * (0.25 + st * 0.9), 28, 6, '#a855f7', st * 4);
              drawPixelRing(ctx, pos.x, pos.y + 6, r * (0.25 + st * 1.25), r * (0.18 + st * 0.65), 20, 5, '#f97316', -st * 5);
              // Giant diagonal purple Susanoo blade slash across crater!
              drawPixelBolt(
                ctx,
                pos.x - r * 1.1,
                pos.y - r * 0.75,
                pos.x + r * 1.1,
                pos.y + r * 0.65,
                9,
                8,
                7,
                '#7e22ce',
                '#f3e8ff',
                7,
              );
            }
            break;
          }

          default: {
            drawPixelRing(ctx, pos.x, pos.y, r * (0.3 + t * 0.75), r * (0.3 + t * 0.75), 14, 4, v.color, t * 5);
          }
        }
        ctx.restore();
      }
    };

    const render = (now: number) => {
      if (document.hidden) {
        lastTime = now;
        rafId = requestAnimationFrame(render);
        return;
      }

      const bridge = bridgeRef.current;
      const isIdlePrep =
        bridge.phase === 'prep' &&
        !bridge.isDraggingUnit &&
        !bridge.isDraggingItem &&
        !tactician.moving &&
        tactician.ripples.length === 0 &&
        tactician.pickupBursts.length === 0 &&
        bridge.lootOrbs.length === 0 &&
        bridge.mergeCelebrations.length === 0;
      if (isIdlePrep && now - lastTime < 32) {
        rafId = requestAnimationFrame(render);
        return;
      }

      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const activeArenaId: ArenaMapId = bridge.scoutedOpponent?.arenaId ?? bridge.arenaId;
      const layout = computeHexLayout(width, height, activeArenaId, getArenaAspect(activeArenaId));

      // Keep unmoved Kage Tactician neatly anchored to the left flank of the stone bench across resizes
      if (!tactician.userMoved) {
        tactician.x = Math.max(76, layout.benchLeftX - 54);
        tactician.y = layout.benchY;
        tactician.targetX = tactician.x;
        tactician.targetY = tactician.y;
      }

      // Update Kage Tactician right-click movement & 4-directional walk facing
      if (tactician.moving && !bridge.scoutedOpponent) {
        const dx = tactician.targetX - tactician.x;
        const dy = tactician.targetY - tactician.y;
        const dist = Math.hypot(dx, dy);
        const speed = 320;
        if (dist <= speed * dt + 2) {
          tactician.x = tactician.targetX;
          tactician.y = tactician.targetY;
          tactician.moving = false;
        } else {
          tactician.x += (dx / dist) * speed * dt;
          tactician.y += (dy / dist) * speed * dt;
          if (Math.abs(dx) > Math.abs(dy) * 0.9) {
            tactician.dir = dx >= 0 ? 'right' : 'left';
          } else {
            tactician.dir = dy < 0 ? 'up' : 'down';
          }
        }
      }

      // Check Tactician proximity to glowing TFT Loot Orbs for physical pickup!
      if (!bridge.scoutedOpponent && bridge.lootOrbs.length > 0) {
        for (const orb of bridge.lootOrbs) {
          if (now - orb.spawnedAt < 340) continue; // Let parabolic pop-out land first
          const op = hexToScreen(orb.col, orb.row, layout);
          if (Math.hypot(tactician.x - op.x, tactician.y - op.y) <= 56) {
            const pickup = callbacksRef.current.onCollectLootOrb(orb.id);
            if (pickup) {
              tactician.pickupBursts.push({
                x: op.x,
                y: op.y,
                color: pickup.color,
                label: pickup.label,
                age: 0,
                duration: 1.15,
              });
            }
          }
        }
      }

      // Advance ground click ripples & orb pickup celebration bursts
      for (let i = tactician.ripples.length - 1; i >= 0; i--) {
        tactician.ripples[i].age += dt;
        if (tactician.ripples[i].age >= tactician.ripples[i].duration) {
          tactician.ripples.splice(i, 1);
        }
      }
      for (let i = tactician.pickupBursts.length - 1; i >= 0; i--) {
        tactician.pickupBursts[i].age += dt;
        if (tactician.pickupBursts[i].age >= tactician.pickupBursts[i].duration) {
          tactician.pickupBursts.splice(i, 1);
        }
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Camera shake from combat trauma
      if (bridge.combatState && bridge.combatState.trauma > 0) {
        const shake = bridge.combatState.trauma * bridge.combatState.trauma * 10;
        ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
      }

      // 1. Full-DPR Sharpened Grimdark Pixel-Art Arena Backdrop
      const arenaDef = ARENA_MAPS[activeArenaId] ?? ARENA_MAPS.kanli_ay;
      const cachedBg = bgCache[activeArenaId];
      if (cachedBg) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cachedBg, 0, 0, cachedBg.width, cachedBg.height, 0, 0, width, height);
      } else {
        ctx.fillStyle = '#08090d';
        ctx.fillRect(0, 0, width, height);
      }

      // Subtle cinematic edge vignette grounding the arena like a dedicated desktop game viewport
      const vig = ctx.createRadialGradient(
        width * 0.5,
        height * 0.46,
        Math.min(width, height) * 0.34,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.72,
      );
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(0.75, 'rgba(4, 5, 9, 0.22)');
      vig.addColorStop(1, 'rgba(3, 4, 8, 0.62)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);

      // Dramatic Ultimate Sky Darkening Pulse (Itachii / Minaato / Madaara)
      const skyDark = bridge.combatState?.skyDarken ?? 0;
      if (skyDark > 0.05) {
        ctx.fillStyle = `rgba(6, 4, 12, ${(skyDark * 0.48).toFixed(2)})`;
        ctx.fillRect(0, 0, width, height);
      }

      // 1b. Diegetic TFT Left-Flank Interest Ryo Medallions (glowing gold coins along left stone edge)
      const activeInterest = Math.min(bridge.maxInterest, Math.floor(bridge.gold / 10));
      const coinCount = Math.min(5, bridge.maxInterest);
      for (let i = 0; i < coinCount; i++) {
        const rowPos = 4.45 - i * 0.88;
        const flank = getRowMetrics(rowPos, layout);
        const mx = layout.centerX - flank.rowW / 2 - flank.cellW * 0.52;
        const my = flank.y;
        const lit = i < activeInterest;

        // Dark iron stone socket
        ctx.fillStyle = '#0c0f17';
        ctx.beginPath();
        ctx.ellipse(mx, my + 4, 13 * flank.depthScale, 6 * flank.depthScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = lit ? '#eab308' : 'rgba(148, 163, 184, 0.42)';
        ctx.lineWidth = lit ? 1.8 : 1.1;
        ctx.stroke();

        if (lit) {
          const pulse = 0.8 + Math.sin(now * 0.006 + i * 0.9) * 0.2;
          const hoverY = my - 6 - Math.sin(now * 0.005 + i) * 2.5;
          const coinR = 8.5 * flank.depthScale;
          // Warm gold aura
          ctx.fillStyle = `rgba(250, 204, 21, ${(0.22 * pulse).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(mx, hoverY, coinR * 1.55, 0, Math.PI * 2);
          ctx.fill();
          // Crisp golden Ryo medallion with square inner hole
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(mx, hoverY, coinR, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.fillStyle = '#451a03';
          ctx.fillRect(Math.round(mx - 2.5), Math.round(hoverY - 2.5), 5, 5);
        }
      }

      // 1c. Diegetic Movable Player & Rival Kage Tacticians (true 4-way animated pixel sprites!)
      const drawKageTactician = (
        avatarId: string,
        tx: number,
        ty: number,
        dir: UnitDirection,
        isMoving: boolean,
        label: string | null,
        hpValue: number | null,
        accent: string,
        scaleFactor = 0.96,
      ) => {
        const animType = isMoving ? 'walk' : 'idle';
        const frame = Math.floor((now * (isMoving ? 0.012 : 0.004) + (dir === 'down' ? 0 : 2)) % 4);
        const sprite = getBattleSprite(avatarId, animType, frame, dir);
        const baseH = Math.max(108, Math.min(132, layout.hexRadius * 2.58));
        const szH = Math.round(baseH * scaleFactor);
        const szW = Math.round(szH * (sprite.width / Math.max(1, sprite.height)));
        const footY = ty + 8;
        const strideLift = isMoving && frame % 2 === 1 ? -3 : 0;

        ctx.save();
        // Grounded Tactician contact ring
        ctx.fillStyle = 'rgba(5, 6, 11, 0.65)';
        ctx.beginPath();
        ctx.ellipse(tx, footY, szH * 0.21, szH * 0.078, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = isMoving ? 2.1 : 1.6;
        ctx.stroke();

        // Subtle pixel sprint dust puffs behind feet while running!
        if (isMoving) {
          for (let d = 0; d < 2; d++) {
            const pPhase = (now * 0.015 + d * 2.3) % 1;
            const ox = dir === 'right' ? -12 - pPhase * 12 : dir === 'left' ? 12 + pPhase * 12 : (d === 0 ? -7 : 7);
            const oy = dir === 'up' ? 6 + pPhase * 8 : dir === 'down' ? -4 - pPhase * 8 : 0;
            pRect(ctx, tx + ox, footY + oy - 2, 4, 4, 'rgba(226, 232, 240, 0.5)');
          }
        }

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          sprite,
          Math.round(tx - szW / 2),
          Math.round(footY - szH * 0.965 + strideLift),
          szW,
          szH,
        );
        ctx.restore();

        const headTopY = Math.round(footY - szH * 0.76 + strideLift);
        if (hpValue !== null) {
          const bw = 48;
          const bx = Math.round(tx - bw / 2);
          const by = headTopY - 8;
          ctx.fillStyle = 'rgba(7, 8, 13, 0.9)';
          ctx.fillRect(bx - 1, by - 1, bw + 2, 10);
          ctx.fillStyle = hpValue > 50 ? '#22c55e' : hpValue > 25 ? '#f59e0b' : '#dc2626';
          ctx.fillRect(bx, by, Math.round((bw * Math.max(0, Math.min(100, hpValue))) / 100), 8);
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`${Math.round(hpValue)}`, tx, by + 7);
        } else if (label) {
          ctx.font = 'bold 10px "Chakra Petch", sans-serif';
          ctx.textAlign = 'center';
          ctx.strokeStyle = '#07080d';
          ctx.lineWidth = 3;
          ctx.strokeText(label, tx, headTopY - 2);
          ctx.fillStyle = '#fca5a5';
          ctx.fillText(label, tx, headTopY - 2);
        }
      };

      // Rival Kage Tactician standing on top-right flank during Combat or Scouting
      const rivalAvatar = bridge.scoutedOpponent?.avatarId ?? bridge.opponentAvatarId;
      const rivalName = bridge.scoutedOpponent?.name ?? bridge.opponentName;
      if (rivalAvatar && (bridge.phase === 'combat' || bridge.scoutedOpponent)) {
        const topRowM = getRowMetrics(0, layout);
        const rx = Math.min(width - 78, layout.centerX + topRowM.rowW / 2 + 52);
        const ry = topRowM.y - 4;
        drawKageTactician(
          rivalAvatar,
          rx,
          ry,
          'down',
          false,
          rivalName,
          null,
          'rgba(220, 38, 38, 0.72)',
          0.86,
        );
      }

      // 2. 2.5D Perspective 7x6 TFT Hexagonal Grid (Fits cleanly inside stone courtyard!)
      const showPrepGrid = bridge.phase === 'prep';
      const isScouting = showPrepGrid && Boolean(bridge.scoutedOpponent);
      let activeHoverHex = hoverHex;
      let activeHoverBench = hoverBenchSlot;

      if ((bridge.isDraggingUnit || bridge.isDraggingItem) && bridge.dragClientPos) {
        const rect = canvas.getBoundingClientRect();
        const cx = bridge.dragClientPos.x;
        const cy = bridge.dragClientPos.y;
        if (cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom) {
          const lx = cx - rect.left;
          const ly = cy - rect.top;
          activeHoverBench = screenToBenchSlot(lx, ly, layout);
          activeHoverHex = activeHoverBench === null ? screenToHex(lx, ly, layout) : null;
        } else {
          activeHoverBench = null;
          activeHoverHex = null;
        }
      }

      for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          const isPlayerSide = r >= PLAYER_START_ROW;
          const center = hexToScreen(c, r, layout);
          const isHover = !isScouting && activeHoverHex?.col === c && activeHoverHex?.row === r;

          drawPerspectiveHex(ctx, center.x, center.y, center.hexR * 0.93);

          if (showPrepGrid) {
            if (isScouting) {
              ctx.fillStyle = isPlayerSide ? 'rgba(14, 116, 144, 0.06)' : 'rgba(56, 189, 248, 0.14)';
              ctx.strokeStyle = isPlayerSide ? 'rgba(56, 189, 248, 0.2)' : 'rgba(125, 211, 252, 0.45)';
              ctx.lineWidth = 1.2;
            } else if (isPlayerSide) {
              const highlightPlacement =
                Boolean(bridge.selectedUnitUid) || bridge.isDraggingUnit;
              const unitHere = bridge.playerBoardUnits.find(
                (u) => u.hex?.col === c && u.hex?.row === r,
              );
              const itemDropTarget =
                (bridge.isDraggingItem || bridge.selectedItemActive) &&
                Boolean(unitHere) &&
                (unitHere?.items.length ?? 3) < 3;

              if (itemDropTarget) {
                ctx.fillStyle = isHover
                  ? 'rgba(56, 189, 248, 0.34)'
                  : 'rgba(56, 189, 248, 0.16)';
                ctx.strokeStyle = isHover ? '#7dd3fc' : 'rgba(56, 189, 248, 0.72)';
                ctx.lineWidth = isHover ? 2.4 : 1.6;
              } else {
                ctx.fillStyle = isHover
                  ? 'rgba(234, 179, 8, 0.28)'
                  : highlightPlacement
                    ? 'rgba(34, 197, 94, 0.14)'
                    : 'rgba(15, 19, 29, 0.24)';
                ctx.strokeStyle = isHover
                  ? '#fde047'
                  : highlightPlacement
                    ? 'rgba(74, 222, 128, 0.62)'
                    : 'rgba(217, 154, 60, 0.36)';
                ctx.lineWidth = isHover ? 2.4 : 1.3;
              }
            } else {
              ctx.fillStyle = 'rgba(127, 29, 29, 0.12)';
              ctx.strokeStyle = 'rgba(220, 38, 38, 0.26)';
              ctx.lineWidth = 1.1;
            }
          } else {
            // During active combat, keep grid whisper-quiet like TFT!
            ctx.fillStyle = 'rgba(8, 10, 16, 0.04)';
            ctx.strokeStyle = 'rgba(226, 232, 240, 0.07)';
            ctx.lineWidth = 0.9;
          }

          ctx.fill();
          ctx.stroke();
        }
      }

      if (showPrepGrid) {
        const midM = getRowMetrics(2.5, layout);
        const yMid = midM.y;
        const leftMid = layout.centerX - midM.rowW / 2 - 10;
        const rightMid = layout.centerX + midM.rowW / 2 + 10;
        ctx.strokeStyle = isScouting ? 'rgba(56, 189, 248, 0.45)' : 'rgba(220, 38, 38, 0.42)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([7, 6]);
        ctx.beginPath();
        ctx.moveTo(leftMid, yMid);
        ctx.lineTo(rightMid, yMid);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 2b. Organic Integrated Stone Bench Markers directly on the arena's painted foreground ledge (NO dark box, NO numbers!)
      if (!isScouting) {
        for (let b = 0; b < BENCH_SIZE; b++) {
          const slotPos = benchSlotToScreen(b, layout);
          const benchUnit = bridge.playerBenchUnits.find((u) => u.benchIndex === b) ?? null;
          const isBeingDragged = benchUnit !== null && bridge.draggedUnitUid === benchUnit.uid;
          const isSelected = benchUnit !== null && benchUnit.uid === bridge.selectedUnitUid;
          const isHover = activeHoverBench === b;
          const itemTargetable =
            benchUnit !== null &&
            (bridge.isDraggingItem || bridge.selectedItemActive) &&
            benchUnit.items.length < 3;
          const unitDropTarget =
            bridge.phase === 'prep' &&
            (bridge.isDraggingUnit || Boolean(bridge.selectedUnitUid)) &&
            !isBeingDragged;

          let pState: 'empty' | 'occupied' | 'selected' | 'hover' | 'drop' | 'itemTarget' =
            benchUnit ? 'occupied' : 'empty';
          if (itemTargetable) pState = 'itemTarget';
          else if (isSelected) pState = 'selected';
          else if (isHover && unitDropTarget) pState = 'drop';
          else if (isHover) pState = 'hover';
          else if (bridge.isDraggingUnit && !isBeingDragged) pState = 'drop';

          draw3DBenchPedestal(ctx, slotPos.x, slotPos.y, slotPos.w, slotPos.h, pState);
        }
      }

      // 3. Units (Board & Combat with 2.5D Perspective Depth Scaling)
      if (bridge.phase === 'prep') {
        type PrepDrawItem = {
          ySort: number;
          draw: () => void;
        };
        const list: PrepDrawItem[] = [];

        const topUnits = bridge.scoutedOpponent ? bridge.scoutedOpponent.units : bridge.wave.units;

        for (const eu of topUnits) {
          const def = SHINOBI_BY_ID[eu.defId];
          if (!def) continue;
          const pos = hexToScreen(eu.col, eu.row, layout);
          list.push({
            ySort: pos.y,
            draw: () =>
              drawUnit(eu.defId, eu.stars, 'enemy', pos.x, pos.y, layout.hexRadius, {
                hp: def.hp,
                maxHp: def.hp,
                ghostHp: def.hp,
                shield: 0,
                mana: def.startMana,
                maxMana: def.maxMana,
                anim: 'idle',
                dir: 'down',
                hitFlash: false,
                stunned: false,
                burning: false,
                koTimer: 0,
                selected: false,
                depthScale: pos.scale,
                items: eu.items ?? [],
                now,
              }),
          });
        }

        if (!isScouting) {
          for (const pu of bridge.playerBoardUnits) {
            if (!pu.hex) continue;
            const isBeingDragged = bridge.draggedUnitUid === pu.uid;
            const def = SHINOBI_BY_ID[pu.defId];
            if (!def) continue;
            const pos = hexToScreen(pu.hex.col, pu.hex.row, layout);
            let forgePreview: { resultId: ItemId; hovered: boolean } | null = null;
            if (bridge.isDraggingItem && bridge.draggedItemId) {
              const prev = previewItemCombineOnUnit(pu.items, bridge.draggedItemId);
              if (prev.resultId) {
                forgePreview = {
                  resultId: prev.resultId,
                  hovered: bridge.hoverCombineUnitUid === pu.uid,
                };
              }
            }
            list.push({
              ySort: pos.y,
              draw: () =>
                drawUnit(pu.defId, pu.stars, 'player', pos.x, pos.y, layout.hexRadius, {
                  hp: def.hp,
                  maxHp: def.hp,
                  ghostHp: def.hp,
                  shield: 0,
                  mana: def.startMana,
                  maxMana: def.maxMana,
                  anim: 'idle',
                  dir: 'down',
                  hitFlash: false,
                  stunned: false,
                  burning: false,
                  koTimer: 0,
                  selected: pu.uid === bridge.selectedUnitUid,
                  dimmed: isBeingDragged,
                  depthScale: pos.scale,
                  items: pu.items,
                  forgePreview,
                  now,
                }),
            });
          }
        }

        list.sort((a, b) => a.ySort - b.ySort);
        for (const item of list) item.draw();

        // Golden pixel star-merge pillar celebration on board!
        for (const mc of bridge.mergeCelebrations) {
          const age = (now - mc.startedAt) / 1000;
          if (age < 0 || age > 1.1) continue;
          const t = age / 1.1;
          const pos = hexToScreen(mc.col, mc.row, layout);
          const col = mc.stars === 3 ? '#f97316' : '#facc15';
          ctx.save();
          ctx.globalAlpha = 1 - t;
          const beamW = Math.round(pos.hexR * (0.9 - t * 0.45));
          pRect(ctx, pos.x - beamW / 2, pos.y - 120, beamW, 136, 'rgba(250, 204, 21, 0.25)');
          drawPixelRing(ctx, pos.x, pos.y + 8, pos.hexR * (0.5 + t * 0.8), pos.hexR * 0.34, 16, 4, col, t * 8);
          for (let k = 0; k < 8; k++) {
            const a = t * 6 + (k / 8) * Math.PI * 2;
            const sx = pos.x + Math.cos(a) * pos.hexR * (0.4 + t * 0.6);
            const sy = pos.y - t * 75 - (k % 3) * 12;
            pRect(ctx, sx - 2, sy - 2, 5, 5, k % 2 === 0 ? '#ffffff' : col);
          }
          ctx.restore();
        }
      } else if (bridge.combatState) {
        const combat = bridge.combatState;

        // 3a. Pixel Dash Afterimages (true articulated attack pose!)
        for (const img of combat.afterimages) {
          const t = Math.min(1, img.age / img.duration);
          const pos = hexToScreen(img.x, img.y, layout);
          const sprite = getBattleSprite(img.defId, 'attack', 1, img.dir);
          const baseH = Math.max(108, Math.min(132, layout.hexRadius * 2.58));
          const drawH = Math.round(baseH * pos.scale);
          const drawW = Math.round(drawH * (sprite.width / Math.max(1, sprite.height)));
          const footY = pos.y + layout.hexRadius * 0.28;
          ctx.save();
          ctx.globalAlpha = (1 - t) * 0.55;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(sprite, Math.round(pos.x - drawW / 2), Math.round(footY - drawH * 0.965), drawW, drawH);
          ctx.restore();
          pRect(ctx, pos.x - 10, pos.y + 8, 20, 3, img.tint);
        }

        // 3b. Combat Units (depth-sorted with true 4-way stepping, attacks, jutsu seals, & 5-frame KO!)
        const sortedUnits = [...combat.units]
          .filter((u) => u.alive || u.koTimer > 0)
          .sort((a, b) => a.y - b.y);

        for (const u of sortedUnits) {
          const pos = hexToScreen(u.x + u.lungeX, u.y + u.lungeY, layout);
          const animDur = Math.max(0.01, u.animDuration || 0.36);
          const animProgress = Math.max(0, Math.min(1, 1 - u.animTimer / animDur));
          let forgePreview: { resultId: ItemId; hovered: boolean } | null = null;
          if (u.team === 'player' && u.alive && bridge.isDraggingItem && bridge.draggedItemId) {
            const prev = previewItemCombineOnUnit(u.items, bridge.draggedItemId);
            if (prev.resultId) {
              forgePreview = {
                resultId: prev.resultId,
                hovered: bridge.hoverCombineUnitUid === u.uid,
              };
            }
          }
          drawUnit(u.defId, u.stars, u.team, pos.x, pos.y, layout.hexRadius, {
            hp: u.hp,
            maxHp: u.stats.maxHp,
            ghostHp: u.ghostHp,
            shield: u.shield,
            mana: u.mana,
            maxMana: u.stats.maxMana,
            anim: u.animState,
            dir: u.dir,
            animProgress,
            hitFlash: u.hitFlashTimer > 0,
            stunned: u.stunTimer > 0,
            burning: u.burnTimer > 0,
            koTimer: u.koTimer,
            koDuration: u.koDuration || 0.85,
            selected: u.uid === bridge.selectedUnitUid,
            depthScale: pos.scale,
            items: u.items,
            forgePreview,
            now,
          });
        }

        // 4. Bespoke Pixel-Art Projectiles
        for (const proj of combat.projectiles) {
          drawPixelProjectile(ctx, proj, layout, now);
        }

        // 5. Multi-Stage Pixel-Art Jutsu VFX
        drawVfx(combat, layout, now);

        // 6. Pooled Pixel Particles
        for (const pt of combat.particles) {
          if (!pt.active) continue;
          const sp = hexToScreen(pt.x, pt.y, layout);
          ctx.fillStyle = pt.color;
          ctx.globalAlpha = Math.max(0, 1 - pt.age / pt.life);
          ctx.fillRect(Math.round(sp.x / 2) * 2, Math.round((sp.y - 10) / 2) * 2, pt.size, pt.size);
        }
        ctx.globalAlpha = 1;

        // 7. Floating Pixel Damage / Crit / Jutsu Text
        for (const ft of combat.floatingTexts) {
          const sp = hexToScreen(ft.x, ft.y, layout);
          const alpha = Math.max(0, 1 - ft.age / ft.duration);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.textAlign = 'center';
          ctx.font = ft.isJutsu
            ? 'bold 14px "Chakra Petch", sans-serif'
            : ft.isCrit
              ? 'bold 15px "JetBrains Mono", monospace'
              : 'bold 11px "JetBrains Mono", monospace';
          ctx.strokeStyle = '#07080d';
          ctx.lineWidth = 4;
          ctx.strokeText(ft.text, sp.x, sp.y - 26);
          ctx.fillStyle = ft.color;
          ctx.fillText(ft.text, sp.x, sp.y - 26);
          ctx.restore();
        }
      }

      // 7b. Live Animated 3D Bench Shinobi Standing Directly on Arena Stone Ledge (consistent stature with front row!)
      if (!isScouting) {
        for (const bu of bridge.playerBenchUnits) {
          if (bu.benchIndex === null || bu.benchIndex < 0 || bu.benchIndex >= BENCH_SIZE) continue;
          const def = SHINOBI_BY_ID[bu.defId];
          if (!def) continue;
          const slotPos = benchSlotToScreen(bu.benchIndex, layout);
          const isBeingDragged = bridge.draggedUnitUid === bu.uid;
          let forgePreview: { resultId: ItemId; hovered: boolean } | null = null;
          if (bridge.isDraggingItem && bridge.draggedItemId) {
            const prev = previewItemCombineOnUnit(bu.items, bridge.draggedItemId);
            if (prev.resultId) {
              forgePreview = {
                resultId: prev.resultId,
                hovered: bridge.hoverCombineUnitUid === bu.uid,
              };
            }
          }
          drawUnit(bu.defId, bu.stars, 'player', slotPos.x, slotPos.y, layout.hexRadius, {
            hp: def.hp,
            maxHp: def.hp,
            ghostHp: def.hp,
            shield: 0,
            mana: def.startMana,
            maxMana: def.maxMana,
            anim: 'idle',
            dir: 'down',
            hitFlash: false,
            stunned: false,
            burning: false,
            koTimer: 0,
            selected: bu.uid === bridge.selectedUnitUid,
            dimmed: isBeingDragged,
            isBench: true,
            depthScale: 1.03,
            items: bu.items,
            forgePreview,
            now,
          });
        }
      }

      // 7b2. TFT Right-Click Ground Ripples + Glowing PvE Loot Orbs + Movable Player Kage Tactician!
      for (const rip of tactician.ripples) {
        const t = Math.min(1, rip.age / rip.duration);
        ctx.save();
        ctx.globalAlpha = 1 - t;
        drawPixelRing(ctx, rip.x, rip.y, 10 + t * 24, 5 + t * 11, 14, 3, '#4ade80', t * 3);
        drawPixelRing(ctx, rip.x, rip.y, 5 + t * 12, 3 + t * 6, 8, 2, '#fde047', -t * 4);
        ctx.restore();
      }

      if (!isScouting && bridge.lootOrbs.length > 0) {
        for (const orb of bridge.lootOrbs) {
          const ageSec = Math.max(0, (now - orb.spawnedAt) / 1000);
          const hopT = Math.min(1, ageSec / 0.36);
          const curHexX = orb.startCol + (orb.col - orb.startCol) * hopT;
          const curHexY = orb.startRow + (orb.row - orb.startRow) * hopT;
          const op = hexToScreen(curHexX, curHexY, layout);
          const arcLift = hopT < 1 ? Math.sin(hopT * Math.PI) * 34 : Math.sin(now * 0.005 + orb.col) * 4;
          const ox = op.x;
          const oy = op.y - 6 - arcLift;

          const tierPalette =
            orb.tier === 'gold'
              ? { beam: 'rgba(250, 204, 21, 0.24)', outer: '#ca8a04', mid: '#facc15', core: '#fef9c3' }
              : orb.tier === 'rare'
                ? { beam: 'rgba(52, 211, 153, 0.24)', outer: '#059669', mid: '#34d399', core: '#d1fae5' }
                : { beam: 'rgba(56, 189, 248, 0.22)', outer: '#0284c7', mid: '#38bdf8', core: '#e0f2fe' };

          ctx.save();
          // Ground shadow + beacon light pillar
          ctx.fillStyle = 'rgba(4, 5, 10, 0.62)';
          ctx.beginPath();
          ctx.ellipse(op.x, op.y + 8, 15, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          if (hopT >= 1) {
            const beamGrad = ctx.createLinearGradient(ox, oy - 54, ox, op.y + 8);
            beamGrad.addColorStop(0, 'rgba(0,0,0,0)');
            beamGrad.addColorStop(1, tierPalette.beam);
            ctx.fillStyle = beamGrad;
            ctx.fillRect(Math.round(ox - 11), Math.round(oy - 54), 22, 62 + arcLift);
            drawPixelRing(ctx, op.x, op.y + 8, 17, 7, 12, 3, tierPalette.mid, now * 0.004);
          }

          // Crisp pixel-art glowing Loot Orb sphere
          pRect(ctx, ox - 11, oy - 11, 22, 22, '#07080d');
          pRect(ctx, ox - 9, oy - 9, 18, 18, tierPalette.outer);
          pRect(ctx, ox - 7, oy - 7, 14, 14, tierPalette.mid);
          pRect(ctx, ox - 4, oy - 5, 7, 6, tierPalette.core);
          pRect(ctx, ox - 3, oy - 4, 3, 3, '#ffffff');

          // Orbiting sparkle pixels
          for (let s = 0; s < 3; s++) {
            const sa = now * 0.006 + (s * Math.PI * 2) / 3;
            pRect(ctx, ox + Math.cos(sa) * 16 - 2, oy + Math.sin(sa) * 9 - 2, 3, 3, s === 0 ? '#ffffff' : tierPalette.mid);
          }

          // Compact pickup hint label above orb
          if (hopT >= 1) {
            ctx.font = 'bold 9px "Chakra Petch", sans-serif';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#07080d';
            ctx.lineWidth = 3;
            const hint = orb.tier === 'gold' ? 'ALTIN KÜRE' : orb.tier === 'rare' ? 'NADİR KÜRE' : 'GANİMET';
            ctx.strokeText(hint, ox, oy - 18);
            ctx.fillStyle = tierPalette.core;
            ctx.fillText(hint, ox, oy - 18);
          }
          ctx.restore();
        }
      }

      // Movable Player Kage Tactician (walks smoothly across the arena to scoop Loot Orbs!)
      if (!bridge.scoutedOpponent) {
        drawKageTactician(
          bridge.playerAvatarId,
          tactician.x,
          tactician.y,
          tactician.dir,
          tactician.moving,
          null,
          bridge.playerHp,
          tactician.moving ? '#4ade80' : 'rgba(217, 154, 60, 0.8)',
          0.95,
        );
      }

      // Loot Orb pickup celebration bursts + floating reward labels
      for (const b of tactician.pickupBursts) {
        const t = Math.min(1, b.age / b.duration);
        ctx.save();
        ctx.globalAlpha = 1 - t;
        drawPixelRing(ctx, b.x, b.y, 12 + t * 38, 6 + t * 18, 16, 4, b.color, t * 7);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + t * 3;
          pRect(ctx, b.x + Math.cos(a) * (10 + t * 30), b.y - t * 38 + Math.sin(a) * 10, 4, 4, k % 2 === 0 ? '#ffffff' : b.color);
        }
        ctx.font = 'bold 13px "Chakra Petch", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#07080d';
        ctx.lineWidth = 4;
        ctx.strokeText(b.label, b.x, b.y - 24 - t * 28);
        ctx.fillStyle = b.color;
        ctx.fillText(b.label, b.x, b.y - 24 - t * 28);
        ctx.restore();
      }

      // 7c. Hovered Unit Nameplate (Cleanly above unit head on bench so it never overlaps the docked shop!)
      if (bridge.phase === 'prep' && !bridge.isDraggingUnit && !bridge.isDraggingItem) {
        let hoverLabel: string | null = null;
        let hoverColor = '#4ade80';
        let hx = 0;
        let hy = 0;

        if (!isScouting && activeHoverBench !== null) {
          const bu = bridge.playerBenchUnits.find((u) => u.benchIndex === activeHoverBench);
          if (bu && SHINOBI_BY_ID[bu.defId]) {
            const slotPos = benchSlotToScreen(activeHoverBench, layout);
            const benchDrawH = Math.round(Math.max(88, Math.min(112, layout.hexRadius * 2.15)) * 1.03);
            hoverLabel = `${SHINOBI_BY_ID[bu.defId].name} ${'★'.repeat(bu.stars)}`;
            hoverColor = '#facc15';
            hx = slotPos.x;
            hy = slotPos.y - benchDrawH * 0.9 - 18;
          }
        } else if (activeHoverHex) {
          const topUnits = bridge.scoutedOpponent ? bridge.scoutedOpponent.units : bridge.wave.units;
          const hoveredPlayer = !isScouting
            ? bridge.playerBoardUnits.find(
                (u) => u.hex?.col === activeHoverHex!.col && u.hex?.row === activeHoverHex!.row,
              )
            : undefined;
          const hoveredEnemy = topUnits.find(
            (u) => u.col === activeHoverHex!.col && u.row === activeHoverHex!.row,
          );
          const targetDefId = hoveredPlayer?.defId ?? hoveredEnemy?.defId;
          const targetStars = hoveredPlayer?.stars ?? hoveredEnemy?.stars ?? 1;
          if (targetDefId && SHINOBI_BY_ID[targetDefId]) {
            const pos = hexToScreen(activeHoverHex.col, activeHoverHex.row, layout);
            hoverLabel = `${SHINOBI_BY_ID[targetDefId].name} ${'★'.repeat(targetStars)}`;
            hoverColor = hoveredPlayer ? '#4ade80' : '#f87171';
            hx = pos.x;
            hy = pos.y + pos.hexR * 0.42;
          }
        }

        if (hoverLabel) {
          ctx.font = 'bold 11px "Chakra Petch", sans-serif';
          const tw = ctx.measureText(hoverLabel).width + 16;
          const lx = Math.round(hx - tw / 2);
          const ly = Math.round(hy);
          ctx.fillStyle = 'rgba(8, 9, 14, 0.94)';
          ctx.beginPath();
          ctx.roundRect(lx, ly, tw, 20, 6);
          ctx.fill();
          ctx.strokeStyle = hoverColor;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.textAlign = 'center';
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(hoverLabel, hx, ly + 14);
        }
      }

      // 8. Arena-Matched Grimdark Atmospheric Weather (Embers / Storm Rain / War Ash)
      if (arenaDef.weather === 'rain' || arenaDef.weather === 'storm') {
        ctx.strokeStyle =
          arenaDef.weather === 'storm'
            ? 'rgba(148, 197, 255, 0.34)'
            : 'rgba(148, 163, 184, 0.28)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (const w of weatherDots) {
          w.x = (w.x - 160 * w.speed * dt + width + 40) % (width + 40);
          w.y = (w.y + 420 * w.speed * dt) % (height + 40);
          const rx = Math.round(w.x - 20);
          const ry = Math.round(w.y - 20);
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 5, ry + 14);
        }
        ctx.stroke();
      } else {
        // Rising crimson/orange war embers or drifting war ash
        const isEmbers = arenaDef.weather === 'embers';
        for (let i = 0; i < weatherDots.length; i++) {
          const w = weatherDots[i];
          w.x = (w.x + Math.sin(now * 0.0015 + w.phase) * 26 * dt + width + 20) % (width + 20);
          w.y = (w.y - (isEmbers ? 48 : 26) * w.speed * dt + height + 20) % (height + 20);
          ctx.fillStyle = isEmbers
            ? i % 3 === 0
              ? 'rgba(239, 68, 68, 0.78)'
              : 'rgba(251, 146, 60, 0.72)'
            : i % 2 === 0
              ? 'rgba(248, 113, 113, 0.55)'
              : 'rgba(148, 163, 184, 0.45)';
          ctx.fillRect(Math.round(w.x - 10), Math.round(w.y - 10), w.size, w.size);
        }
      }

      // 9. Round Result / Merge Banner Overlay (positioned cleanly beneath the top TFT stage pill)
      if (bridge.roundBanner) {
        const bw = Math.min(390, width * 0.72);
        const bh = 54;
        const bx = (width - bw) / 2;
        const by = 56;
        ctx.fillStyle = 'rgba(8, 9, 14, 0.94)';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 12);
        ctx.fill();
        ctx.strokeStyle =
          bridge.roundBanner.tone === 'win'
            ? '#4ade80'
            : bridge.roundBanner.tone === 'merge'
              ? '#eab308'
              : '#dc2626';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 17px "Chakra Petch", sans-serif';
        ctx.fillStyle =
          bridge.roundBanner.tone === 'win'
            ? '#86efac'
            : bridge.roundBanner.tone === 'merge'
              ? '#fde047'
              : '#fca5a5';
        ctx.fillText(bridge.roundBanner.text, width / 2, by + 24);

        ctx.font = '12px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(bridge.roundBanner.subtext, width / 2, by + 42);
      }

      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvasApiRef.current = null;
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [bridgeRef, canvasApiRef]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#08090d]">
      <canvas
        ref={canvasRef}
        data-testid="arena-canvas"
        aria-label="Shinobi Tactics 2.5D altıgen savaş arenası ve 3D yedek platformu"
        className="w-full h-full block cursor-pointer"
      />
    </div>
  );
};
