import {
  AUGMENT_LIST,
  BOARD_COLS,
  BOARD_ROWS,
  ITEMS,
  LEVEL_XP_TABLE,
  MAX_LEVEL,
  SHINOBI_BY_ID,
  SHINOBI_ROSTER,
  SHOP_ODDS_BY_LEVEL,
  TRAITS,
} from './data';
import {
  ActiveSynergy,
  AugmentDef,
  AugmentId,
  CombatParticle,
  CombatState,
  CombatUnit,
  ComputedStats,
  EnemyWaveUnit,
  HexCoord,
  ItemId,
  MergeEvent,
  OwnedUnit,
  ShopSlot,
  StarLevel,
  TraitId,
  UnitCost,
  UnitDirection,
} from './types';

// ---- SEEDED PRNG (deterministic multiplayer combat) ----

export function nextSeededRandom(state: CombatState): number {
  let t = (state.rngState += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---- HEX MATH (odd-r horizontal layout) ----

export function offsetToCube(col: number, row: number): { x: number; y: number; z: number } {
  const x = col - ((row - (row & 1)) >> 1);
  const z = row;
  const y = -x - z;
  return { x, y, z };
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const ca = offsetToCube(a.col, a.row);
  const cb = offsetToCube(b.col, b.row);
  return Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y), Math.abs(ca.z - cb.z));
}

export function getHexNeighbors(col: number, row: number): HexCoord[] {
  const isOdd = (row & 1) === 1;
  const dirs = isOdd
    ? [
        [1, 0],
        [-1, 0],
        [0, -1],
        [1, -1],
        [0, 1],
        [1, 1],
      ]
    : [
        [1, 0],
        [-1, 0],
        [-1, -1],
        [0, -1],
        [-1, 1],
        [0, 1],
      ];

  const out: HexCoord[] = [];
  for (const [dc, dr] of dirs) {
    const nc = col + dc;
    const nr = row + dr;
    if (nc >= 0 && nc < BOARD_COLS && nr >= 0 && nr < BOARD_ROWS) {
      out.push({ col: nc, row: nr });
    }
  }
  return out;
}

/**
 * Mirrors a player's deployed board (rows 3..5) onto the opposing half of the arena (rows 2..0)
 * for synchronized PvP matches.
 */
export function mirrorBoardForEnemy(boardUnits: OwnedUnit[]): EnemyWaveUnit[] {
  const out: EnemyWaveUnit[] = [];
  for (const u of boardUnits) {
    if (u.location !== 'board' || !u.hex) continue;
    const mirroredRow = Math.max(0, Math.min(2, BOARD_ROWS - 1 - u.hex.row));
    const mirroredCol = Math.max(0, Math.min(BOARD_COLS - 1, BOARD_COLS - 1 - u.hex.col));
    out.push({
      defId: u.defId,
      stars: u.stars,
      col: mirroredCol,
      row: mirroredRow,
      items: [...u.items],
    });
  }
  return out;
}

// ---- AUGMENTS & BOARD CAP ----

export function getMaxBoardUnits(level: number, augments: AugmentId[] = []): number {
  return level + (augments.includes('golge_klonu') ? 1 : 0);
}

export function rollAugmentChoices(
  owned: AugmentId[],
  count = 3,
  rng: () => number = Math.random,
): AugmentDef[] {
  const pool = AUGMENT_LIST.filter((a) => !owned.includes(a.id));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  return shuffled.slice(0, count);
}

// ---- SYNERGIES ----

export function calculateSynergies(units: Array<{ defId: string }>): ActiveSynergy[] {
  const uniqueDefIds = new Set<string>();
  for (const u of units) {
    uniqueDefIds.add(u.defId);
  }

  const counts = new Map<TraitId, number>();
  for (const defId of uniqueDefIds) {
    const def = SHINOBI_BY_ID[defId];
    if (!def || def.isMonster) continue;
    counts.set(def.origin, (counts.get(def.origin) ?? 0) + 1);
    counts.set(def.role, (counts.get(def.role) ?? 0) + 1);
  }

  const list: ActiveSynergy[] = [];
  for (const [traitId, count] of counts.entries()) {
    const def = TRAITS[traitId];
    let activeTierIndex = -1;
    let nextThreshold: number | null = null;
    for (let i = 0; i < def.tiers.length; i++) {
      if (count >= def.tiers[i].count) {
        activeTierIndex = i;
      } else if (nextThreshold === null) {
        nextThreshold = def.tiers[i].count;
      }
    }
    list.push({
      traitId,
      count,
      activeTierIndex,
      nextThreshold,
    });
  }

  list.sort((a, b) => {
    const aActive = a.activeTierIndex >= 0 ? 1 : 0;
    const bActive = b.activeTierIndex >= 0 ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    if (a.activeTierIndex !== b.activeTierIndex) return b.activeTierIndex - a.activeTierIndex;
    if (a.count !== b.count) return b.count - a.count;
    return a.traitId.localeCompare(b.traitId);
  });

  return list;
}

function getSynergyTier(synergies: ActiveSynergy[], id: TraitId): number {
  const found = synergies.find((s) => s.traitId === id);
  return found ? found.activeTierIndex : -1;
}

// ---- TFT ITEM COMBINING (2 Base Components -> Completed Shinobi Artifact) ----

export function isBaseComponent(itemId: ItemId): boolean {
  return Boolean(ITEMS[itemId]?.isComponent);
}

export function combineItems(a: ItemId, b: ItemId): ItemId | null {
  if (!isBaseComponent(a) || !isBaseComponent(b)) return null;
  for (const def of Object.values(ITEMS)) {
    if (!def.recipe) continue;
    const [r0, r1] = def.recipe;
    if ((r0 === a && r1 === b) || (r0 === b && r1 === a)) {
      return def.id;
    }
  }
  return null;
}

export function equipItemWithCombine(
  currentItems: ItemId[],
  incoming: ItemId,
): { nextItems: ItemId[]; combinedInto: ItemId | null; consumedComponent: ItemId | null } | null {
  // Authentic TFT rule: if incoming is a base component and the unit already holds a base component,
  // automatically fuse them into the Completed Artifact (even when all 3 slots hold items if 1 is a component!).
  if (isBaseComponent(incoming)) {
    const compIdx = currentItems.findIndex((id) => isBaseComponent(id));
    if (compIdx >= 0) {
      const existingComp = currentItems[compIdx];
      const crafted = combineItems(existingComp, incoming);
      if (crafted) {
        const nextItems = [...currentItems];
        nextItems[compIdx] = crafted;
        return { nextItems, combinedInto: crafted, consumedComponent: existingComp };
      }
    }
  }

  if (currentItems.length >= 3) return null;
  return {
    nextItems: [...currentItems, incoming],
    combinedInto: null,
    consumedComponent: null,
  };
}

export interface ItemRecipePreview {
  partnerId: ItemId;
  resultId: ItemId;
}

/**
 * Returns every completed shinobi artifact that can be forged from a given base component.
 */
export function getItemRecipesForComponent(componentId: ItemId): ItemRecipePreview[] {
  if (!isBaseComponent(componentId)) return [];
  const out: ItemRecipePreview[] = [];
  for (const def of Object.values(ITEMS)) {
    if (!def.recipe) continue;
    const [r0, r1] = def.recipe;
    if (r0 === componentId) {
      out.push({ partnerId: r1, resultId: def.id });
    } else if (r1 === componentId) {
      out.push({ partnerId: r0, resultId: def.id });
    }
  }
  return out;
}

/**
 * Previews what happens if `incoming` is dropped onto a unit currently holding `currentItems`.
 * Returns either a combine preview (`partnerId` + `resultId`), a plain equip, or `blocked: true` when full.
 */
export function previewItemCombineOnUnit(
  currentItems: ItemId[],
  incoming: ItemId,
): { partnerId: ItemId | null; resultId: ItemId | null; canEquip: boolean } {
  const res = equipItemWithCombine(currentItems, incoming);
  if (!res) {
    return { partnerId: null, resultId: null, canEquip: false };
  }
  return {
    partnerId: res.consumedComponent,
    resultId: res.combinedInto,
    canEquip: true,
  };
}

// ---- STATS CALCULATION ----

export function getStarMultiplier(stars: StarLevel): number {
  if (stars === 1) return 1;
  if (stars === 2) return 1.8;
  return 3.15;
}

export function computeUnitStats(
  defId: string,
  stars: StarLevel,
  items: ItemId[],
  synergies: ActiveSynergy[],
  augments: AugmentId[] = [],
): ComputedStats {
  const def = SHINOBI_BY_ID[defId];
  const starMult = getStarMultiplier(stars);

  let maxHp = Math.round(def.hp * starMult);
  let atk = Math.round(def.atk * starMult);
  let atkSpeed = def.atkSpeed;
  let armor = def.armor;
  let range = def.range;
  let startMana = def.startMana;
  let spellPower = 1.0;
  let critChance = 0.15;
  let critMult = 1.5;
  let lifesteal = 0;
  let startingShield = 0;
  let manaRegenPerSec = 0;
  let firstCastBonus = 0;
  let killHeal = 0;
  let tripleShot = false;
  let isAssassin = false;
  let tankManaOnHit = 0;

  // Apply origin synergies
  const yaprakTier = getSynergyTier(synergies, 'yaprak');
  if (def.origin === 'yaprak' && yaprakTier >= 0) {
    const spdBonus = [0.2, 0.45, 0.8][yaprakTier] ?? 0.2;
    const regen = [3, 6, 10][yaprakTier] ?? 3;
    atkSpeed *= 1 + spdBonus;
    manaRegenPerSec += regen;
  }

  const kizilTier = getSynergyTier(synergies, 'kizil_klan');
  if (def.origin === 'kizil_klan' && kizilTier >= 0) {
    critChance += [0.25, 0.55][kizilTier] ?? 0.25;
    firstCastBonus += [0.35, 0.7][kizilTier] ?? 0.35;
  }

  const kumTier = getSynergyTier(synergies, 'kum');
  if (kumTier >= 0) {
    startingShield += 240;
    armor += 20;
  }

  const bulutTier = getSynergyTier(synergies, 'bulut_orgutu');
  if (def.origin === 'bulut_orgutu' && bulutTier >= 0) {
    spellPower += [0.2, 0.45][bulutTier] ?? 0.2;
    killHeal += [180, 350][bulutTier] ?? 180;
  }

  const sanninTier = getSynergyTier(synergies, 'sannin');
  if (def.origin === 'sannin' && sanninTier >= 0) {
    maxHp = Math.round(maxHp * 1.25);
    atk = Math.round(atk * 1.25);
  }

  // Apply role synergies
  const dovuscuTier = getSynergyTier(synergies, 'dovuscu');
  if (def.role === 'dovuscu' && dovuscuTier >= 0) {
    maxHp += [240, 520][dovuscuTier] ?? 240;
  }

  const suikastciTier = getSynergyTier(synergies, 'suikastci');
  if (def.role === 'suikastci' && suikastciTier >= 0) {
    isAssassin = true;
    critMult += [0.35, 0.75][suikastciTier] ?? 0.35;
  }

  const buyucuTier = getSynergyTier(synergies, 'buyucu');
  if (def.role === 'buyucu' && buyucuTier >= 0) {
    spellPower += 0.35;
    startMana += 25;
  }

  const tankTier = getSynergyTier(synergies, 'tank');
  if (def.role === 'tank' && tankTier >= 0) {
    armor += [35, 75][tankTier] ?? 35;
    tankManaOnHit += [6, 12][tankTier] ?? 6;
  }

  const nisanciTier = getSynergyTier(synergies, 'nisanci');
  if (def.role === 'nisanci' && nisanciTier >= 0) {
    range += 1;
    tripleShot = true;
  }

  // Apply equipped items
  for (const itemId of items) {
    const item = ITEMS[itemId];
    if (!item) continue;
    if (item.bonusHp) maxHp += item.bonusHp;
    if (item.bonusAtk) atk += item.bonusAtk;
    if (item.bonusArmor) armor += item.bonusArmor;
    if (item.bonusAtkSpeed) atkSpeed *= 1 + item.bonusAtkSpeed;
    if (item.bonusStartMana) startMana += item.bonusStartMana;
    if (item.bonusSpellPower) spellPower += item.bonusSpellPower;
    if (item.bonusCritChance) critChance += item.bonusCritChance;
    if (item.bonusLifesteal) lifesteal += item.bonusLifesteal;
  }

  // Apply Kage Augments (TFT Mühürler)
  for (const aug of augments) {
    if (aug === 'cakra_tasmasi') {
      startMana += 30;
      spellPower += 0.2;
    } else if (aug === 'hokage_korumasi') {
      startingShield += 280;
      armor += 18;
    } else if (aug === 'kanli_bicak') {
      lifesteal += 0.22;
      atk += 18;
    } else if (aug === 'hizli_egitim') {
      atkSpeed *= 1.18;
    } else if (aug === 'olumcul_kritik') {
      critChance += 0.25;
      critMult += 0.35;
    } else if (aug === 'celik_irade') {
      maxHp = Math.round(maxHp * 1.22);
    } else if (aug === 'ruzgar_firtinasi') {
      atkSpeed *= 1.32;
      startMana += 15;
    }
  }

  return {
    maxHp,
    atk,
    atkSpeed: Number(atkSpeed.toFixed(2)),
    armor,
    range,
    maxMana: def.maxMana,
    startMana: Math.min(def.maxMana, startMana),
    spellPower,
    critChance: Math.min(0.95, critChance),
    critMult,
    lifesteal,
    startingShield,
    manaRegenPerSec,
    firstCastBonus,
    killHeal,
    tripleShot,
    isAssassin,
    tankManaOnHit,
  };
}

// ---- 3-STAR MERGING ----

export function tryMergeUnits(roster: OwnedUnit[]): {
  roster: OwnedUnit[];
  merges: MergeEvent[];
  returnedItems: ItemId[];
} {
  let current = roster.map((u) => ({ ...u, items: [...u.items], hex: u.hex ? { ...u.hex } : null }));
  const merges: MergeEvent[] = [];
  const returnedItems: ItemId[] = [];

  let didMerge = true;
  while (didMerge) {
    didMerge = false;
    const groups = new Map<string, OwnedUnit[]>();
    for (const unit of current) {
      if (unit.stars >= 3) continue;
      const key = `${unit.defId}_${unit.stars}`;
      const arr = groups.get(key) ?? [];
      arr.push(unit);
      groups.set(key, arr);
    }

    for (const [, copies] of groups.entries()) {
      if (copies.length >= 3) {
        const sorted = [...copies].sort((a, b) => {
          if (a.location === 'board' && b.location !== 'board') return -1;
          if (b.location === 'board' && a.location !== 'board') return 1;
          return (a.benchIndex ?? 99) - (b.benchIndex ?? 99);
        });

        const [anchor, consumed1, consumed2] = sorted;
        const combinedItems: ItemId[] = [...anchor.items, ...consumed1.items, ...consumed2.items];
        const keptItems = combinedItems.slice(0, 3);
        const overflow = combinedItems.slice(3);
        returnedItems.push(...overflow);

        const nextStars = (anchor.stars + 1) as StarLevel;
        const removeIds = new Set([consumed1.uid, consumed2.uid]);

        current = current
          .filter((u) => !removeIds.has(u.uid))
          .map((u) =>
            u.uid === anchor.uid
              ? {
                  ...u,
                  stars: nextStars,
                  items: keptItems,
                }
              : u,
          );

        merges.push({
          defId: anchor.defId,
          newStars: nextStars,
          uid: anchor.uid,
        });
        didMerge = true;
        break;
      }
    }
  }

  return { roster: current, merges, returnedItems };
}

// ---- SHOP & ECONOMY ----

export function rollShop(level: number, count = 5, rng: () => number = Math.random): ShopSlot[] {
  const clampedLevel = Math.max(1, Math.min(MAX_LEVEL, level));
  const odds = SHOP_ODDS_BY_LEVEL[clampedLevel];
  const byCost: Record<UnitCost, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const unit of SHINOBI_ROSTER) {
    byCost[unit.cost].push(unit.id);
  }

  const slots: ShopSlot[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rng() * 100;
    let acc = 0;
    let chosenCost: UnitCost = 1;
    for (let c = 0; c < 5; c++) {
      acc += odds[c];
      if (roll < acc) {
        chosenCost = (c + 1) as UnitCost;
        break;
      }
    }
    const pool = byCost[chosenCost];
    const picked = pool[Math.floor(rng() * pool.length)] ?? SHINOBI_ROSTER[0].id;
    slots.push({
      slotIndex: i,
      defId: picked,
      purchased: false,
    });
  }
  return slots;
}

export function getSellValue(cost: UnitCost, stars: StarLevel): number {
  if (stars === 1) return cost;
  if (stars === 2) return Math.max(2, cost * 3 - 1);
  return Math.max(5, cost * 7);
}

export function calculateRoundIncome(
  currentGold: number,
  nextStreakAbs: number,
  won: boolean,
  augments: AugmentId[] = [],
): { base: number; interest: number; streakBonus: number; winBonus: number; total: number } {
  const base = 5;
  const maxInterest = augments.includes('altin_yagmuru') ? 7 : 5;
  const interest = Math.min(maxInterest, Math.floor(Math.max(0, currentGold) / 10));
  let streakBonus = 0;
  if (nextStreakAbs >= 5) streakBonus = 3;
  else if (nextStreakAbs >= 4) streakBonus = 2;
  else if (nextStreakAbs >= 2) streakBonus = 1;
  const winBonus = won ? 1 : 0;
  return {
    base,
    interest,
    streakBonus,
    winBonus,
    total: base + interest + streakBonus + winBonus,
  };
}

export function addXp(
  level: number,
  xp: number,
  amount: number,
): { level: number; xp: number; leveledUp: boolean } {
  let curLevel = level;
  let curXp = xp + amount;
  let leveledUp = false;

  while (curLevel < MAX_LEVEL) {
    const needed = LEVEL_XP_TABLE[curLevel];
    if (curXp >= needed) {
      curXp -= needed;
      curLevel += 1;
      leveledUp = true;
    } else {
      break;
    }
  }
  if (curLevel >= MAX_LEVEL) {
    curXp = 0;
  }
  return { level: curLevel, xp: curXp, leveledUp };
}

export function calculatePlayerDamage(round: number, survivingEnemies: number): number {
  const base = Math.max(2, Math.floor(round * 1.4));
  return base + survivingEnemies * 3;
}

// ---- COMBAT SIMULATION ----

const PARTICLE_POOL_SIZE = 220;

function createEmptyParticles(): CombatParticle[] {
  const arr: CombatParticle[] = [];
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    arr.push({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      color: '#ffffff',
      size: 2,
      age: 0,
      life: 0.4,
    });
  }
  return arr;
}

function spawnParticles(
  state: CombatState,
  x: number,
  y: number,
  count: number,
  color: string,
  speed: number,
  size = 3,
  life = 0.48,
  rng: () => number,
): void {
  for (let i = 0; i < count; i++) {
    const p = state.particles[state.particleCursor];
    state.particleCursor = (state.particleCursor + 1) % PARTICLE_POOL_SIZE;
    const angle = rng() * Math.PI * 2;
    const spd = speed * (0.4 + rng() * 0.9);
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * spd;
    p.vy = Math.sin(angle) * spd - 0.8;
    p.color = color;
    p.size = size;
    p.age = 0;
    p.life = life * (0.7 + rng() * 0.6);
  }
}

function pushFloatingText(
  state: CombatState,
  x: number,
  y: number,
  text: string,
  color: string,
  isCrit = false,
  isJutsu = false,
): void {
  state.floatingTexts.push({
    id: state.nextEntityId++,
    x,
    y,
    text,
    color,
    age: 0,
    duration: isJutsu ? 1.25 : 0.78,
    isCrit,
    isJutsu,
  });
}

function pushVfx(
  state: CombatState,
  vfx: Omit<CombatState['vfx'][number], 'id' | 'age'>,
): void {
  state.vfx.push({
    ...vfx,
    id: state.nextEntityId++,
    age: 0,
  });
}

export function computeUnitDirection(dx: number, dy: number, fallback: UnitDirection = 'down'): UnitDirection {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < 0.02 && ay < 0.02) return fallback;
  // Prefer crisp horizontal side profile when fighting diagonally/sideways, and true front/back when moving vertically!
  if (ay > ax * 1.15) {
    return dy < 0 ? 'up' : 'down';
  }
  return dx >= 0 ? 'right' : 'left';
}

function pushAfterimage(
  state: CombatState,
  unit: CombatUnit,
  x: number,
  y: number,
  tint: string,
  duration = 0.36,
): void {
  state.afterimages.push({
    id: state.nextEntityId++,
    defId: unit.defId,
    x,
    y,
    facing: unit.facing,
    dir: unit.dir,
    tint,
    age: 0,
    duration,
  });
}

function makeCombatUnit(
  uid: string,
  defId: string,
  team: 'player' | 'enemy',
  stars: StarLevel,
  col: number,
  row: number,
  items: ItemId[],
  synergies: ActiveSynergy[],
  augments: AugmentId[],
  lootDrop?: EnemyWaveUnit['lootDrop'],
): CombatUnit {
  const stats = computeUnitStats(defId, stars, items, synergies, augments);
  return {
    uid,
    defId,
    team,
    stars,
    items: [...items],
    lootDrop,
    stats,
    hp: stats.maxHp,
    ghostHp: stats.maxHp,
    shield: stats.startingShield,
    mana: stats.startMana,
    col,
    row,
    x: col,
    y: row,
    targetX: col,
    targetY: row,
    facing: team === 'player' ? 1 : -1,
    dir: team === 'player' ? 'up' : 'down',
    attackCooldown: 0.25,
    moveCooldown: 0,
    attackCounter: 0,
    castCount: 0,
    stunTimer: 0,
    burnTimer: 0,
    burnDps: 0,
    atkSpeedBuffTimer: 0,
    atkSpeedBuffMult: 1,
    hitFlashTimer: 0,
    animState: 'idle',
    animTimer: 0,
    animDuration: 0.4,
    lungeX: 0,
    lungeY: 0,
    koTimer: 0,
    koDuration: 0.85,
    alive: true,
    damageDealt: 0,
    healerTimer: 0,
    assassinLeaped: false,
  };
}

export function createCombatState(
  playerBoardUnits: OwnedUnit[],
  enemyWaveUnits: EnemyWaveUnit[],
  options?: {
    seed?: number;
    playerAugments?: AugmentId[];
    enemyAugments?: AugmentId[];
  },
): CombatState {
  const playerAugments = options?.playerAugments ?? [];
  const enemyAugments = options?.enemyAugments ?? [];
  const seed = options?.seed ?? Math.floor(Math.random() * 0x7fffffff);

  const playerSynergies = calculateSynergies(playerBoardUnits);
  const enemySynergies = calculateSynergies(enemyWaveUnits);

  const units: CombatUnit[] = [];
  for (const pu of playerBoardUnits) {
    if (!pu.hex) continue;
    units.push(
      makeCombatUnit(
        pu.uid,
        pu.defId,
        'player',
        pu.stars,
        pu.hex.col,
        pu.hex.row,
        pu.items,
        playerSynergies,
        playerAugments,
      ),
    );
  }
  enemyWaveUnits.forEach((eu, idx) => {
    units.push(
      makeCombatUnit(
        `enemy_${idx}_${eu.defId}`,
        eu.defId,
        'enemy',
        eu.stars,
        eu.col,
        eu.row,
        eu.items ?? [],
        enemySynergies,
        enemyAugments,
        eu.lootDrop,
      ),
    );
  });

  return {
    units,
    projectiles: [],
    vfx: [],
    afterimages: [],
    floatingTexts: [],
    particles: createEmptyParticles(),
    particleCursor: 0,
    nextEntityId: 1,
    elapsed: 0,
    hitstopTimer: 0,
    trauma: 0,
    skyDarken: 0,
    skyDarkenColor: '#0c0618',
    rngState: seed >>> 0,
    winner: null,
    playerSynergies,
    enemySynergies,
    events: [],
  };
}

/**
 * Runs a full deterministic combat match headlessly (used by server.ts for authoritative PvP scoring).
 */
export function simulateHeadlessCombat(
  playerBoardUnits: OwnedUnit[],
  enemyWaveUnits: EnemyWaveUnit[],
  options?: {
    seed?: number;
    playerAugments?: AugmentId[];
    enemyAugments?: AugmentId[];
  },
): { winner: 'player' | 'enemy'; survivingPlayers: number; survivingEnemies: number } {
  const combat = createCombatState(playerBoardUnits, enemyWaveUnits, options);
  let ticks = 0;
  while (combat.winner === null && ticks < 3000) {
    stepCombat(combat, 0.04);
    ticks++;
  }
  const survivingPlayers = combat.units.filter((u) => u.team === 'player' && u.alive).length;
  const survivingEnemies = combat.units.filter((u) => u.team === 'enemy' && u.alive).length;
  const winner = combat.winner ?? (survivingPlayers >= survivingEnemies ? 'player' : 'enemy');
  return { winner, survivingPlayers, survivingEnemies };
}

function applyDamage(
  state: CombatState,
  attacker: CombatUnit | null,
  target: CombatUnit,
  rawDamage: number,
  isSpell: boolean,
  isCrit: boolean,
  rng: () => number,
): number {
  if (!target.alive) return 0;

  const mitigation = isSpell
    ? 100 / (100 + target.stats.armor * 0.45)
    : 100 / (100 + target.stats.armor);
  const dmg = Math.max(8, Math.round(rawDamage * mitigation));

  if (attacker) {
    attacker.damageDealt += dmg;
    if (attacker.stats.lifesteal > 0) {
      const heal = Math.round(dmg * attacker.stats.lifesteal);
      attacker.hp = Math.min(attacker.stats.maxHp, attacker.hp + heal);
    }
  }

  let remaining = dmg;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }

  target.hp = Math.max(0, target.hp - remaining);
  target.hitFlashTimer = 0.09;
  target.mana = Math.min(
    target.stats.maxMana,
    target.mana + 6 + target.stats.tankManaOnHit,
  );

  pushFloatingText(
    state,
    target.x + (rng() - 0.5) * 0.25,
    target.y - 0.35,
    isCrit ? `${dmg}!` : `${dmg}`,
    isCrit ? '#facc15' : isSpell ? '#38bdf8' : '#f8fafc',
    isCrit,
  );

  if (isCrit) {
    state.events.push({ type: 'crit' });
    spawnParticles(state, target.x, target.y, 10, '#dc2626', 3.8, 3.5, 0.45, rng);
    spawnParticles(state, target.x, target.y, 8, '#facc15', 3.4, 3, 0.4, rng);
  } else {
    state.events.push({ type: 'hit' });
    spawnParticles(
      state,
      target.x,
      target.y,
      7,
      isSpell ? '#38bdf8' : '#b91c1c',
      2.6,
      3,
      0.36,
      rng,
    );
  }

  if (target.hp <= 0) {
    target.alive = false;
    target.animState = 'ko';
    target.koDuration = 0.85;
    target.koTimer = target.koDuration;
    state.hitstopTimer = Math.max(state.hitstopTimer, 0.045);
    state.trauma = Math.min(1, state.trauma + 0.35);
    state.events.push({ type: 'ko' });
    if (target.team === 'enemy' && target.lootDrop) {
      state.events.push({
        type: 'loot_drop',
        x: target.x,
        y: target.y,
        lootDrop: target.lootDrop,
      });
      spawnParticles(
        state,
        target.x,
        target.y,
        14,
        target.lootDrop.tier === 'gold' ? '#facc15' : target.lootDrop.tier === 'rare' ? '#38bdf8' : '#e2e8f0',
        4.4,
        4,
        0.65,
        rng,
      );
    }
    spawnParticles(state, target.x, target.y, 14, '#991b1b', 4.2, 4, 0.56, rng);
    spawnParticles(state, target.x, target.y, 10, '#e2e8f0', 3.4, 3, 0.48, rng);

    if (attacker && attacker.alive && attacker.stats.killHeal > 0) {
      attacker.hp = Math.min(attacker.stats.maxHp, attacker.hp + attacker.stats.killHeal);
      pushFloatingText(state, attacker.x, attacker.y - 0.45, `+${attacker.stats.killHeal}`, '#4ade80');
    }
  }

  return dmg;
}

function castJutsu(
  state: CombatState,
  caster: CombatUnit,
  primaryTarget: CombatUnit,
  enemies: CombatUnit[],
  allies: CombatUnit[],
  rng: () => number,
): void {
  const def = SHINOBI_BY_ID[caster.defId];
  const starScale = getStarMultiplier(caster.stars);
  const firstBonus = caster.castCount === 0 ? 1 + caster.stats.firstCastBonus : 1;
  const sp = caster.stats.spellPower * starScale * firstBonus;

  caster.mana = 0;
  caster.castCount += 1;
  caster.animState = 'cast';
  caster.animDuration = 0.64;
  caster.animTimer = caster.animDuration;
  caster.dir = computeUnitDirection(primaryTarget.x - caster.x, primaryTarget.y - caster.y, caster.dir);
  caster.facing = primaryTarget.x >= caster.x ? 1 : -1;
  state.hitstopTimer = Math.max(state.hitstopTimer, 0.042);
  state.trauma = Math.min(1, state.trauma + 0.28);
  state.events.push({ type: 'jutsu', jutsuType: def.jutsuType });

  // Universal crisp pixel chakra seal flash beneath caster on every jutsu!
  pushVfx(state, {
    kind: 'cast_seal',
    x: caster.x,
    y: caster.y,
    color: def.accentColor,
    duration: 0.46,
    scale: 1.05,
  });

  pushFloatingText(state, caster.x, caster.y - 0.68, def.jutsuName, def.accentColor, false, true);

  switch (def.jutsuType) {
    case 'rasen_sphere': {
      // Dash afterimages + spinning cyan Rasengan projectile -> spiral impact crater!
      const dx = primaryTarget.x - caster.x;
      const dy = primaryTarget.y - caster.y;
      pushAfterimage(state, caster, caster.x, caster.y, '#38bdf8', 0.34);
      pushAfterimage(state, caster, caster.x + dx * 0.28, caster.y + dy * 0.28, '#7dd3fc', 0.28);
      caster.lungeX = dx * 0.28;
      caster.lungeY = dy * 0.28;
      state.projectiles.push({
        id: state.nextEntityId++,
        sourceUid: caster.uid,
        targetUid: primaryTarget.uid,
        team: caster.team,
        x: caster.x,
        y: caster.y,
        startX: caster.x,
        startY: caster.y,
        targetX: primaryTarget.x,
        targetY: primaryTarget.y,
        progress: 0,
        speed: 5.4,
        damage: 230 * sp,
        isCrit: false,
        isSpell: true,
        kind: 'rasen',
        color: '#38bdf8',
        stunDuration: 0.8,
        onImpactVfx: 'rasen_burst',
      });
      spawnParticles(state, caster.x, caster.y, 12, '#7dd3fc', 3.4, 3, 0.4, rng);
      break;
    }

    case 'cherry_heal': {
      // Seismic sakura punch + swirling sakura petal storm over wounded allies
      const wounded = [...allies].sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp).slice(0, 2);
      const healAmt = Math.round(240 * sp);
      pushVfx(state, {
        kind: 'sakura_storm',
        x: caster.x,
        y: caster.y,
        color: '#f472b6',
        duration: 0.68,
        scale: 1.35,
      });
      for (const ally of wounded) {
        ally.hp = Math.min(ally.stats.maxHp, ally.hp + healAmt);
        pushVfx(state, { kind: 'heal_ring', x: ally.x, y: ally.y, color: '#f472b6', duration: 0.65, scale: 1.15 });
        pushFloatingText(state, ally.x, ally.y - 0.45, `+${healAmt}`, '#4ade80');
        spawnParticles(state, ally.x, ally.y, 10, '#fbcfe8', 2.8, 3.5, 0.5, rng);
      }
      state.events.push({ type: 'heal' });
      applyDamage(state, caster, primaryTarget, 130 * sp, true, false, rng);
      break;
    }

    case 'lotus_combo': {
      // Emerald 8-Gates steam burst + triple green afterimages + high-speed lotus slash storm
      caster.atkSpeedBuffTimer = 4.0;
      caster.atkSpeedBuffMult = 1.45;
      pushAfterimage(state, caster, caster.x - 0.25, caster.y - 0.12, '#22c55e', 0.4);
      pushAfterimage(state, caster, primaryTarget.x + 0.22, primaryTarget.y - 0.14, '#4ade80', 0.34);
      pushVfx(state, {
        kind: 'lotus_slash',
        x: primaryTarget.x,
        y: primaryTarget.y,
        color: '#4ade80',
        duration: 0.56,
        scale: 1.35,
      });
      applyDamage(state, caster, primaryTarget, 210 * sp, false, true, rng);
      spawnParticles(state, primaryTarget.x, primaryTarget.y, 20, '#4ade80', 4.4, 3.5, 0.52, rng);
      break;
    }

    case 'poison_needles': {
      // Fan volley of glowing purple poison senbon needles -> venom cloud impact!
      const targets = [
        primaryTarget,
        ...enemies
          .filter((e) => e.uid !== primaryTarget.uid)
          .sort((a, b) => hexDistance(primaryTarget, a) - hexDistance(primaryTarget, b))
          .slice(0, 1),
      ];
      for (const t of targets) {
        for (let k = -1; k <= 1; k++) {
          state.projectiles.push({
            id: state.nextEntityId++,
            sourceUid: caster.uid,
            targetUid: t.uid,
            team: caster.team,
            x: caster.x + k * 0.12,
            y: caster.y - 0.08,
            startX: caster.x + k * 0.14,
            startY: caster.y - 0.08,
            targetX: t.x,
            targetY: t.y,
            progress: 0,
            speed: 5.8 + (k === 0 ? 0.5 : 0),
            damage: k === 0 ? 150 * sp : 0, // Center needle carries full payload, side needles add dramatic volley flair
            isCrit: false,
            isSpell: true,
            kind: 'needle',
            color: '#c084fc',
            burnDps: k === 0 ? 45 * sp : undefined,
            onImpactVfx: k === 0 ? 'poison_cloud' : undefined,
          });
        }
      }
      break;
    }

    case 'chidori_dash': {
      // Electric blink afterimages + multi-branch jagged Chidori lightning spear!
      const mx = (caster.x + primaryTarget.x) * 0.5;
      const my = (caster.y + primaryTarget.y) * 0.5;
      pushAfterimage(state, caster, caster.x, caster.y, '#38bdf8', 0.38);
      pushAfterimage(state, caster, mx, my, '#7dd3fc', 0.3);
      pushVfx(state, {
        kind: 'chidori_arc',
        x: caster.x,
        y: caster.y,
        tx: primaryTarget.x,
        ty: primaryTarget.y,
        color: '#38bdf8',
        duration: 0.54,
        scale: 1.35,
      });
      applyDamage(state, caster, primaryTarget, 290 * sp, true, true, rng);
      spawnParticles(state, primaryTarget.x, primaryTarget.y, 26, '#7dd3fc', 5.0, 3.5, 0.5, rng);
      break;
    }

    case 'twin_lion_shield': {
      // Twin glowing blue-violet chakra lion-fist projectiles + Byakugan rotation dome!
      const shieldAmt = Math.round(320 * sp);
      caster.shield += shieldAmt;
      pushVfx(state, {
        kind: 'lion_burst',
        x: caster.x,
        y: caster.y,
        color: '#818cf8',
        duration: 0.65,
        scale: 1.25,
      });
      pushFloatingText(state, caster.x, caster.y - 0.45, `+${shieldAmt} Kalkan`, '#93c5fd');
      state.projectiles.push({
        id: state.nextEntityId++,
        sourceUid: caster.uid,
        targetUid: primaryTarget.uid,
        team: caster.team,
        x: caster.x,
        y: caster.y,
        startX: caster.x,
        startY: caster.y,
        targetX: primaryTarget.x,
        targetY: primaryTarget.y,
        progress: 0,
        speed: 5.2,
        damage: 160 * sp,
        isCrit: false,
        isSpell: true,
        kind: 'lion_fist',
        color: '#818cf8',
        manaDrain: 25,
        onImpactVfx: 'lion_burst',
      });
      spawnParticles(state, caster.x, caster.y, 14, '#a5b4fc', 3.4, 3, 0.45, rng);
      break;
    }

    case 'shadow_bind': {
      // Creeping jagged black ink tendrils along the arena floor + dark binding ring!
      const strongest = [...enemies].sort((a, b) => b.stats.atk - a.stats.atk)[0] ?? primaryTarget;
      pushVfx(state, {
        kind: 'shadow_line',
        x: caster.x,
        y: caster.y,
        tx: strongest.x,
        ty: strongest.y,
        color: '#94a3b8',
        duration: 0.78,
        scale: 1.25,
      });
      strongest.stunTimer = Math.max(strongest.stunTimer, 2.2);
      applyDamage(state, caster, strongest, 220 * sp, true, false, rng);
      spawnParticles(state, strongest.x, strongest.y, 16, '#1e293b', 3.0, 4, 0.55, rng);
      break;
    }

    case 'lightning_cutter': {
      // High-intensity Raikiri piercing beam + thunder pillar + afterimage lunge!
      caster.atkSpeedBuffTimer = 4.0;
      caster.atkSpeedBuffMult = 1.35;
      pushAfterimage(state, caster, caster.x, caster.y, '#60a5fa', 0.36);
      pushVfx(state, {
        kind: 'raikiri_beam',
        x: caster.x,
        y: caster.y,
        tx: primaryTarget.x,
        ty: primaryTarget.y,
        color: '#60a5fa',
        duration: 0.56,
        scale: 1.4,
      });
      applyDamage(state, caster, primaryTarget, 340 * sp, true, true, rng);
      spawnParticles(state, primaryTarget.x, primaryTarget.y, 26, '#bae6fd', 5.2, 3.5, 0.52, rng);
      break;
    }

    case 'sand_coffin': {
      // Surging golden sand wave + towering desert vortex crushing surrounding foes!
      const shieldAmt = Math.round(420 * sp);
      caster.shield += shieldAmt;
      pushVfx(state, { kind: 'sand_pillar', x: caster.x, y: caster.y, color: '#f59e0b', duration: 0.78, scale: 1.6 });
      for (const e of enemies) {
        if (hexDistance(caster, e) <= 2) {
          pushVfx(state, { kind: 'sand_pillar', x: e.x, y: e.y, color: '#fbbf24', duration: 0.68, scale: 1.1 });
          applyDamage(state, caster, e, 210 * sp, true, false, rng);
          e.stunTimer = Math.max(e.stunTimer, 1.4);
          spawnParticles(state, e.x, e.y, 14, '#fcd34d', 3.6, 3.5, 0.55, rng);
        }
      }
      break;
    }

    case 'clay_bird': {
      // Flapping white pixel clay bird arching across the arena with sparkling fuse -> C3 explosion!
      state.projectiles.push({
        id: state.nextEntityId++,
        sourceUid: caster.uid,
        targetUid: primaryTarget.uid,
        team: caster.team,
        x: caster.x,
        y: caster.y,
        startX: caster.x,
        startY: caster.y,
        targetX: primaryTarget.x,
        targetY: primaryTarget.y,
        progress: 0,
        speed: 3.4,
        damage: 260 * sp,
        isCrit: false,
        isSpell: true,
        kind: 'clay_bird',
        color: '#fbbf24',
        arcHeight: 1.15,
        aoeRadius: 1.65,
        onImpactVfx: 'clay_boom',
      });
      break;
    }

    case 'crimson_flames': {
      // Sky darkens briefly + crimson Mangekyo eye flash + pitch-black Amaterasu flames & crow feathers!
      state.skyDarken = Math.max(state.skyDarken, 0.55);
      state.skyDarkenColor = '#1c050a';
      const targets = [...enemies]
        .sort((a, b) => hexDistance(caster, a) - hexDistance(caster, b))
        .slice(0, 3);
      for (const t of targets) {
        pushVfx(state, {
          kind: 'crimson_flame',
          x: t.x,
          y: t.y,
          tx: caster.x,
          ty: caster.y,
          color: '#dc2626',
          duration: 0.82,
          scale: 1.4,
        });
        applyDamage(state, caster, t, 250 * sp, true, false, rng);
        t.burnTimer = Math.max(t.burnTimer, 4.0);
        t.burnDps = Math.max(t.burnDps, 65 * sp);
        spawnParticles(state, t.x, t.y, 16, '#dc2626', 3.4, 3.5, 0.6, rng);
      }
      break;
    }

    case 'toad_oil_flame': {
      // Roaring layered pixel flame cone (white -> yellow -> orange -> crimson)
      pushVfx(state, {
        kind: 'fire_cone',
        x: caster.x,
        y: caster.y,
        tx: primaryTarget.x,
        ty: primaryTarget.y,
        color: '#f97316',
        duration: 0.78,
        scale: 1.75,
      });
      for (const e of enemies) {
        if (hexDistance(primaryTarget, e) <= 2) {
          applyDamage(state, caster, e, 340 * sp, true, false, rng);
          e.burnTimer = Math.max(e.burnTimer, 3.0);
          e.burnDps = Math.max(e.burnDps, 50 * sp);
          spawnParticles(state, e.x, e.y, 16, '#fb923c', 4.2, 3.5, 0.55, rng);
        }
      }
      break;
    }

    case 'flying_flash': {
      // Golden Hiraishin kunai + instant yellow Z-pattern teleport lightning flashes + golden afterimages!
      state.skyDarken = Math.max(state.skyDarken, 0.45);
      state.skyDarkenColor = '#1c1504';
      const weakest = [...enemies].sort((a, b) => a.hp - b.hp).slice(0, 3);
      let prevX = caster.x;
      let prevY = caster.y;
      pushAfterimage(state, caster, prevX, prevY, '#facc15', 0.45);
      for (const t of weakest) {
        pushVfx(state, {
          kind: 'flash_line',
          x: prevX,
          y: prevY,
          tx: t.x,
          ty: t.y,
          color: '#facc15',
          duration: 0.62,
          scale: 1.35,
        });
        pushAfterimage(state, caster, t.x, t.y, '#fde047', 0.42);
        applyDamage(state, caster, t, 310 * sp, false, true, rng);
        prevX = t.x;
        prevY = t.y;
      }
      spawnParticles(state, prevX, prevY, 28, '#facc15', 5.0, 3.5, 0.55, rng);
      break;
    }

    case 'meteor_drop': {
      // Sky-darkening colossal flaming pixel meteor descent + dual purple Susanoo shockwave!
      state.skyDarken = Math.max(state.skyDarken, 0.85);
      state.skyDarkenColor = '#140624';
      const cx = primaryTarget.x;
      const cy = primaryTarget.y;
      pushVfx(state, { kind: 'meteor', x: cx, y: cy, color: '#9333ea', duration: 0.98, scale: 2.15 });
      state.trauma = Math.min(1, state.trauma + 0.72);
      for (const e of enemies) {
        applyDamage(state, caster, e, 380 * sp, true, false, rng);
        e.stunTimer = Math.max(e.stunTimer, 1.6);
      }
      spawnParticles(state, cx, cy, 38, '#c084fc', 5.6, 4.5, 0.75, rng);
      spawnParticles(state, cx, cy, 24, '#f97316', 4.6, 4, 0.65, rng);
      break;
    }
  }
}

export function stepCombat(
  state: CombatState,
  rawDt: number,
  externalRng?: () => number,
): void {
  const rng = externalRng ?? (() => nextSeededRandom(state));
  const dt = Math.min(0.05, Math.max(0, rawDt));
  state.events = [];

  // Visual timers always tick even during hitstop
  state.trauma = Math.max(0, state.trauma - dt * 1.9);
  state.skyDarken = Math.max(0, state.skyDarken - dt * 1.15);

  for (const p of state.particles) {
    if (!p.active) continue;
    p.age += dt;
    if (p.age >= p.life) {
      p.active = false;
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 4.5 * dt;
  }

  for (let i = state.vfx.length - 1; i >= 0; i--) {
    state.vfx[i].age += dt;
    if (state.vfx[i].age >= state.vfx[i].duration) {
      state.vfx.splice(i, 1);
    }
  }

  for (let i = state.afterimages.length - 1; i >= 0; i--) {
    state.afterimages[i].age += dt;
    if (state.afterimages[i].age >= state.afterimages[i].duration) {
      state.afterimages.splice(i, 1);
    }
  }

  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    state.floatingTexts[i].age += dt;
    state.floatingTexts[i].y -= dt * 0.75;
    if (state.floatingTexts[i].age >= state.floatingTexts[i].duration) {
      state.floatingTexts.splice(i, 1);
    }
  }

  for (const u of state.units) {
    if (u.hitFlashTimer > 0) u.hitFlashTimer = Math.max(0, u.hitFlashTimer - dt);
    if (u.ghostHp > u.hp) {
      u.ghostHp = Math.max(u.hp, u.ghostHp - u.stats.maxHp * 0.85 * dt);
    } else {
      u.ghostHp = u.hp;
    }
    u.lungeX *= Math.max(0, 1 - dt * 12);
    u.lungeY *= Math.max(0, 1 - dt * 12);
    if (!u.alive && u.koTimer > 0) {
      u.koTimer = Math.max(0, u.koTimer - dt);
    }
  }

  if (state.winner !== null) return;

  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return;
  }

  state.elapsed += dt;

  const alivePlayers = state.units.filter((u) => u.alive && u.team === 'player');
  const aliveEnemies = state.units.filter((u) => u.alive && u.team === 'enemy');

  if (alivePlayers.length === 0 || aliveEnemies.length === 0) {
    state.winner = alivePlayers.length > 0 ? 'player' : 'enemy';
    return;
  }

  const overtime = state.elapsed > 45;

  // Step projectiles
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const proj = state.projectiles[i];
    const target = state.units.find((u) => u.uid === proj.targetUid);
    if (target && target.alive) {
      proj.targetX = target.x;
      proj.targetY = target.y;
    }
    const dist = Math.max(0.25, Math.hypot(proj.targetX - proj.startX, proj.targetY - proj.startY));
    proj.progress += (proj.speed * dt) / dist;
    const clampedP = Math.min(1, proj.progress);
    const arcLift = proj.arcHeight ? Math.sin(clampedP * Math.PI) * proj.arcHeight : 0;
    proj.x = proj.startX + (proj.targetX - proj.startX) * clampedP;
    proj.y = proj.startY + (proj.targetY - proj.startY) * clampedP - arcLift;

    // Emit subtle pixel trail sparks for spell projectiles
    if (proj.isSpell && rng() < dt * 28) {
      spawnParticles(state, proj.x, proj.y, 1, proj.color, 1.1, 3, 0.24, rng);
    }

    if (proj.progress >= 1) {
      const attacker = state.units.find((u) => u.uid === proj.sourceUid) ?? null;

      if (proj.onImpactVfx) {
        pushVfx(state, {
          kind: proj.onImpactVfx,
          x: proj.targetX,
          y: proj.targetY,
          color: proj.color,
          duration: proj.onImpactVfx === 'clay_boom' ? 0.65 : 0.56,
          scale: proj.aoeRadius ? 1.6 : 1.25,
        });
      }

      if (proj.aoeRadius) {
        spawnParticles(state, proj.targetX, proj.targetY, 26, '#fbbf24', 4.8, 4, 0.58, rng);
        spawnParticles(state, proj.targetX, proj.targetY, 14, '#ef4444', 3.4, 3.5, 0.45, rng);
        state.trauma = Math.min(1, state.trauma + 0.35);
        const foes = state.units.filter((u) => u.alive && u.team !== proj.team);
        for (const f of foes) {
          if (Math.hypot(f.x - proj.targetX, f.y - proj.targetY) <= proj.aoeRadius) {
            applyDamage(state, attacker, f, proj.damage, proj.isSpell, proj.isCrit, rng);
          }
        }
      } else if (target && target.alive && proj.damage > 0) {
        applyDamage(state, attacker, target, proj.damage, proj.isSpell, proj.isCrit, rng);
        if (proj.stunDuration) {
          target.stunTimer = Math.max(target.stunTimer, proj.stunDuration);
        }
        if (proj.manaDrain) {
          target.mana = Math.max(0, target.mana - proj.manaDrain);
        }
        if (proj.burnDps) {
          target.burnTimer = Math.max(target.burnTimer, 3.0);
          target.burnDps = Math.max(target.burnDps, proj.burnDps);
        }
      }
      state.projectiles.splice(i, 1);
    }
  }

  // Occupied hex set for alive units
  const occupied = new Set<string>();
  for (const u of state.units) {
    if (u.alive) occupied.add(`${u.col},${u.row}`);
  }

  for (const unit of state.units) {
    if (!unit.alive) continue;

    const lerpRate = Math.min(1, dt * 8.5);
    unit.x += (unit.col - unit.x) * lerpRate;
    unit.y += (unit.row - unit.y) * lerpRate;

    if (unit.animTimer > 0) {
      unit.animTimer = Math.max(0, unit.animTimer - dt);
      if (unit.animTimer === 0 && unit.animState !== 'ko') {
        unit.animState = 'idle';
      }
    }

    if (unit.atkSpeedBuffTimer > 0) {
      unit.atkSpeedBuffTimer = Math.max(0, unit.atkSpeedBuffTimer - dt);
      if (unit.atkSpeedBuffTimer === 0) unit.atkSpeedBuffMult = 1;
    }

    if (unit.stats.manaRegenPerSec > 0) {
      unit.mana = Math.min(unit.stats.maxMana, unit.mana + unit.stats.manaRegenPerSec * dt);
    }

    if (unit.burnTimer > 0) {
      unit.burnTimer = Math.max(0, unit.burnTimer - dt);
      const burnTick = unit.burnDps * dt;
      unit.hp = Math.max(1, unit.hp - burnTick);
      if (rng() < dt * 4) {
        spawnParticles(state, unit.x, unit.y, 1, '#ef4444', 1.2, 2.5, 0.3, rng);
      }
    }

    const teamSynergies = unit.team === 'player' ? state.playerSynergies : state.enemySynergies;
    const def = SHINOBI_BY_ID[unit.defId];
    if (def.role === 'sifaci' && getSynergyTier(teamSynergies, 'sifaci') >= 0) {
      unit.healerTimer += dt;
      if (unit.healerTimer >= 4.0) {
        unit.healerTimer = 0;
        const allies = state.units.filter((a) => a.alive && a.team === unit.team);
        const lowest = [...allies].sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0];
        if (lowest && lowest.hp < lowest.stats.maxHp) {
          const heal = Math.round(lowest.stats.maxHp * 0.14);
          lowest.hp = Math.min(lowest.stats.maxHp, lowest.hp + heal);
          pushVfx(state, { kind: 'heal_ring', x: lowest.x, y: lowest.y, color: '#4ade80', duration: 0.45, scale: 0.85 });
          pushFloatingText(state, lowest.x, lowest.y - 0.4, `+${heal}`, '#4ade80');
        }
      }
    }

    // Assassin opening leap to enemy backline with afterimage
    if (unit.stats.isAssassin && !unit.assassinLeaped && state.elapsed > 0.12) {
      unit.assassinLeaped = true;
      const targetRow = unit.team === 'player' ? 0 : BOARD_ROWS - 1;
      let bestCol = unit.col;
      let found = false;
      for (let offset = 0; offset < BOARD_COLS; offset++) {
        for (const dir of [0, 1, -1]) {
          const c = unit.col + offset * dir;
          if (c < 0 || c >= BOARD_COLS) continue;
          if (!occupied.has(`${c},${targetRow}`)) {
            bestCol = c;
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) {
        occupied.delete(`${unit.col},${unit.row}`);
        pushAfterimage(state, unit, unit.x, unit.y, '#38bdf8', 0.4);
        pushVfx(state, {
          kind: 'flash_line',
          x: unit.x,
          y: unit.y,
          tx: bestCol,
          ty: targetRow,
          color: '#38bdf8',
          duration: 0.4,
          scale: 1.05,
        });
        unit.col = bestCol;
        unit.row = targetRow;
        occupied.add(`${unit.col},${unit.row}`);
      }
    }

    if (unit.stunTimer > 0) {
      unit.stunTimer = Math.max(0, unit.stunTimer - dt);
      continue;
    }

    const foes = state.units.filter((f) => f.alive && f.team !== unit.team);
    if (foes.length === 0) break;

    let target = foes[0];
    let minDist = hexDistance(unit, target);
    for (let i = 1; i < foes.length; i++) {
      const d = hexDistance(unit, foes[i]);
      if (d < minDist) {
        minDist = d;
        target = foes[i];
      }
    }

    unit.facing = target.x >= unit.x ? 1 : -1;

    if (minDist <= unit.stats.range) {
      unit.dir = computeUnitDirection(target.x - unit.x, target.y - unit.y, unit.dir);
      if (unit.mana >= unit.stats.maxMana) {
        const allies = state.units.filter((a) => a.alive && a.team === unit.team);
        castJutsu(state, unit, target, foes, allies, rng);
        unit.attackCooldown = 0.58;
        continue;
      }

      unit.attackCooldown -= dt;
      if (unit.attackCooldown <= 0) {
        const effSpeed = unit.stats.atkSpeed * unit.atkSpeedBuffMult * (overtime ? 1.8 : 1);
        unit.attackCooldown = 1 / Math.max(0.25, effSpeed);
        unit.attackCounter += 1;
        unit.animState = 'attack';
        unit.animDuration = 0.36;
        unit.animTimer = unit.animDuration;
        unit.mana = Math.min(unit.stats.maxMana, unit.mana + 12);

        const shots = unit.stats.tripleShot && unit.attackCounter % 3 === 0 ? 2 : 1;
        for (let s = 0; s < shots; s++) {
          const isCrit = rng() < unit.stats.critChance;
          const dmg = unit.stats.atk * (isCrit ? unit.stats.critMult : 1) * (overtime ? 1.6 : 1);

          if (unit.stats.range <= 1) {
            const dx = target.x - unit.x;
            const dy = target.y - unit.y;
            const len = Math.max(0.01, Math.hypot(dx, dy));
            unit.lungeX = (dx / len) * 0.28;
            unit.lungeY = (dy / len) * 0.28;
            // Crisp directional pixel slash arc on melee hits!
            pushVfx(state, {
              kind: 'melee_slash',
              x: unit.x,
              y: unit.y,
              tx: target.x,
              ty: target.y,
              color: isCrit ? '#fde047' : def.accentColor,
              duration: 0.22,
              scale: isCrit ? 1.15 : 0.85,
            });
            applyDamage(state, unit, target, dmg, false, isCrit, rng);
          } else {
            const projKind =
              unit.defId === 'deidarra'
                ? 'clay_bird'
                : unit.defId === 'gaarra'
                  ? 'sand'
                  : unit.defId === 'kankurro'
                    ? 'needle'
                    : unit.defId === 'itachii' || unit.defId === 'jirayaa'
                      ? 'fireball'
                      : unit.defId === 'kakaashi' || unit.defId === 'shikamar'
                        ? 'kunai'
                        : 'shuriken';
            state.projectiles.push({
              id: state.nextEntityId++,
              sourceUid: unit.uid,
              targetUid: target.uid,
              team: unit.team,
              x: unit.x + s * 0.12,
              y: unit.y - 0.1,
              startX: unit.x + s * 0.12,
              startY: unit.y - 0.1,
              targetX: target.x,
              targetY: target.y,
              progress: 0,
              speed: 6.4,
              damage: dmg,
              isCrit,
              isSpell: false,
              kind: projKind,
              color: def.accentColor,
            });
          }
        }
      }
    } else {
      unit.moveCooldown -= dt;
      if (unit.moveCooldown <= 0) {
        const neighbors = getHexNeighbors(unit.col, unit.row);
        let bestHex: HexCoord | null = null;
        let bestDist = minDist;
        for (const n of neighbors) {
          if (occupied.has(`${n.col},${n.row}`)) continue;
          const d = hexDistance(n, target);
          if (d < bestDist) {
            bestDist = d;
            bestHex = n;
          }
        }
        if (bestHex) {
          const stepDx = bestHex.col - unit.col;
          const stepDy = bestHex.row - unit.row;
          occupied.delete(`${unit.col},${unit.row}`);
          unit.col = bestHex.col;
          unit.row = bestHex.row;
          occupied.add(`${unit.col},${unit.row}`);
          unit.dir = computeUnitDirection(stepDx, stepDy, unit.dir);
          if (stepDx !== 0) unit.facing = stepDx > 0 ? 1 : -1;
          unit.animState = 'walk';
          unit.animDuration = 0.42;
          unit.animTimer = unit.animDuration;
          unit.moveCooldown = 0.42;
        } else {
          unit.moveCooldown = 0.18;
        }
      }
    }
  }

  const remPlayers = state.units.filter((u) => u.alive && u.team === 'player').length;
  const remEnemies = state.units.filter((u) => u.alive && u.team === 'enemy').length;
  if (remPlayers === 0 || remEnemies === 0) {
    state.winner = remPlayers > 0 ? 'player' : 'enemy';
  }
}
