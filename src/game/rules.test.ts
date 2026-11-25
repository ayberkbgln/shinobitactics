import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addXp,
  calculatePlayerDamage,
  calculateRoundIncome,
  calculateSynergies,
  computeUnitStats,
  createCombatState,
  getSellValue,
  hexDistance,
  rollShop,
  stepCombat,
  tryMergeUnits,
} from './rules';
import { ENEMY_WAVES, SHOP_ODDS_BY_LEVEL } from './data';
import { OwnedUnit } from './types';

function makeSeededRng(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test('hexDistance computes symmetric distances on odd-r hex grid', () => {
  assert.equal(hexDistance({ col: 2, row: 2 }, { col: 2, row: 2 }), 0);
  assert.equal(hexDistance({ col: 2, row: 2 }, { col: 3, row: 2 }), 1);
  assert.equal(hexDistance({ col: 2, row: 2 }, { col: 2, row: 3 }), 1);
  assert.equal(
    hexDistance({ col: 0, row: 0 }, { col: 6, row: 5 }),
    hexDistance({ col: 6, row: 5 }, { col: 0, row: 0 }),
  );
});

test('calculateSynergies deduplicates identical units and computes tier thresholds', () => {
  const synergies = calculateSynergies([
    { defId: 'nartuto' },
    { defId: 'nartuto' }, // duplicate should NOT count twice
    { defId: 'sakuura' },
    { defId: 'rokku_li' },
  ]);

  const yaprak = synergies.find((s) => s.traitId === 'yaprak');
  const dovuscu = synergies.find((s) => s.traitId === 'dovuscu');
  const sifaci = synergies.find((s) => s.traitId === 'sifaci');

  assert.ok(yaprak);
  assert.equal(yaprak.count, 3);
  assert.equal(yaprak.activeTierIndex, 0); // 2/4/6 -> tier 0 active at count 3
  assert.equal(yaprak.nextThreshold, 4);

  assert.ok(dovuscu);
  assert.equal(dovuscu.count, 2); // nartuto + rokku_li
  assert.equal(dovuscu.activeTierIndex, 0);

  assert.ok(sifaci);
  assert.equal(sifaci.count, 1);
  assert.equal(sifaci.activeTierIndex, 0);
});

test('tryMergeUnits fuses 3 copies into 2-star, prefers board unit, and cascades to 3-star', () => {
  const makeUnit = (
    uid: string,
    stars: 1 | 2 | 3,
    location: 'board' | 'bench',
    benchIndex: number | null,
    items: OwnedUnit['items'] = [],
  ): OwnedUnit => ({
    uid,
    defId: 'nartuto',
    stars,
    location,
    benchIndex,
    hex: location === 'board' ? { col: 3, row: 4 } : null,
    items,
  });

  // 3x 1-star (one on board) + 2x 2-star on bench => cascades all the way to 1x 3-star on board!
  const roster: OwnedUnit[] = [
    makeUnit('u1', 1, 'bench', 0, ['keskin_kunai']),
    makeUnit('u2', 1, 'board', null, ['anbu_zirhi']),
    makeUnit('u3', 1, 'bench', 1, ['ruzgar_sandali']),
    makeUnit('u4', 2, 'bench', 2, ['kizil_muska']),
    makeUnit('u5', 2, 'bench', 3, []),
  ];

  const result = tryMergeUnits(roster);
  assert.equal(result.roster.length, 1);
  assert.equal(result.roster[0].stars, 3);
  assert.equal(result.roster[0].location, 'board');
  assert.deepEqual(result.roster[0].hex, { col: 3, row: 4 });
  assert.equal(result.roster[0].items.length, 3);
  assert.equal(result.returnedItems.length, 1); // 4th item overflow returned cleanly
  assert.equal(result.merges.length, 2);
  assert.equal(result.merges[0].newStars, 2);
  assert.equal(result.merges[1].newStars, 3);
});

test('economy calculations enforce interest cap, streak bonuses, and sell values', () => {
  assert.deepEqual(calculateRoundIncome(0, 1, false), {
    base: 5,
    interest: 0,
    streakBonus: 0,
    winBonus: 0,
    total: 5,
  });

  // 65 gold caps interest at 5, 5-win streak gives +3 and +1 win bonus
  assert.deepEqual(calculateRoundIncome(65, 5, true), {
    base: 5,
    interest: 5,
    streakBonus: 3,
    winBonus: 1,
    total: 14,
  });

  assert.equal(getSellValue(1, 1), 1);
  assert.equal(getSellValue(3, 2), 8);
  assert.equal(getSellValue(5, 3), 35);

  const lvlUp = addXp(3, 2, 4); // level 3 needs 4 xp -> becomes level 4 with 2 xp
  assert.equal(lvlUp.level, 4);
  assert.equal(lvlUp.xp, 2);
  assert.equal(lvlUp.leveledUp, true);

  assert.ok(calculatePlayerDamage(1, 2) > 0);
});

test('shop odds sum to 100 for every level and rollShop returns valid units', () => {
  for (let lvl = 1; lvl <= 8; lvl++) {
    const sum = SHOP_ODDS_BY_LEVEL[lvl].reduce((a, b) => a + b, 0);
    assert.equal(sum, 100, `Level ${lvl} odds must sum to 100`);
  }

  const rng = makeSeededRng(123);
  const slots = rollShop(6, 5, rng);
  assert.equal(slots.length, 5);
  for (const slot of slots) {
    assert.ok(slot.defId);
    assert.equal(slot.purchased, false);
  }
});

test('computeUnitStats applies star scaling, synergies, and items accurately', () => {
  const syns = calculateSynergies([{ defId: 'nartuto' }, { defId: 'rokku_li' }]);
  const stats1 = computeUnitStats('nartuto', 1, [], syns);
  const stats2 = computeUnitStats('nartuto', 2, ['keskin_kunai', 'anbu_zirhi'], syns);

  // Dövüşçü (2) grants +240 HP, Yaprak (2) grants +20% atkSpeed and +3 mana/sec
  assert.equal(stats1.maxHp, 680 + 240);
  assert.equal(stats1.manaRegenPerSec, 3);
  assert.ok(stats2.maxHp > stats1.maxHp + 400);
  assert.ok(stats2.atk > stats1.atk + 50);
});

test('combat simulation runs deterministically, triggers jutsus, and resolves with a winner', () => {
  const playerBoard: OwnedUnit[] = [
    {
      uid: 'p1',
      defId: 'nartuto',
      stars: 2,
      location: 'board',
      benchIndex: null,
      hex: { col: 2, row: 3 },
      items: ['keskin_kunai'],
    },
    {
      uid: 'p2',
      defId: 'sazuke',
      stars: 2,
      location: 'board',
      benchIndex: null,
      hex: { col: 4, row: 3 },
      items: ['cakra_parsomeni'],
    },
    {
      uid: 'p3',
      defId: 'sakuura',
      stars: 1,
      location: 'board',
      benchIndex: null,
      hex: { col: 3, row: 4 },
      items: [],
    },
  ];

  const combat = createCombatState(playerBoard, ENEMY_WAVES[0].units);
  const rng = makeSeededRng(777);

  let ticks = 0;
  let sawJutsu = false;
  while (combat.winner === null && ticks < 2400) {
    stepCombat(combat, 0.04, rng);
    if (combat.events.some((e) => e.type === 'jutsu')) {
      sawJutsu = true;
    }
    ticks++;
  }

  assert.equal(combat.winner, 'player', 'Stronger 2-star team should defeat Wave 1');
  assert.equal(sawJutsu, true, 'Units must charge mana and trigger signature Jutsu during combat');
  assert.ok(combat.units.some((u) => u.team === 'player' && u.damageDealt > 0));
});

test('seeded combat is 100% deterministic across separate simulations with the same seed', async () => {
  const { simulateHeadlessCombat } = await import('./rules');
  const boardA: OwnedUnit[] = [
    { uid: 'a1', defId: 'nartuto', stars: 2, location: 'board', benchIndex: null, hex: { col: 2, row: 3 }, items: ['keskin_kunai'] },
    { uid: 'a2', defId: 'hinaata', stars: 1, location: 'board', benchIndex: null, hex: { col: 4, row: 3 }, items: [] },
    { uid: 'a3', defId: 'deidarra', stars: 1, location: 'board', benchIndex: null, hex: { col: 3, row: 5 }, items: ['cakra_parsomeni'] },
  ];

  const run1 = simulateHeadlessCombat(boardA, ENEMY_WAVES[2].units, { seed: 987654 });
  const run2 = simulateHeadlessCombat(boardA, ENEMY_WAVES[2].units, { seed: 987654 });
  assert.deepEqual(run1, run2);
});

test('augments boost unit stats, board cap, and interest cap accurately', async () => {
  const { getMaxBoardUnits } = await import('./rules');
  assert.equal(getMaxBoardUnits(5, []), 5);
  assert.equal(getMaxBoardUnits(5, ['golge_klonu']), 6);

  const baseStats = computeUnitStats('nartuto', 1, [], [], []);
  const augStats = computeUnitStats('nartuto', 1, [], [], ['cakra_tasmasi', 'kanli_bicak', 'hokage_korumasi']);
  assert.equal(augStats.startMana, Math.min(baseStats.maxMana, baseStats.startMana + 30));
  assert.equal(augStats.atk, baseStats.atk + 18);
  assert.ok(augStats.lifesteal >= 0.22);
  assert.equal(augStats.startingShield, 280);

  const richIncome = calculateRoundIncome(70, 0, false, ['altin_yagmuru']);
  assert.equal(richIncome.interest, 7);
});

test('mirrorBoardForEnemy maps player rows 3..5 symmetrically onto enemy rows 2..0', async () => {
  const { mirrorBoardForEnemy } = await import('./rules');
  const mirrored = mirrorBoardForEnemy([
    { uid: 'u1', defId: 'nartuto', stars: 2, location: 'board', benchIndex: null, hex: { col: 1, row: 3 }, items: ['keskin_kunai'] },
    { uid: 'u2', defId: 'deidarra', stars: 1, location: 'board', benchIndex: null, hex: { col: 6, row: 5 }, items: [] },
    { uid: 'u3', defId: 'sakuura', stars: 1, location: 'bench', benchIndex: 0, hex: null, items: [] },
  ]);

  assert.equal(mirrored.length, 2);
  assert.deepEqual(mirrored[0], { defId: 'nartuto', stars: 2, col: 5, row: 2, items: ['keskin_kunai'] });
  assert.deepEqual(mirrored[1], { defId: 'deidarra', stars: 1, col: 0, row: 0, items: [] });
});

test('computeUnitDirection maps 4 cardinal movement vectors and combat tracks walk/attack/cast/ko animations', async () => {
  const { computeUnitDirection } = await import('./rules');
  assert.equal(computeUnitDirection(0, -1), 'up');
  assert.equal(computeUnitDirection(0, 1), 'down');
  assert.equal(computeUnitDirection(1, 0), 'right');
  assert.equal(computeUnitDirection(-1, 0), 'left');
  assert.equal(computeUnitDirection(0, 0, 'up'), 'up');

  const board: OwnedUnit[] = [
    { uid: 'p1', defId: 'nartuto', stars: 2, location: 'board', benchIndex: null, hex: { col: 3, row: 5 }, items: [] },
  ];
  const combat = createCombatState(board, [{ defId: 'rokku_li', stars: 1, col: 3, row: 0 }]);
  const rng = makeSeededRng(42);
  let sawWalkUp = false;
  let sawAttack = false;
  let sawKo = false;
  for (let i = 0; i < 600 && combat.winner === null; i++) {
    stepCombat(combat, 0.04, rng);
    const p = combat.units.find((u) => u.uid === 'p1');
    const e = combat.units.find((u) => u.team === 'enemy');
    if (p && p.animState === 'walk' && p.dir === 'up') sawWalkUp = true;
    if (p && p.animState === 'attack' && p.animDuration > 0.3) sawAttack = true;
    if (e && !e.alive && e.animState === 'ko' && e.koDuration >= 0.8) sawKo = true;
  }
  assert.equal(sawWalkUp, true, 'Player unit advancing vertically must orient upward (back view)');
  assert.equal(sawAttack, true, 'Combat unit must play multi-frame attack animation');
  assert.equal(sawKo, true, 'Defeated enemy must play full multi-frame KO smoke-vanish animation');
});

test('TFT 2-component item crafting combines base components symmetrically and respects 3-item limit', async () => {
  const { isBaseComponent, combineItems, equipItemWithCombine } = await import('./rules');
  assert.equal(isBaseComponent('keskin_kunai'), true);
  assert.equal(isBaseComponent('kage_kilici'), false);

  // Symmetric recipes
  assert.equal(combineItems('keskin_kunai', 'keskin_kunai'), 'kage_kilici');
  assert.equal(combineItems('keskin_kunai', 'cakra_parsomeni'), 'yildirim_mizragi');
  assert.equal(combineItems('cakra_parsomeni', 'keskin_kunai'), 'yildirim_mizragi');
  assert.equal(combineItems('anbu_zirhi', 'ruzgar_sandali'), 'golge_cizmeleri');
  assert.equal(combineItems('kage_kilici', 'keskin_kunai'), null);

  // Equipping a 2nd base component fuses into completed item instead of taking a 2nd slot
  const r1 = equipItemWithCombine(['keskin_kunai'], 'cakra_parsomeni');
  assert.ok(r1 !== null);
  assert.equal(r1.combinedInto, 'yildirim_mizragi');
  assert.deepEqual(r1.nextItems, ['yildirim_mizragi']);

  // Equipping a base component onto a unit with 3 completed items is rejected
  const rFull = equipItemWithCombine(['kage_kilici', 'yildirim_mizragi', 'susanoo_kalkani'], 'keskin_kunai');
  assert.equal(rFull, null);

  // Even when a unit has 2 completed items + 1 base component (length 3), a 2nd base component still fuses cleanly!
  const rFuseAt3 = equipItemWithCombine(['kage_kilici', 'susanoo_kalkani', 'keskin_kunai'], 'anbu_zirhi');
  assert.ok(rFuseAt3 !== null);
  assert.equal(rFuseAt3.combinedInto, 'demir_katana');
  assert.deepEqual(rFuseAt3.nextItems, ['kage_kilici', 'susanoo_kalkani', 'demir_katana']);

  // Recipe preview helper lists all 5 possible crafts for any base component (0 for completed artifacts)
  const { getItemRecipesForComponent, previewItemCombineOnUnit } = await import('./rules');
  const kunaiRecipes = getItemRecipesForComponent('keskin_kunai');
  assert.equal(kunaiRecipes.length, 5);
  assert.equal(
    kunaiRecipes.some((r) => r.partnerId === 'cakra_parsomeni' && r.resultId === 'yildirim_mizragi'),
    true,
  );
  assert.equal(getItemRecipesForComponent('kage_kilici').length, 0);

  // Unit combine preview helper returns exact partner + result artifact
  assert.deepEqual(previewItemCombineOnUnit(['keskin_kunai'], 'cakra_parsomeni'), {
    partnerId: 'keskin_kunai',
    resultId: 'yildirim_mizragi',
    canEquip: true,
  });
  assert.deepEqual(previewItemCombineOnUnit(['kage_kilici'], 'cakra_parsomeni'), {
    partnerId: null,
    resultId: null,
    canEquip: true,
  });
  assert.deepEqual(
    previewItemCombineOnUnit(['kage_kilici', 'susanoo_kalkani', 'kan_icici'], 'keskin_kunai'),
    {
      partnerId: null,
      resultId: null,
      canEquip: false,
    },
  );
});

test('PvE monster stage (1-2) drops glowing loot orbs on monster KO', () => {
  const wave1 = ENEMY_WAVES[0];
  assert.equal(wave1.isPve, true);
  assert.equal(wave1.stageLabel, '1-2');

  const board: OwnedUnit[] = [
    { uid: 'p1', defId: 'nartuto', stars: 2, location: 'board', benchIndex: null, hex: { col: 3, row: 3 }, items: [] },
    { uid: 'p2', defId: 'sakuura', stars: 1, location: 'board', benchIndex: null, hex: { col: 2, row: 4 }, items: [] },
  ];
  const combat = createCombatState(board, wave1.units, { seed: 101 });
  const rng = makeSeededRng(101);
  const lootDrops: Array<{ x: number; y: number; tier: string }> = [];

  for (let i = 0; i < 600 && combat.winner === null; i++) {
    stepCombat(combat, 0.04, rng);
    for (const ev of combat.events) {
      if (ev.type === 'loot_drop' && ev.lootDrop) {
        lootDrops.push({ x: ev.x ?? 0, y: ev.y ?? 0, tier: ev.lootDrop.tier });
      }
    }
  }

  assert.equal(combat.winner, 'player', 'Player squad should defeat Stage 1-2 PvE Shadow Puppets');
  assert.equal(lootDrops.length, 2, 'Both slain PvE monsters must drop TFT loot orbs');
});



