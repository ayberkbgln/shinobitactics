import { SHINOBI_BY_ID } from './data';
import { ItemId, OriginId, UnitAnimState, UnitDirection } from './types';

type ChromaKey = 'magenta' | 'green';

interface HeroSheetDef {
  src: string;
  key: ChromaKey;
  cols: number;
  rows: number;
  cells: Array<{ id: string; col: number; row: number; kind: 'unit' | 'item' }>;
}

interface AnimSheetDef {
  id: string;
  src: string;
  key: ChromaKey;
  topCols: number;
  bottomCols: number;
  row0Y?: [number, number];
  row1Y?: [number, number];
}

// High-craft original hero idle & shop portrait sheets + item icon sheet
const HERO_SHEETS: HeroSheetDef[] = [
  {
    src: '/src/assets/images/shinobi_sheet_leaf_1795518950891.jpg',
    key: 'magenta',
    cols: 2,
    rows: 2,
    cells: [
      { id: 'nartuto', col: 0, row: 0, kind: 'unit' },
      { id: 'sazuke', col: 1, row: 0, kind: 'unit' },
      { id: 'rokku_li', col: 0, row: 1, kind: 'unit' },
      { id: 'kakaashi', col: 1, row: 1, kind: 'unit' },
    ],
  },
  {
    src: '/src/assets/images/shinobi_sheet_allies_1795518953241.jpg',
    key: 'green',
    cols: 2,
    rows: 2,
    cells: [
      { id: 'sakuura', col: 0, row: 0, kind: 'unit' },
      { id: 'gaarra', col: 0, row: 1, kind: 'unit' },
      { id: 'kankurro', col: 1, row: 1, kind: 'unit' },
    ],
  },
  {
    src: '/src/assets/images/shinobi_hinaata_hd_1795519799441.jpg',
    key: 'green',
    cols: 1,
    rows: 1,
    cells: [{ id: 'hinaata', col: 0, row: 0, kind: 'unit' }],
  },
  {
    src: '/src/assets/images/shinobi_sheet_masters_1795518951886.jpg',
    key: 'magenta',
    cols: 2,
    rows: 2,
    cells: [
      { id: 'shikamar', col: 0, row: 0, kind: 'unit' },
      { id: 'deidarra', col: 1, row: 0, kind: 'unit' },
      { id: 'itachii', col: 0, row: 1, kind: 'unit' },
      { id: 'jirayaa', col: 1, row: 1, kind: 'unit' },
    ],
  },
  {
    src: '/src/assets/images/shinobi_sheet_legends_1795518953654.jpg',
    key: 'green',
    cols: 2,
    rows: 1,
    cells: [
      { id: 'minaato', col: 0, row: 0, kind: 'unit' },
      { id: 'madaara', col: 1, row: 0, kind: 'unit' },
    ],
  },
  {
    src: '/src/assets/images/pve_monsters_sheet_1795532120282.jpg',
    key: 'green',
    cols: 2,
    rows: 2,
    cells: [
      { id: 'golge_kukla', col: 0, row: 0, kind: 'unit' },
      { id: 'kaya_golem', col: 1, row: 0, kind: 'unit' },
      { id: 'ruh_kurdu', col: 0, row: 1, kind: 'unit' },
      { id: 'cakra_ejderi', col: 1, row: 1, kind: 'unit' },
    ],
  },
  {
    src: '/src/assets/images/shinobi_items_sheet_1795518948239.jpg',
    key: 'magenta',
    cols: 5,
    rows: 1,
    cells: [
      { id: 'keskin_kunai', col: 0, row: 0, kind: 'item' },
      { id: 'cakra_parsomeni', col: 1, row: 0, kind: 'item' },
      { id: 'anbu_zirhi', col: 2, row: 0, kind: 'item' },
      { id: 'ruzgar_sandali', col: 3, row: 0, kind: 'item' },
      { id: 'kizil_muska', col: 4, row: 0, kind: 'item' },
    ],
  },
  {
    src: '/src/assets/images/items_crafted_top_1795532122450.jpg',
    key: 'magenta',
    cols: 5,
    rows: 3,
    cells: [
      { id: 'kage_kilici', col: 0, row: 0, kind: 'item' },
      { id: 'yildirim_mizragi', col: 1, row: 0, kind: 'item' },
      { id: 'demir_katana', col: 2, row: 0, kind: 'item' },
      { id: 'hiraishin_hanceri', col: 3, row: 0, kind: 'item' },
      { id: 'kan_icici', col: 4, row: 0, kind: 'item' },
      { id: 'yasak_tomar', col: 0, row: 2, kind: 'item' },
      { id: 'bilge_pelerini', col: 1, row: 2, kind: 'item' },
      { id: 'firtina_yelpezesi', col: 2, row: 2, kind: 'item' },
      { id: 'mangekyo_muhru', col: 3, row: 2, kind: 'item' },
      { id: 'susanoo_kalkani', col: 4, row: 2, kind: 'item' },
    ],
  },
  {
    src: '/src/assets/images/items_crafted_bot_1795532120756.jpg',
    key: 'magenta',
    cols: 5,
    rows: 1,
    cells: [
      { id: 'golge_cizmeleri', col: 0, row: 0, kind: 'item' },
      { id: 'olumsuz_maske', col: 1, row: 0, kind: 'item' },
      { id: 'sekiz_kapi_sargisi', col: 2, row: 0, kind: 'item' },
      { id: 'simsek_pencesi', col: 3, row: 0, kind: 'item' },
      { id: 'kizil_ay_kolyesi', col: 4, row: 0, kind: 'item' },
    ],
  },
];

// Dedicated 32-bit pixel-art 8-pose animation sheets for ALL 14 shinobi
// Row 0: [0: walk_front, 1: walk_back (TRUE BACK VIEW), 2: run_right_1, 3: run_right_2]
// Row 1: [0: attack_windup, 1: attack_strike, 2: cast_jutsu, 3: ko_collapse]
const ANIM_SHEETS: AnimSheetDef[] = [
  { id: 'nartuto', src: '/src/assets/images/anim_nartuto_sheet_1795529154357.jpg', key: 'magenta', topCols: 5, bottomCols: 4 },
  { id: 'sazuke', src: '/src/assets/images/anim_sazuke_sheet_1795529156835.jpg', key: 'green', topCols: 4, bottomCols: 4 },
  { id: 'rokku_li', src: '/src/assets/images/anim_rokku_sheet_1795529154653.jpg', key: 'magenta', topCols: 4, bottomCols: 4 },
  { id: 'kakaashi', src: '/src/assets/images/anim_kakaashi_sheet_1795529152127.jpg', key: 'magenta', topCols: 5, bottomCols: 4 },
  { id: 'sakuura', src: '/src/assets/images/anim_sakuura_sheet_1795529161138.jpg', key: 'green', topCols: 4, bottomCols: 4 },
  { id: 'hinaata', src: '/src/assets/images/anim_hinaata_sheet_1795529149946.jpg', key: 'green', topCols: 4, bottomCols: 4 },
  { id: 'gaarra', src: '/src/assets/images/anim_gaarra_sheet_1795529160965.jpg', key: 'green', topCols: 4, bottomCols: 4 },
  { id: 'kankurro', src: '/src/assets/images/anim_kankurro_sheet_1795529153188.jpg', key: 'green', topCols: 4, bottomCols: 4 },
  { id: 'shikamar', src: '/src/assets/images/anim_shikamar_sheet_1795529154830.jpg', key: 'magenta', topCols: 4, bottomCols: 4 },
  { id: 'deidarra', src: '/src/assets/images/anim_deidarra_sheet_1795529149590.jpg', key: 'green', topCols: 4, bottomCols: 4 },
  { id: 'itachii', src: '/src/assets/images/anim_itachii_sheet_1795529147524.jpg', key: 'green', topCols: 4, bottomCols: 4 },
  { id: 'jirayaa', src: '/src/assets/images/anim_jirayaa_sheet_1795529150354.jpg', key: 'magenta', topCols: 4, bottomCols: 4 },
  { id: 'minaato', src: '/src/assets/images/anim_minaato_sheet_1795529151893.jpg', key: 'green', topCols: 4, bottomCols: 4 },
  {
    id: 'madaara',
    src: '/src/assets/images/anim_madaara_sheet_1795529151184.jpg',
    key: 'green',
    topCols: 4,
    bottomCols: 4,
    row0Y: [0, 0.456],
    row1Y: [0.514, 0.954],
  },
];

// Uniform battle frame dimensions so every pose shares identical stature & foot anchor
export const SPRITE_FRAME_W = 180;
export const SPRITE_FRAME_H = 140;
const FOOT_ANCHOR_Y = 136;
const STAND_TARGET_H = 104;

interface UnitAnimSet {
  walkFront: HTMLCanvasElement;
  walkFrontFlip: HTMLCanvasElement;
  walkBack: HTMLCanvasElement;
  walkBackFlip: HTMLCanvasElement;
  runRight1: HTMLCanvasElement;
  runRight2: HTMLCanvasElement;
  runLeft1: HTMLCanvasElement;
  runLeft2: HTMLCanvasElement;
  attack1Right: HTMLCanvasElement;
  attack2Right: HTMLCanvasElement;
  attack1Left: HTMLCanvasElement;
  attack2Left: HTMLCanvasElement;
  castRight: HTMLCanvasElement;
  castLeft: HTMLCanvasElement;
  ko1: HTMLCanvasElement;
  ko2: HTMLCanvasElement;
  ko3: HTMLCanvasElement;
  ko4: HTMLCanvasElement;
}

const ORIGIN_BG: Record<OriginId, [string, string, string]> = {
  yaprak: ['#221833', '#5c2b2c', '#d97a3a'],
  kizil_klan: ['#180b14', '#4d1020', '#b82032'],
  kum: ['#2a1e16', '#724a24', '#d8a656'],
  bulut_orgutu: ['#120f1c', '#2a1b3a', '#9e1440'],
  sannin: ['#221516', '#5a2219', '#cf4f14'],
};

const unitIdleSprites = new Map<string, HTMLCanvasElement>();
const unitIdleBreatheSprites = new Map<string, HTMLCanvasElement>();
const unitAnimSets = new Map<string, UnitAnimSet>();
const flashCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
const unitPortraits = new Map<string, string>();
const itemIcons = new Map<ItemId, string>();
const itemIconCanvases = new Map<ItemId, HTMLCanvasElement>();

const fallbackSprites = new Map<string, HTMLCanvasElement>();
const fallbackPortraits = new Map<string, string>();
const fallbackItems = new Map<ItemId, string>();

let spriteRevision = 0;
let loadingStarted = false;
const listeners = new Set<(rev: number) => void>();

function notifyListeners(): void {
  spriteRevision += 1;
  for (const cb of listeners) {
    cb(spriteRevision);
  }
}

export function getSpriteRevision(): number {
  return spriteRevision;
}

export function subscribeSpritesReady(cb: (rev: number) => void): () => void {
  listeners.add(cb);
  ensureSheetsLoading();
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Chroma-key predicate tuned to strip flat neon magenta (#FF00FF) or neon green (#00FF00)
 * cleanly even across JPEG 4:2:0 subsampled borders, while preserving character colors.
 */
function isChromaBackground(
  r: number,
  g: number,
  b: number,
  key: ChromaKey,
  strictInterior: boolean,
): boolean {
  if (key === 'magenta') {
    const magScore = Math.min(r, b) - g;
    if (strictInterior) {
      return r > 170 && b > 170 && g < 95 && magScore > 105;
    }
    return r > 135 && b > 135 && g < 130 && magScore > 52;
  } else {
    const maxRB = Math.max(r, b);
    const greenScore = g - maxRB;
    if (strictInterior) {
      return g > 175 && r < 105 && b < 105 && greenScore > 95;
    }
    return g > 130 && greenScore > 42 && r < 150 && b < 150;
  }
}

/**
 * Applies full-image chroma-key BFS flood-fill + interior pure-key removal + 2-pass edge despill.
 * Returns the RGBA cleaned canvas and binary background mask (1 = transparent).
 */
function chromaKeyCanvas(
  work: HTMLCanvasElement,
  key: ChromaKey,
): { mask: Uint8Array; w: number; h: number } {
  const w = work.width;
  const h = work.height;
  const ctx = work.getContext('2d', { willReadFrequently: true })!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const total = w * h;
  const mask = new Uint8Array(total);

  // Pass 1: Border-seeded BFS flood-fill removes all exterior chroma cleanly
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const trySeed = (x: number, y: number) => {
    const idx = y * w + x;
    if (mask[idx]) return;
    const p = idx * 4;
    if (isChromaBackground(data[p], data[p + 1], data[p + 2], key, false)) {
      mask[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % w;
    const y = (idx - x) / w;
    if (x > 0) trySeed(x - 1, y);
    if (x + 1 < w) trySeed(x + 1, y);
    if (y > 0) trySeed(x, y - 1);
    if (y + 1 < h) trySeed(x, y + 1);
  }

  // Pass 2: Strip enclosed pure chroma holes (gaps between legs, under arms, behind aura rings)
  for (let idx = 0; idx < total; idx++) {
    if (mask[idx]) continue;
    const p = idx * 4;
    if (isChromaBackground(data[p], data[p + 1], data[p + 2], key, true)) {
      mask[idx] = 1;
    }
  }

  // Pass 3: Trim 1px high-chroma JPEG halo & despill boundary ink pixels
  const haloTrim = new Uint8Array(total);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (mask[idx]) continue;

      const touchesBg =
        (x > 0 && mask[idx - 1]) ||
        (x + 1 < w && mask[idx + 1]) ||
        (y > 0 && mask[idx - w]) ||
        (y + 1 < h && mask[idx + w]);

      if (!touchesBg) continue;
      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];

      if (key === 'magenta') {
        const score = Math.min(r, b) - g;
        if (score > 34) {
          if ((r + b) * 0.5 > 115) {
            haloTrim[idx] = 1;
          } else {
            data[p] = Math.min(r, g + 10);
            data[p + 2] = Math.min(b, g + 12);
          }
        }
      } else {
        const maxRB = Math.max(r, b);
        const score = g - maxRB;
        if (score > 28) {
          if (g > 110) {
            haloTrim[idx] = 1;
          } else {
            data[p + 1] = Math.min(g, maxRB + 8);
          }
        }
      }
    }
  }

  for (let idx = 0; idx < total; idx++) {
    if (haloTrim[idx]) mask[idx] = 1;
  }

  // Pass 4: Second gentle despill on newly exposed 1px outer silhouette + write alpha=0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (mask[idx]) {
        data[idx * 4 + 3] = 0;
        continue;
      }
      const touchesBg =
        (x > 0 && mask[idx - 1]) ||
        (x + 1 < w && mask[idx + 1]) ||
        (y > 0 && mask[idx - w]) ||
        (y + 1 < h && mask[idx + w]);
      if (!touchesBg) continue;
      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      if (key === 'magenta' && Math.min(r, b) - g > 18) {
        data[p] = Math.min(r, g + 10);
        data[p + 2] = Math.min(b, g + 12);
      } else if (key === 'green' && g - Math.max(r, b) > 16) {
        data[p + 1] = Math.min(g, Math.max(r, b) + 6);
      }
    }
  }

  // Strip isolated 1px JPEG specks
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (!mask[idx] && mask[idx - 1] && mask[idx + 1] && mask[idx - w] && mask[idx + w]) {
        mask[idx] = 1;
        data[idx * 4 + 3] = 0;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return { mask, w, h };
}

function cropRegionTightly(
  work: HTMLCanvasElement,
  mask: Uint8Array,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number,
): HTMLCanvasElement {
  const w = work.width;
  const h = work.height;
  const xStart = Math.max(0, Math.floor(rx0));
  const yStart = Math.max(0, Math.floor(ry0));
  const xEnd = Math.min(w, Math.ceil(rx1));
  const yEnd = Math.min(h, Math.ceil(ry1));

  let minX = xEnd;
  let minY = yEnd;
  let maxX = xStart;
  let maxY = yStart;

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      if (mask[y * w + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX <= minX || maxY <= minY) {
    const empty = document.createElement('canvas');
    empty.width = 16;
    empty.height = 16;
    return empty;
  }

  const pad = 2;
  const cx0 = Math.max(xStart, minX - pad);
  const cy0 = Math.max(yStart, minY - pad);
  const cw = Math.min(xEnd - cx0, maxX - minX + 1 + pad * 2);
  const ch = Math.min(yEnd - cy0, maxY - minY + 1 + pad * 2);

  const cropped = document.createElement('canvas');
  cropped.width = Math.max(1, cw);
  cropped.height = Math.max(1, ch);
  const cctx = cropped.getContext('2d')!;
  cctx.imageSmoothingEnabled = false;
  cctx.drawImage(work, cx0, cy0, cw, ch, 0, 0, cw, ch);
  return cropped;
}

/**
 * Extracts a single cell from a uniform hero/item sheet and crops tightly.
 */
function extractCleanCell(
  img: HTMLImageElement,
  col: number,
  row: number,
  cols: number,
  rows: number,
  key: ChromaKey,
): HTMLCanvasElement {
  const cellW = Math.floor(img.naturalWidth / cols);
  const cellH = Math.floor(img.naturalHeight / rows);
  const sx = col * cellW;
  const sy = row * cellH;

  const maxDim = 256;
  const scale = Math.min(1, maxDim / Math.max(cellW, cellH));
  const w = Math.max(32, Math.round(cellW * scale));
  const h = Math.max(32, Math.round(cellH * scale));

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, cellW, cellH, 0, 0, w, h);

  const { mask } = chromaKeyCanvas(work, key);
  return cropRegionTightly(work, mask, 0, 0, w, h);
}

/**
 * Splits a row band into `cols` sprites by locating the widest pure-background vertical gaps
 * near each expected column divider — prevents floating kunai/smoke puffs from splitting a sprite
 * AND prevents uneven grid alignment from clipping a sprite edge.
 */
function sliceAnimRow(
  work: HTMLCanvasElement,
  mask: Uint8Array,
  y0: number,
  y1: number,
  cols: number,
): HTMLCanvasElement[] {
  const w = work.width;
  const colDensity = new Int32Array(w);
  for (let y = y0; y < y1; y++) {
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      if (!mask[rowOff + x]) colDensity[x]++;
    }
  }

  const cuts: number[] = [0];
  const searchRadius = Math.round(w * 0.085);

  for (let k = 1; k < cols; k++) {
    const ideal = Math.round((k / cols) * w);
    const lo = Math.max(cuts[cuts.length - 1] + 24, ideal - searchRadius);
    const hi = Math.min(w - 24, ideal + searchRadius);

    // Find widest contiguous run of empty columns (density <= 1) in [lo, hi]
    let bestRunLen = -1;
    let bestCenter = ideal;
    let runStart = -1;
    for (let x = lo; x <= hi; x++) {
      if (colDensity[x] <= 1) {
        if (runStart < 0) runStart = x;
      } else {
        if (runStart >= 0) {
          const runLen = x - runStart;
          if (runLen > bestRunLen) {
            bestRunLen = runLen;
            bestCenter = Math.round((runStart + x - 1) / 2);
          }
          runStart = -1;
        }
      }
    }
    if (runStart >= 0) {
      const runLen = hi - runStart + 1;
      if (runLen > bestRunLen) {
        bestRunLen = runLen;
        bestCenter = Math.round((runStart + hi) / 2);
      }
    }

    if (bestRunLen <= 0) {
      // Fallback: lowest density column in window
      let minVal = Infinity;
      for (let x = lo; x <= hi; x++) {
        if (colDensity[x] < minVal) {
          minVal = colDensity[x];
          bestCenter = x;
        }
      }
    }
    cuts.push(bestCenter);
  }
  cuts.push(w);

  const cells: HTMLCanvasElement[] = [];
  for (let i = 0; i < cols; i++) {
    cells.push(cropRegionTightly(work, mask, cuts[i], y0, cuts[i + 1], y1));
  }
  return cells;
}

/**
 * Normalizes a tightly cropped sprite onto our uniform 180x140 battle canvas with feet locked
 * to y=136 and horizontal body centroid balanced so weapons/auras never jerk character position.
 */
function normalizeBattleFrame(
  cropped: HTMLCanvasElement,
  fixedScale?: number,
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = SPRITE_FRAME_W;
  out.height = SPRITE_FRAME_H;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const maxW = SPRITE_FRAME_W - 6;
  const maxH = SPRITE_FRAME_H - 6;
  const rawScale = fixedScale ?? STAND_TARGET_H / Math.max(1, cropped.height);
  const scale = Math.min(rawScale, maxW / Math.max(1, cropped.width), maxH / Math.max(1, cropped.height));
  const dw = Math.max(1, Math.round(cropped.width * scale));
  const dh = Math.max(1, Math.round(cropped.height * scale));

  // Measure horizontal body center using upper-torso + leg band
  const cctx = cropped.getContext('2d');
  let bodyCenterNorm = 0.5;
  if (cctx) {
    const imgData = cctx.getImageData(0, 0, cropped.width, cropped.height).data;
    const yStart = Math.floor(cropped.height * 0.16);
    const yEnd = Math.floor(cropped.height * 0.88);
    let sumX = 0;
    let count = 0;
    for (let y = yStart; y < yEnd; y++) {
      for (let x = 0; x < cropped.width; x++) {
        if (imgData[(y * cropped.width + x) * 4 + 3] > 128) {
          sumX += x;
          count++;
        }
      }
    }
    if (count > 20) {
      const centroidNorm = sumX / count / cropped.width;
      bodyCenterNorm = 0.5 + (centroidNorm - 0.5) * 0.65;
    }
  }

  let dx = Math.round(SPRITE_FRAME_W / 2 - dw * bodyCenterNorm);
  dx = Math.max(3, Math.min(SPRITE_FRAME_W - dw - 3, dx));
  const dy = Math.max(2, FOOT_ANCHOR_Y - dh);

  ctx.drawImage(cropped, 0, 0, cropped.width, cropped.height, dx, dy, dw, dh);
  return out;
}

function mirrorCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return out;
}

/**
 * Subtle 1px upper-body breathing shift for Idle frames (feet remain 100% locked to the stone floor!)
 */
function buildBreatheFrame(idle: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = idle.width;
  out.height = idle.height;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const splitY = Math.round(FOOT_ANCHOR_Y - 22);
  // Keep lower legs & sandals locked squarely on ground
  ctx.drawImage(idle, 0, splitY, idle.width, idle.height - splitY, 0, splitY, idle.width, idle.height - splitY);
  // Gently lower head & upper torso by 1.5px for calm combat breathing
  ctx.drawImage(idle, 0, 0, idle.width, splitY, 0, 1, idle.width, splitY);
  return out;
}

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function drawPixelSmokePuff(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  dark: string,
  mid: string,
  light: string,
): void {
  const step = 3;
  const r2 = r * r;
  for (let dy = -r; dy <= r; dy += step) {
    for (let dx = -r; dx <= r; dx += step) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const col = d2 > r2 * 0.62 ? dark : dy < -r * 0.15 ? light : mid;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(cx + dx), Math.round(cy + dy), step, step);
    }
  }
}

/**
 * Generates progressive shinobi KO dissolve frames from the high-craft collapsed pose:
 * stage 2 = 35% pixel-dither dissolve + smoke puffs erupting
 * stage 3 = 72% pixel-dither dissolve + billowing white-grey shinobi smoke cloud
 * stage 4 = lingering pixel smoke rings dissipating
 */
function buildKoDissolveFrame(koBase: HTMLCanvasElement, stage: 2 | 3 | 4): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = SPRITE_FRAME_W;
  out.height = SPRITE_FRAME_H;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;

  if (stage !== 4) {
    ctx.drawImage(koBase, 0, 0);
    const imgData = ctx.getImageData(0, 0, out.width, out.height);
    const data = imgData.data;
    const thresh = stage === 2 ? 6 : 12;
    for (let y = 0; y < out.height; y++) {
      for (let x = 0; x < out.width; x++) {
        const b = BAYER4[(y >> 1) & 3][(x >> 1) & 3];
        if (b < thresh) {
          data[(y * out.width + x) * 4 + 3] = 0;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const cx = SPRITE_FRAME_W / 2;
  const groundY = FOOT_ANCHOR_Y - 14;
  if (stage === 2) {
    drawPixelSmokePuff(ctx, cx - 22, groundY - 4, 15, '#64748b', '#cbd5e1', '#f8fafc');
    drawPixelSmokePuff(ctx, cx + 18, groundY - 8, 17, '#64748b', '#cbd5e1', '#ffffff');
    drawPixelSmokePuff(ctx, cx, groundY - 18, 14, '#94a3b8', '#e2e8f0', '#ffffff');
  } else if (stage === 3) {
    drawPixelSmokePuff(ctx, cx - 28, groundY - 12, 20, '#475569', '#cbd5e1', '#f8fafc');
    drawPixelSmokePuff(ctx, cx + 26, groundY - 14, 21, '#475569', '#cbd5e1', '#ffffff');
    drawPixelSmokePuff(ctx, cx, groundY - 26, 24, '#64748b', '#e2e8f0', '#ffffff');
    drawPixelSmokePuff(ctx, cx - 6, groundY - 4, 16, '#94a3b8', '#f1f5f9', '#ffffff');
  } else {
    drawPixelSmokePuff(ctx, cx - 34, groundY - 24, 12, '#64748b', '#cbd5e1', '#f1f5f9');
    drawPixelSmokePuff(ctx, cx + 32, groundY - 28, 13, '#64748b', '#cbd5e1', '#f8fafc');
    drawPixelSmokePuff(ctx, cx + 2, groundY - 42, 11, '#94a3b8', '#e2e8f0', '#ffffff');
  }

  return out;
}

function processAnimSheet(img: HTMLImageElement, def: AnimSheetDef): UnitAnimSet {
  const targetW = Math.min(1024, img.naturalWidth);
  const scale = targetW / Math.max(1, img.naturalWidth);
  const w = Math.max(256, Math.round(img.naturalWidth * scale));
  const h = Math.max(144, Math.round(img.naturalHeight * scale));

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);

  const { mask } = chromaKeyCanvas(work, def.key);

  // Determine exact vertical split between Row 0 and Row 1
  let r0Start = 0;
  let r0End = Math.round(h * 0.5);
  let r1Start = r0End;
  let r1End = h;

  if (def.row0Y && def.row1Y) {
    r0Start = Math.round(h * def.row0Y[0]);
    r0End = Math.round(h * def.row0Y[1]);
    r1Start = Math.round(h * def.row1Y[0]);
    r1End = Math.round(h * def.row1Y[1]);
  } else {
    const loY = Math.round(h * 0.42);
    const hiY = Math.round(h * 0.57);
    let bestY = Math.round(h * 0.5);
    let minRowOcc = Infinity;
    for (let y = loY; y <= hiY; y++) {
      let occ = 0;
      const rowOff = y * w;
      for (let x = 0; x < w; x++) {
        if (!mask[rowOff + x]) occ++;
      }
      if (occ < minRowOcc) {
        minRowOcc = occ;
        bestY = y;
      }
    }
    r0End = bestY;
    r1Start = bestY;
  }

  const row0 = sliceAnimRow(work, mask, r0Start, r0End, def.topCols);
  const row1 = sliceAnimRow(work, mask, r1Start, r1End, def.bottomCols);

  const rawWalkFront = row0[0];
  const rawWalkBack = row0[1] ?? row0[0];
  const rawRun1 = row0[2] ?? row0[0];
  const rawRun2 = row0[3] ?? rawRun1;

  const rawAtk1 = row1[0] ?? rawWalkFront;
  const rawAtk2 = row1[1] ?? rawAtk1;
  const rawCast = row1[2] ?? rawAtk2;
  const rawKo = row1[3] ?? rawAtk1;

  // Compute one shared scale factor from upright front/back poses so every pose (incl. KO & tall auras)
  // keeps 100% consistent head size, proportions, and pixel density!
  const refStandH = Math.max(48, (rawWalkFront.height + rawWalkBack.height) * 0.5);
  const sheetScale = STAND_TARGET_H / refStandH;

  const walkFront = normalizeBattleFrame(rawWalkFront, sheetScale);
  const walkBack = normalizeBattleFrame(rawWalkBack, sheetScale);
  const runRight1 = normalizeBattleFrame(rawRun1, sheetScale);
  const runRight2 = normalizeBattleFrame(rawRun2, sheetScale);
  const attack1Right = normalizeBattleFrame(rawAtk1, sheetScale);
  const attack2Right = normalizeBattleFrame(rawAtk2, sheetScale);
  const castRight = normalizeBattleFrame(rawCast, sheetScale);
  const ko1 = normalizeBattleFrame(rawKo, sheetScale);

  return {
    walkFront,
    walkFrontFlip: mirrorCanvas(walkFront),
    walkBack,
    walkBackFlip: mirrorCanvas(walkBack),
    runRight1,
    runRight2,
    runLeft1: mirrorCanvas(runRight1),
    runLeft2: mirrorCanvas(runRight2),
    attack1Right,
    attack2Right,
    attack1Left: mirrorCanvas(attack1Right),
    attack2Left: mirrorCanvas(attack2Right),
    castRight,
    castLeft: mirrorCanvas(castRight),
    ko1,
    ko2: buildKoDissolveFrame(ko1, 2),
    ko3: buildKoDissolveFrame(ko1, 3),
    ko4: buildKoDissolveFrame(ko1, 4),
  };
}

function buildWhiteFlash(sprite: HTMLCanvasElement): HTMLCanvasElement {
  const cached = flashCache.get(sprite);
  if (cached) return cached;
  const flash = document.createElement('canvas');
  flash.width = sprite.width;
  flash.height = sprite.height;
  const ctx = flash.getContext('2d')!;
  ctx.drawImage(sprite, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, flash.width, flash.height);
  flashCache.set(sprite, flash);
  return flash;
}

function buildPortraitFromSprite(defId: string, cropped: HTMLCanvasElement): string {
  const def = SHINOBI_BY_ID[defId];
  const [bgTop, bgMid, bgAccent] = ORIGIN_BG[def?.origin ?? 'yaprak'];

  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  // Warm Bayer-dithered clan pixel backdrop
  for (let y = 0; y < 96; y += 2) {
    for (let x = 0; x < 96; x += 2) {
      const bayer = (((x >> 1) & 1) * 2 + ((y >> 1) & 1)) / 4;
      const t = y / 96;
      ctx.fillStyle = t + bayer * 0.14 < 0.44 ? bgTop : t + bayer * 0.14 < 0.78 ? bgMid : bgAccent;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  if (def?.origin === 'kizil_klan' || def?.origin === 'bulut_orgutu') {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.beginPath();
    ctx.arc(74, 20, 14, 0, Math.PI * 2);
    ctx.fill();
  } else if (def?.origin === 'kum') {
    ctx.fillStyle = 'rgba(138, 90, 43, 0.45)';
    ctx.fillRect(0, 68, 96, 28);
  } else {
    ctx.fillStyle = 'rgba(251, 207, 232, 0.35)';
    ctx.fillRect(10, 16, 4, 3);
    ctx.fillRect(80, 22, 4, 3);
  }

  const bustH = Math.round(cropped.height * 0.68);
  const srcSize = Math.max(bustH, Math.round(cropped.width * 0.78));
  const sx = Math.round((cropped.width - srcSize) / 2);
  const sy = Math.max(0, -Math.round(cropped.height * 0.03));

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cropped, sx, sy, srcSize, srcSize, 2, 4, 92, 92);

  ctx.fillStyle = 'rgba(12, 8, 18, 0.28)';
  ctx.fillRect(0, 90, 96, 6);

  return canvas.toDataURL('image/png');
}

function buildItemIconCanvas(cropped: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = 64;
  out.height = 64;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const maxBox = 56;
  const scale = Math.min(maxBox / cropped.width, maxBox / cropped.height);
  const dw = Math.round(cropped.width * scale);
  const dh = Math.round(cropped.height * scale);
  const dx = Math.round((64 - dw) / 2);
  const dy = Math.round((64 - dh) / 2);

  ctx.drawImage(cropped, 0, 0, cropped.width, cropped.height, dx, dy, dw, dh);
  return out;
}

function buildMonsterAnimSet(idle: HTMLCanvasElement): UnitAnimSet {
  const flipped = mirrorCanvas(idle);
  const stepLift = document.createElement('canvas');
  stepLift.width = idle.width;
  stepLift.height = idle.height;
  const sctx = stepLift.getContext('2d')!;
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(idle, 0, -4);

  const koCollapsed = document.createElement('canvas');
  koCollapsed.width = idle.width;
  koCollapsed.height = idle.height;
  const kctx = koCollapsed.getContext('2d')!;
  kctx.imageSmoothingEnabled = false;
  kctx.drawImage(idle, 0, 0, idle.width, idle.height, 8, Math.round(idle.height * 0.42), idle.width - 16, Math.round(idle.height * 0.56));

  return {
    walkFront: stepLift,
    walkFrontFlip: mirrorCanvas(stepLift),
    walkBack: idle,
    walkBackFlip: flipped,
    runRight1: idle,
    runRight2: stepLift,
    runLeft1: flipped,
    runLeft2: mirrorCanvas(stepLift),
    attack1Right: idle,
    attack2Right: stepLift,
    attack1Left: flipped,
    attack2Left: mirrorCanvas(stepLift),
    castRight: stepLift,
    castLeft: mirrorCanvas(stepLift),
    ko1: koCollapsed,
    ko2: buildKoDissolveFrame(koCollapsed, 2),
    ko3: buildKoDissolveFrame(koCollapsed, 3),
    ko4: buildKoDissolveFrame(koCollapsed, 4),
  };
}

function ensureSheetsLoading(): void {
  if (loadingStarted || typeof Image === 'undefined') return;
  loadingStarted = true;

  // 1. Load hero idle + monster + shop portrait + item sheets first
  for (const sheet of HERO_SHEETS) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      for (const cell of sheet.cells) {
        const cropped = extractCleanCell(img, cell.col, cell.row, sheet.cols, sheet.rows, sheet.key);
        if (cell.kind === 'unit') {
          const normalized = normalizeBattleFrame(cropped);
          unitIdleSprites.set(cell.id, normalized);
          unitIdleBreatheSprites.set(cell.id, buildBreatheFrame(normalized));
          unitPortraits.set(cell.id, buildPortraitFromSprite(cell.id, cropped));
          if (SHINOBI_BY_ID[cell.id]?.isMonster && !unitAnimSets.has(cell.id)) {
            unitAnimSets.set(cell.id, buildMonsterAnimSet(normalized));
          }
        } else {
          const iconCanvas = buildItemIconCanvas(cropped);
          itemIconCanvases.set(cell.id as ItemId, iconCanvas);
          itemIcons.set(cell.id as ItemId, iconCanvas.toDataURL('image/png'));
        }
      }
      notifyListeners();
    };
    img.src = sheet.src;
  }

  // 2. Load all 14 dedicated 8-pose 32-bit pixel-art animation sheets
  for (const def of ANIM_SHEETS) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      unitAnimSets.set(def.id, processAnimSheet(img, def));
      notifyListeners();
    };
    img.src = def.src;
  }
}

// Instant placeholder used only for ~60ms while sprite sheets decode
function getPlaceholderSprite(defId: string): HTMLCanvasElement {
  const cached = fallbackSprites.get(defId);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = SPRITE_FRAME_W;
  c.height = SPRITE_FRAME_H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2d2438';
  ctx.beginPath();
  ctx.arc(SPRITE_FRAME_W / 2, FOOT_ANCHOR_Y - 40, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 3;
  ctx.stroke();
  fallbackSprites.set(defId, c);
  return c;
}

function getPlaceholderPortrait(defId: string): string {
  const cached = fallbackPortraits.get(defId);
  if (cached) return cached;
  const def = SHINOBI_BY_ID[defId];
  const [bgTop, bgMid] = ORIGIN_BG[def?.origin ?? 'yaprak'];
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bgTop;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = bgMid;
  ctx.fillRect(0, 32, 64, 32);
  const url = c.toDataURL('image/png');
  fallbackPortraits.set(defId, url);
  return url;
}

function getPlaceholderItem(itemId: ItemId): string {
  const cached = fallbackItems.get(itemId);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#facc15';
  ctx.fillRect(10, 10, 12, 12);
  const url = c.toDataURL('image/png');
  fallbackItems.set(itemId, url);
  return url;
}

export function getBattleSprite(
  defId: string,
  anim: UnitAnimState = 'idle',
  frame = 0,
  dir: UnitDirection = 'down',
): HTMLCanvasElement {
  ensureSheetsLoading();
  const baseIdle = unitIdleSprites.get(defId);
  const breatheIdle = unitIdleBreatheSprites.get(defId) ?? baseIdle;
  const set = unitAnimSets.get(defId);

  if (!set) {
    return baseIdle ?? getPlaceholderSprite(defId);
  }

  const f = Math.abs(Math.floor(frame));

  switch (anim) {
    case 'idle': {
      if (dir === 'up') {
        return set.walkBack;
      }
      // Classic beloved hero sprite with calm pixel-locked breathing (zero awkward tilting!)
      const idle0 = baseIdle ?? set.walkFront;
      const idle1 = breatheIdle ?? idle0;
      return f % 4 === 1 || f % 4 === 2 ? idle1 : idle0;
    }

    case 'walk': {
      const step = f % 4;
      if (dir === 'up') {
        // True back-view alternating left/right stride!
        return step < 2 ? set.walkBack : set.walkBackFlip;
      }
      if (dir === 'right') {
        return step % 2 === 0 ? set.runRight1 : set.runRight2;
      }
      if (dir === 'left') {
        return step % 2 === 0 ? set.runLeft1 : set.runLeft2;
      }
      // dir === 'down': smooth 4-frame front stepping cycle
      const pass = baseIdle ?? set.walkFront;
      if (step === 0) return set.walkFront;
      if (step === 2) return set.walkFrontFlip;
      return pass;
    }

    case 'attack': {
      const step = Math.min(3, f);
      const isLeft = dir === 'left';
      if (step === 0 || step === 3) {
        return isLeft ? set.attack1Left : set.attack1Right;
      }
      return isLeft ? set.attack2Left : set.attack2Right;
    }

    case 'cast': {
      const step = Math.min(3, f);
      const isLeft = dir === 'left';
      if (step === 0) {
        return isLeft ? set.attack1Left : set.attack1Right;
      }
      return isLeft ? set.castLeft : set.castRight;
    }

    case 'ko': {
      const step = Math.min(4, f);
      if (step === 0) return dir === 'left' ? set.attack1Left : set.attack1Right;
      if (step === 1) return set.ko1;
      if (step === 2) return set.ko2;
      if (step === 3) return set.ko3;
      return set.ko4;
    }

    default:
      return baseIdle ?? set.walkFront;
  }
}

export function getFlashSprite(
  defId: string,
  anim: UnitAnimState = 'idle',
  frame = 0,
  dir: UnitDirection = 'down',
): HTMLCanvasElement {
  const sprite = getBattleSprite(defId, anim, frame, dir);
  return buildWhiteFlash(sprite);
}

export function getPortraitDataUrl(defId: string): string {
  ensureSheetsLoading();
  return unitPortraits.get(defId) ?? getPlaceholderPortrait(defId);
}

export function getItemIconDataUrl(itemId: ItemId): string {
  ensureSheetsLoading();
  return itemIcons.get(itemId) ?? getPlaceholderItem(itemId);
}

export function getItemIconCanvas(itemId: ItemId): HTMLCanvasElement | null {
  ensureSheetsLoading();
  return itemIconCanvases.get(itemId) ?? null;
}
