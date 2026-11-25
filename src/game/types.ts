export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type RoundPhase = 'prep' | 'combat' | 'resolution';

export type OriginId = 'yaprak' | 'kizil_klan' | 'kum' | 'bulut_orgutu' | 'sannin';

export type RoleId = 'dovuscu' | 'suikastci' | 'buyucu' | 'tank' | 'nisanci' | 'sifaci';

export type TraitId = OriginId | RoleId;

export type UnitCost = 1 | 2 | 3 | 4 | 5;

export type StarLevel = 1 | 2 | 3;

export type JutsuType =
  | 'rasen_sphere'
  | 'cherry_heal'
  | 'lotus_combo'
  | 'poison_needles'
  | 'chidori_dash'
  | 'twin_lion_shield'
  | 'shadow_bind'
  | 'lightning_cutter'
  | 'sand_coffin'
  | 'clay_bird'
  | 'crimson_flames'
  | 'toad_oil_flame'
  | 'flying_flash'
  | 'meteor_drop';

export interface ShinobiDef {
  id: string;
  name: string;
  title: string;
  cost: UnitCost;
  origin: OriginId;
  role: RoleId;
  range: number; // hex range (1 = melee, 2-4 = ranged)
  hp: number;
  atk: number;
  atkSpeed: number; // attacks per second
  armor: number;
  maxMana: number;
  startMana: number;
  jutsuName: string;
  jutsuDesc: string;
  jutsuType: JutsuType;
  accentColor: string;
  isMonster?: boolean;
}

export interface TraitTier {
  count: number;
  summary: string;
}

export interface TraitDef {
  id: TraitId;
  name: string;
  kind: 'origin' | 'role';
  color: string;
  description: string;
  tiers: TraitTier[];
}

export interface ActiveSynergy {
  traitId: TraitId;
  count: number;
  activeTierIndex: number; // -1 if below first tier
  nextThreshold: number | null;
}

export type BaseItemId =
  | 'keskin_kunai'
  | 'cakra_parsomeni'
  | 'anbu_zirhi'
  | 'ruzgar_sandali'
  | 'kizil_muska';

export type CompletedItemId =
  | 'kage_kilici'
  | 'yildirim_mizragi'
  | 'demir_katana'
  | 'hiraishin_hanceri'
  | 'kan_icici'
  | 'yasak_tomar'
  | 'bilge_pelerini'
  | 'firtina_yelpezesi'
  | 'mangekyo_muhru'
  | 'susanoo_kalkani'
  | 'golge_cizmeleri'
  | 'olumsuz_maske'
  | 'sekiz_kapi_sargisi'
  | 'simsek_pencesi'
  | 'kizil_ay_kolyesi';

export type ItemId = BaseItemId | CompletedItemId;

export interface ItemDef {
  id: ItemId;
  name: string;
  shortStat: string;
  description: string;
  color: string;
  isComponent: boolean;
  recipe?: [BaseItemId, BaseItemId];
  bonusAtk?: number;
  bonusHp?: number;
  bonusArmor?: number;
  bonusAtkSpeed?: number; // fraction e.g. 0.4
  bonusStartMana?: number;
  bonusSpellPower?: number; // fraction e.g. 0.25
  bonusCritChance?: number; // fraction e.g. 0.3
  bonusLifesteal?: number; // fraction e.g. 0.15
}

export type LootOrbTier = 'common' | 'rare' | 'gold';

export interface LootDropSpec {
  tier: LootOrbTier;
  itemId?: ItemId;
  gold?: number;
}

export interface ArenaLootOrb {
  id: string;
  col: number;
  row: number;
  startCol: number;
  startRow: number;
  spawnedAt: number;
  tier: LootOrbTier;
  itemId?: ItemId;
  gold?: number;
}

export type AugmentTier = 'silver' | 'gold' | 'prismatic';

export type AugmentId =
  | 'cakra_tasmasi'
  | 'golge_klonu'
  | 'altin_yagmuru'
  | 'hokage_korumasi'
  | 'kanli_bicak'
  | 'hizli_egitim'
  | 'olumcul_kritik'
  | 'celik_irade'
  | 'ruzgar_firtinasi'
  | 'efsaneler_cagrisi';

export interface AugmentDef {
  id: AugmentId;
  name: string;
  tier: AugmentTier;
  shortBadge: string;
  description: string;
  color: string;
}

export interface HexCoord {
  col: number; // 0..6
  row: number; // 0..5 (0..2 = enemy, 3..5 = player)
}

export interface OwnedUnit {
  uid: string;
  defId: string;
  stars: StarLevel;
  location: 'bench' | 'board';
  benchIndex: number | null; // 0..7
  hex: HexCoord | null; // row 3..5 for player
  items: ItemId[];
}

export interface ShopSlot {
  slotIndex: number;
  defId: string | null;
  purchased: boolean;
}

export interface ComputedStats {
  maxHp: number;
  atk: number;
  atkSpeed: number;
  armor: number;
  range: number;
  maxMana: number;
  startMana: number;
  spellPower: number;
  critChance: number;
  critMult: number;
  lifesteal: number;
  startingShield: number;
  manaRegenPerSec: number;
  firstCastBonus: number;
  killHeal: number;
  tripleShot: boolean;
  isAssassin: boolean;
  tankManaOnHit: number;
}

export interface EnemyWaveUnit {
  defId: string;
  stars: StarLevel;
  col: number;
  row: number; // 0..2
  items?: ItemId[];
  lootDrop?: LootDropSpec;
}

export type ArenaMapId = 'kanli_ay' | 'final_vadisi' | 'yagmur_kulesi' | 'ates_kalesi';

export interface ArenaMapDef {
  id: ArenaMapId;
  name: string;
  subtitle: string;
  accentColor: string;
  weather: 'embers' | 'rain' | 'ash' | 'storm';
  imageUrl: string;
}

export interface EnemyWaveDef {
  round: number;
  stageLabel: string;
  name: string;
  subtitle: string;
  arena: ArenaMapId;
  isPve?: boolean;
  units: EnemyWaveUnit[];
  rewardItem?: ItemId;
}

export type UnitAnimState = 'idle' | 'walk' | 'attack' | 'cast' | 'ko';

export type UnitDirection = 'down' | 'up' | 'left' | 'right';

export interface CombatUnit {
  uid: string;
  defId: string;
  team: 'player' | 'enemy';
  stars: StarLevel;
  items: ItemId[];
  lootDrop?: LootDropSpec;
  stats: ComputedStats;
  hp: number;
  ghostHp: number; // trailing bar
  shield: number;
  mana: number;
  col: number;
  row: number;
  // Continuous pixel-normalized hex-grid position (col/row float) for smooth movement
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facing: 1 | -1; // 1 = right, -1 = left
  dir: UnitDirection; // 4-way visual sprite orientation (front, back, left, right)
  attackCooldown: number;
  moveCooldown: number;
  attackCounter: number;
  castCount: number;
  stunTimer: number;
  burnTimer: number;
  burnDps: number;
  atkSpeedBuffTimer: number;
  atkSpeedBuffMult: number;
  hitFlashTimer: number;
  animState: UnitAnimState;
  animTimer: number;
  animDuration: number; // total duration of current action anim for 0..1 frame stepping
  lungeX: number;
  lungeY: number;
  koTimer: number; // >0 while falling & dissolving into shinobi smoke
  koDuration: number;
  alive: boolean;
  damageDealt: number;
  healerTimer: number;
  assassinLeaped: boolean;
}

export type ProjectileKind =
  | 'shuriken'
  | 'kunai'
  | 'needle'
  | 'clay_bird'
  | 'fireball'
  | 'rasen'
  | 'lightning'
  | 'sand'
  | 'lion_fist'
  | 'hiraishin_kunai';

export interface CombatProjectile {
  id: number;
  sourceUid: string;
  targetUid: string;
  team: 'player' | 'enemy';
  x: number; // normalized board coords
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  damage: number;
  isCrit: boolean;
  isSpell: boolean;
  kind: ProjectileKind;
  color: string;
  arcHeight?: number;
  aoeRadius?: number;
  stunDuration?: number;
  burnDps?: number;
  manaDrain?: number;
  onImpactVfx?: CombatVfx['kind'];
}

export type VfxKind =
  | 'rasen_burst'
  | 'chidori_arc'
  | 'fire_cone'
  | 'sand_pillar'
  | 'crimson_flame'
  | 'meteor'
  | 'heal_ring'
  | 'shadow_line'
  | 'lotus_slash'
  | 'flash_line'
  | 'clay_boom'
  | 'merge_star'
  | 'melee_slash'
  | 'lion_burst'
  | 'poison_cloud'
  | 'cast_seal'
  | 'sakura_storm'
  | 'raikiri_beam';

export interface CombatVfx {
  id: number;
  kind: VfxKind;
  x: number;
  y: number;
  tx?: number;
  ty?: number;
  color: string;
  age: number;
  duration: number;
  scale: number;
}

export interface CombatAfterimage {
  id: number;
  defId: string;
  x: number;
  y: number;
  facing: 1 | -1;
  dir: UnitDirection;
  tint: string;
  age: number;
  duration: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
  duration: number;
  isCrit?: boolean;
  isJutsu?: boolean;
}

export interface CombatParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  age: number;
  life: number;
}

export interface CombatEvent {
  type: 'hit' | 'crit' | 'jutsu' | 'heal' | 'ko' | 'loot_drop';
  jutsuType?: JutsuType;
  x?: number;
  y?: number;
  lootDrop?: LootDropSpec;
}

export interface CombatState {
  units: CombatUnit[];
  projectiles: CombatProjectile[];
  vfx: CombatVfx[];
  afterimages: CombatAfterimage[];
  floatingTexts: FloatingText[];
  particles: CombatParticle[];
  particleCursor: number;
  nextEntityId: number;
  elapsed: number;
  hitstopTimer: number;
  trauma: number;
  skyDarken: number;
  skyDarkenColor: string;
  rngState: number;
  winner: 'player' | 'enemy' | null;
  playerSynergies: ActiveSynergy[];
  enemySynergies: ActiveSynergy[];
  events: CombatEvent[];
}

export interface MergeEvent {
  defId: string;
  newStars: StarLevel;
  uid: string;
}

export interface RunSummary {
  victory: boolean;
  roundReached: number;
  wins: number;
  losses: number;
  totalDamage: number;
  highestStar: StarLevel;
  topUnitName: string;
  remainingHp: number;
  isOnline?: boolean;
  placement?: number;
  totalPlayers?: number;
}
