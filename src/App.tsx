/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArenaCanvas,
  ArenaCanvasApi,
  ArenaRenderBridge,
  MergeCelebration,
} from './components/ArenaCanvas';
import { AugmentModal } from './components/AugmentModal';
import { ItemArmoryTray, ItemDragPreviewOverlay } from './components/ItemForgeOverlay';
import { LobbyStandingsPanel } from './components/LobbyStandingsPanel';
import { OnlineLobbyModal } from './components/OnlineLobbyModal';
import { DamageMeterEntry, InspectedEnemy, RightDrawerTab, RightPanel } from './components/RightPanel';
import { ShopDock } from './components/ShopDock';
import { GameOverModal, PauseModal } from './components/StatusModals';
import { SynergyPanel } from './components/SynergyPanel';
import { TitleScreen } from './components/TitleScreen';
import { TopHud } from './components/TopHud';
import {
  ARENA_MAPS,
  AUGMENT_ROUNDS,
  BASE_ITEM_IDS,
  BENCH_SIZE,
  ENEMY_WAVES,
  ITEMS,
  MAX_LEVEL,
  MAX_ROUNDS,
  PLAYER_START_ROW,
  PREP_DURATION_SEC,
  SHINOBI_BY_ID,
} from './game/data';
import {
  OnlineMatchupPayload,
  OnlinePlayerSummary,
  OnlineRoomState,
  OnlineRoundResultPayload,
} from './game/multiplayerTypes';
import {
  getBattleSprite,
  getSpriteRevision,
  subscribeSpritesReady,
} from './game/pixelSprites';
import {
  addXp,
  calculatePlayerDamage,
  calculateRoundIncome,
  calculateSynergies,
  combineItems,
  computeUnitStats,
  createCombatState,
  equipItemWithCombine,
  getMaxBoardUnits,
  getSellValue,
  mirrorBoardForEnemy,
  rollAugmentChoices,
  rollShop,
  stepCombat,
  tryMergeUnits,
} from './game/rules';
import { sound } from './game/sound';
import {
  ArenaLootOrb,
  ArenaMapId,
  AugmentDef,
  AugmentId,
  CombatState,
  EnemyWaveDef,
  GameScreenState,
  HexCoord,
  ItemId,
  LootDropSpec,
  OwnedUnit,
  RoundPhase,
  RunSummary,
  ShopSlot,
  StarLevel,
} from './game/types';
import { useMultiplayer } from './game/useMultiplayer';

const INITIAL_HP = 100;
const INITIAL_GOLD = 10;
const INITIAL_LEVEL = 3;

type DragPayload =
  | { kind: 'unit'; uid: string; defId: string; stars: StarLevel }
  | { kind: 'item'; itemIndex: number; itemId: ItemId };

interface ActiveDrag {
  payload: DragPayload;
  clientX: number;
  clientY: number;
  overSellZone: boolean;
  hoverUnitUid?: string | null;
  hoverItemIndex?: number | null;
}

function createStarterRoster(): OwnedUnit[] {
  return [
    {
      uid: 'starter_nartuto',
      defId: 'nartuto',
      stars: 1,
      location: 'board',
      benchIndex: null,
      hex: { col: 3, row: 3 },
      items: [],
    },
    {
      uid: 'starter_sakuura',
      defId: 'sakuura',
      stars: 1,
      location: 'board',
      benchIndex: null,
      hex: { col: 2, row: 4 },
      items: [],
    },
    {
      uid: 'starter_rokku',
      defId: 'rokku_li',
      stars: 1,
      location: 'bench',
      benchIndex: 0,
      hex: null,
      items: [],
    },
  ];
}

export default function App() {
  const initialRoomParam = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') ?? '').trim().toUpperCase().slice(0, 6);
  }, []);

  const [screen, setScreen] = useState<GameScreenState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'playing';
    }
    return 'title';
  });

  const [onlineModalOpen, setOnlineModalOpen] = useState<boolean>(() => Boolean(initialRoomParam));
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const [onlineMatchup, setOnlineMatchup] = useState<OnlineMatchupPayload | null>(null);
  const [scoutedPlayerId, setScoutedPlayerId] = useState<string | null>(null);
  const [selectedArenaId, setSelectedArenaId] = useState<ArenaMapId>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('shinobi_arena') as ArenaMapId | null;
      if (saved && ARENA_MAPS[saved]) return saved;
    }
    return 'kanli_ay';
  });
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [rightDrawerTab, setRightDrawerTab] = useState<RightDrawerTab>('guide');

  const handleSelectArena = useCallback((arenaId: ArenaMapId) => {
    setSelectedArenaId(arenaId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('shinobi_arena', arenaId);
    }
  }, []);

  const handleToggleRightDrawer = useCallback((tab: RightDrawerTab) => {
    setRightDrawerOpen((wasOpen) => {
      if (wasOpen && rightDrawerTab === tab) return false;
      setRightDrawerTab(tab);
      return true;
    });
  }, [rightDrawerTab]);

  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<RoundPhase>('prep');
  const [prepTimer, setPrepTimer] = useState(PREP_DURATION_SEC);
  const [hp, setHp] = useState(INITIAL_HP);
  const [gold, setGold] = useState(INITIAL_GOLD);
  const [level, setLevel] = useState(INITIAL_LEVEL);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [totalDamage, setTotalDamage] = useState(0);
  const [highestStar, setHighestStar] = useState<StarLevel>(1);
  const [topUnitTracker, setTopUnitTracker] = useState<Record<string, number>>({});
  const [combatSpeed, setCombatSpeed] = useState<1 | 2>(1);
  const [muted, setMuted] = useState(false);

  const [augments, setAugments] = useState<AugmentId[]>([]);
  const [augmentDraft, setAugmentDraft] = useState<{
    round: number;
    choices: AugmentDef[];
    rerolled: boolean;
  } | null>(null);

  const [roster, setRoster] = useState<OwnedUnit[]>(() => createStarterRoster());
  const [shop, setShop] = useState<ShopSlot[]>(() => rollShop(INITIAL_LEVEL, 5));
  const [shopLocked, setShopLocked] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<ItemId[]>([
    'keskin_kunai',
    'cakra_parsomeni',
  ]);
  const [lootOrbs, setLootOrbs] = useState<ArenaLootOrb[]>([]);

  const [selectedUnitUid, setSelectedUnitUid] = useState<string | null>(null);
  const [inspectedEnemy, setInspectedEnemy] = useState<InspectedEnemy | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [damageMeter, setDamageMeter] = useState<DamageMeterEntry[]>([]);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [roundBanner, setRoundBanner] = useState<ArenaRenderBridge['roundBanner']>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [spriteRev, setSpriteRev] = useState<number>(() => getSpriteRevision());

  useEffect(() => subscribeSpritesReady(setSpriteRev), []);

  const uidCounterRef = useRef(100);
  const orbCounterRef = useRef(1);
  const lootOrbsRef = useRef<ArenaLootOrb[]>(lootOrbs);
  lootOrbsRef.current = lootOrbs;
  const combatRef = useRef<CombatState | null>(null);
  const canvasApiRef = useRef<ArenaCanvasApi | null>(null);
  const mergeCelebrationsRef = useRef<MergeCelebration[]>([]);
  const pendingDragRef = useRef<{ payload: DragPayload; startX: number; startY: number } | null>(
    null,
  );
  const activeDragRef = useRef<ActiveDrag | null>(null);
  activeDragRef.current = activeDrag;
  const suppressNextClickRef = useRef(false);
  const bannerTimeoutRef = useRef<number | null>(null);
  const resolutionTimeoutRef = useRef<number | null>(null);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const speedRef = useRef(combatSpeed);
  speedRef.current = combatSpeed;
  const isOnlineRef = useRef(isOnlineMode);
  isOnlineRef.current = isOnlineMode;

  const maxBoardUnits = useMemo(() => getMaxBoardUnits(level, augments), [level, augments]);

  const playerBoardUnits = useMemo(
    () => roster.filter((u) => u.location === 'board' && u.hex !== null),
    [roster],
  );

  const playerBenchUnits = useMemo(
    () => roster.filter((u) => u.location === 'bench' && u.benchIndex !== null),
    [roster],
  );

  const playerBoardUnitsRef = useRef(playerBoardUnits);
  playerBoardUnitsRef.current = playerBoardUnits;
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  const augmentsRef = useRef(augments);
  augmentsRef.current = augments;
  const goldRef = useRef(gold);
  goldRef.current = gold;
  const levelRef = useRef(level);
  levelRef.current = level;
  const xpRef = useRef(xp);
  xpRef.current = xp;
  const streakRef = useRef(streak);
  streakRef.current = streak;
  const winsRef = useRef(wins);
  winsRef.current = wins;
  const lossesRef = useRef(losses);
  lossesRef.current = losses;
  const totalDamageRef = useRef(totalDamage);
  totalDamageRef.current = totalDamage;
  const highestStarRef = useRef(highestStar);
  highestStarRef.current = highestStar;
  const topUnitTrackerRef = useRef(topUnitTracker);
  topUnitTrackerRef.current = topUnitTracker;
  const shopLockedRef = useRef(shopLocked);
  shopLockedRef.current = shopLocked;

  const synergies = useMemo(() => calculateSynergies(playerBoardUnits), [playerBoardUnits]);

  const selectedUnit = useMemo(
    () => roster.find((u) => u.uid === selectedUnitUid) ?? null,
    [roster, selectedUnitUid],
  );

  const draggedUnit = useMemo(() => {
    if (!activeDrag || activeDrag.payload.kind !== 'unit') return null;
    const draggedUid = activeDrag.payload.uid;
    return roster.find((u) => u.uid === draggedUid) ?? null;
  }, [activeDrag, roster]);

  const draggedUnitSpriteUrl = useMemo(() => {
    if (!activeDrag || activeDrag.payload.kind !== 'unit') return null;
    return getBattleSprite(activeDrag.payload.defId, 'walk', 0).toDataURL();
  }, [activeDrag?.payload.kind === 'unit' ? activeDrag.payload.defId : null, spriteRev]);

  const showBanner = useCallback(
    (text: string, subtext: string, tone: 'win' | 'loss' | 'merge', durationMs = 2000) => {
      if (bannerTimeoutRef.current !== null) {
        window.clearTimeout(bannerTimeoutRef.current);
      }
      setRoundBanner({ text, subtext, tone });
      bannerTimeoutRef.current = window.setTimeout(() => {
        setRoundBanner(null);
      }, durationMs);
    },
    [],
  );

  // ---- TFT PvE LOOT ORB SPAWNING & TACTICIAN PICKUP ----

  const spawnLootOrb = useCallback((fromX: number, fromY: number, drop: LootDropSpec) => {
    const resolvedItem: ItemId | undefined = drop.itemId
      ? drop.itemId
      : !drop.gold
        ? BASE_ITEM_IDS[Math.floor(Math.random() * BASE_ITEM_IDS.length)]
        : undefined;
    const jitterX = (Math.random() - 0.5) * 1.15;
    const landCol = Math.max(0.7, Math.min(5.6, fromX + jitterX));
    // Land onto mid-to-player side stone tiles so the Kage Tactician can stroll right over them!
    const landRow = Math.max(2.6, Math.min(4.7, fromY + 1.55 + Math.random() * 0.6));
    const orb: ArenaLootOrb = {
      id: `orb_${orbCounterRef.current++}`,
      col: landCol,
      row: landRow,
      startCol: fromX,
      startRow: fromY,
      tier: drop.tier,
      itemId: resolvedItem,
      gold: drop.gold,
      spawnedAt: performance.now(),
    };
    lootOrbsRef.current = [...lootOrbsRef.current, orb];
    bridgeRef.current.lootOrbs = lootOrbsRef.current;
    setLootOrbs(lootOrbsRef.current);
  }, []);

  const handleCollectLootOrb = useCallback(
    (orbId: string): { label: string; color: string } | null => {
      const idx = lootOrbsRef.current.findIndex((o) => o.id === orbId);
      if (idx === -1) return null;
      const orb = lootOrbsRef.current[idx];
      const next = lootOrbsRef.current.filter((o) => o.id !== orbId);
      lootOrbsRef.current = next;
      bridgeRef.current.lootOrbs = next;
      setLootOrbs(next);

      const parts: string[] = [];
      if (orb.itemId && ITEMS[orb.itemId]) {
        setInventoryItems((prev) => [...prev, orb.itemId!]);
        parts.push(`+${ITEMS[orb.itemId].name}`);
      }
      if (orb.gold && orb.gold > 0) {
        setGold((g) => g + orb.gold!);
        parts.push(`+${orb.gold} Ryo`);
      }

      if (orb.tier === 'gold') {
        sound.playMerge(2);
      } else {
        sound.playBuy();
      }

      const color =
        orb.tier === 'gold' ? '#fde047' : orb.tier === 'rare' ? '#34d399' : '#38bdf8';
      return {
        label: parts.join(' · ') || 'Ganimet Alındı!',
        color,
      };
    },
    [],
  );

  const collectAllRemainingLootOrbs = useCallback(() => {
    const remaining = lootOrbsRef.current;
    if (remaining.length === 0) return;
    const collectedItems: ItemId[] = [];
    let collectedGold = 0;
    for (const orb of remaining) {
      if (orb.itemId && ITEMS[orb.itemId]) collectedItems.push(orb.itemId);
      if (orb.gold && orb.gold > 0) collectedGold += orb.gold;
    }
    lootOrbsRef.current = [];
    bridgeRef.current.lootOrbs = [];
    setLootOrbs([]);
    if (collectedItems.length > 0) {
      setInventoryItems((prev) => [...prev, ...collectedItems]);
    }
    if (collectedGold > 0) {
      setGold((g) => g + collectedGold);
    }
    if (collectedItems.length > 0 || collectedGold > 0) {
      sound.playBuy();
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (bannerTimeoutRef.current !== null) {
      window.clearTimeout(bannerTimeoutRef.current);
      bannerTimeoutRef.current = null;
    }
    if (resolutionTimeoutRef.current !== null) {
      window.clearTimeout(resolutionTimeoutRef.current);
      resolutionTimeoutRef.current = null;
    }
  }, []);

  const openAugmentDraftIfDue = useCallback((targetRound: number, ownedAugs: AugmentId[]) => {
    if (!(AUGMENT_ROUNDS as readonly number[]).includes(targetRound)) return;
    if (ownedAugs.length >= AUGMENT_ROUNDS.length) return;
    const choices = rollAugmentChoices(ownedAugs, 3);
    if (choices.length > 0) {
      setAugmentDraft({ round: targetRound, choices, rerolled: false });
    }
  }, []);

  // ---- ONLINE MULTIPLAYER HANDLERS ----

  const handleOnlineStartCombat = useCallback((matchup: OnlineMatchupPayload) => {
    pendingDragRef.current = null;
    activeDragRef.current = null;
    setActiveDrag(null);
    setScoutedPlayerId(null);
    setAugmentDraft(null);
    setOnlineMatchup(matchup);

    let boardForCombat = playerBoardUnitsRef.current;
    if (boardForCombat.length === 0) {
      const bench = rosterRef.current.filter((u) => u.location === 'bench');
      if (bench.length > 0) {
        const first = bench[0];
        const deployed: OwnedUnit = {
          ...first,
          location: 'board',
          benchIndex: null,
          hex: { col: 3, row: 3 },
        };
        setRoster((prev) => prev.map((u) => (u.uid === first.uid ? deployed : u)));
        boardForCombat = [deployed];
      }
    }

    const combat = createCombatState(boardForCombat, matchup.enemyUnits, {
      seed: matchup.seed,
      playerAugments: augmentsRef.current,
      enemyAugments: matchup.opponentAugments,
    });
    combatRef.current = combat;
    bridgeRef.current.combatState = combat;
    setSelectedUnitUid(null);
    setInspectedEnemy(null);
    setSelectedItemIndex(null);
    setDamageMeter([]);
    setRound(matchup.round);
    setPhase('combat');
    sound.playCombatStart();
    showBanner(`VS ${matchup.opponentName}`, `Tur ${matchup.round} · Canlı PvP Savaşı!`, 'merge', 1800);
  }, [showBanner]);

  const handleOnlineRoundResolved = useCallback(
    (result: OnlineRoundResultPayload, updatedRoom: OnlineRoomState) => {
      setHp(result.newHp);
      const nextWins = result.won ? winsRef.current + 1 : winsRef.current;
      const nextLosses = result.won ? lossesRef.current : lossesRef.current + 1;
      setWins(nextWins);
      setLosses(nextLosses);

      const nextStreak = result.won
        ? streakRef.current >= 0
          ? streakRef.current + 1
          : 1
        : streakRef.current <= 0
          ? streakRef.current - 1
          : -1;
      setStreak(nextStreak);

      if (result.won) {
        sound.playVictory();
        showBanner('PvP Turu Kazanıldı!', `${result.opponentName} mağlup edildi!`, 'win', 2200);
      } else {
        sound.playDefeat();
        showBanner('PvP Turu Kaybedildi', `${result.opponentName} karşısında -${result.damageTaken} Can`, 'loss', 2200);
      }

      // Milestone base component drop on rounds 2, 4, 6, 8 in online mode
      if (result.round % 2 === 0 && !result.eliminated) {
        const rewardId = BASE_ITEM_IDS[result.round % BASE_ITEM_IDS.length];
        setInventoryItems((prev) => [...prev, rewardId]);
      }

      setPhase('resolution');

      if (result.eliminated || result.matchFinished) {
        let topDefId = 'nartuto';
        let topDmg = -1;
        for (const [id, d] of Object.entries(topUnitTrackerRef.current)) {
          if (d > topDmg) {
            topDmg = d;
            topDefId = id;
          }
        }
        const wonRoom = !result.eliminated && result.matchFinished;
        window.setTimeout(() => {
          setRunSummary({
            victory: wonRoom,
            roundReached: result.round,
            wins: nextWins,
            losses: nextLosses,
            totalDamage: totalDamageRef.current,
            highestStar: highestStarRef.current,
            topUnitName: SHINOBI_BY_ID[topDefId]?.name ?? 'Nartuto',
            remainingHp: result.newHp,
            isOnline: true,
            placement: result.placement ?? (wonRoom ? 1 : updatedRoom.players.length),
            totalPlayers: updatedRoom.players.length,
          });
          setScreen('gameover');
        }, 1400);
        return;
      }

      // Apply round income & XP for next round
      const income = calculateRoundIncome(
        goldRef.current,
        Math.abs(nextStreak),
        result.won,
        augmentsRef.current,
      );
      const xpRes = addXp(levelRef.current, xpRef.current, 2);
      setGold((g) => g + income.total);
      setLevel(xpRes.level);
      setXp(xpRes.xp);
      if (!shopLockedRef.current) {
        setShop(rollShop(xpRes.level, 5));
      }
    },
    [showBanner],
  );

  const mp = useMultiplayer({
    onStartCombat: handleOnlineStartCombat,
    onRoundResolved: handleOnlineRoundResolved,
  });

  // Track room status transitions from server (Lobby -> Prep, Resolution -> Next Round Prep)
  const prevRoomStatusRef = useRef<string | null>(null);
  const prevRoomRoundRef = useRef<number>(0);

  useEffect(() => {
    const rm = mp.room;
    if (!rm) {
      prevRoomStatusRef.current = null;
      prevRoomRoundRef.current = 0;
      return;
    }

    const prevStatus = prevRoomStatusRef.current;
    const prevRound = prevRoomRoundRef.current;
    prevRoomStatusRef.current = rm.status;
    prevRoomRoundRef.current = rm.round;

    if (rm.status === 'prep') {
      setPrepTimer(rm.prepSecondsLeft);
      if (prevStatus === 'lobby' || prevStatus === null) {
        // Match just started! Reset run cleanly for online match
        clearTimers();
        combatRef.current = null;
        bridgeRef.current.combatState = null;
        setIsOnlineMode(true);
        setOnlineModalOpen(false);
        setOnlineMatchup(null);
        setScoutedPlayerId(null);
        setRound(1);
        setPhase('prep');
        setHp(INITIAL_HP);
        setGold(INITIAL_GOLD);
        setLevel(INITIAL_LEVEL);
        setXp(0);
        setStreak(0);
        setWins(0);
        setLosses(0);
        setTotalDamage(0);
        setHighestStar(1);
        setTopUnitTracker({});
        setAugments([]);
        setRoster(createStarterRoster());
        setShop(rollShop(INITIAL_LEVEL, 5));
        setShopLocked(false);
        setInventoryItems(['keskin_kunai', 'cakra_parsomeni']);
        setSelectedUnitUid(null);
        setSelectedItemIndex(null);
        setDamageMeter([]);
        setRunSummary(null);
        setScreen('playing');
        sound.playCombatStart();
        openAugmentDraftIfDue(1, []);
      } else if (prevStatus !== 'prep' || rm.round !== prevRound) {
        // Entering next round's Prep Phase
        combatRef.current = null;
        bridgeRef.current.combatState = null;
        setOnlineMatchup(null);
        setRound(rm.round);
        setPhase('prep');
        openAugmentDraftIfDue(rm.round, augmentsRef.current);
      }
    }
  }, [mp.room, clearTimers, openAugmentDraftIfDue]);

  // Sync player's live board + stats to server whenever they change during Online matches
  useEffect(() => {
    if (!isOnlineMode || !mp.room || mp.room.status === 'lobby' || mp.room.status === 'finished') {
      return;
    }
    mp.syncBoard(playerBoardUnits, level, gold, augments);
  }, [isOnlineMode, mp.room?.code, mp.room?.status, playerBoardUnits, level, gold, augments, mp.syncBoard]);

  // Keep server prep timer mirrored in HUD during Online Prep
  useEffect(() => {
    if (isOnlineMode && mp.room && mp.room.status === 'prep') {
      setPrepTimer(mp.room.prepSecondsLeft);
    }
  }, [isOnlineMode, mp.room?.prepSecondsLeft, mp.room?.status]);

  // Compute active wave (either solo ENEMY_WAVES or online opponent preview)
  const wave: EnemyWaveDef = useMemo(() => {
    if (isOnlineMode) {
      return {
        round,
        stageLabel: `${Math.ceil(round / 3)}-${((round - 1) % 3) + 1}`,
        name: onlineMatchup ? `VS ${onlineMatchup.opponentName}` : `Oda ${mp.room?.code ?? ''}`,
        subtitle: 'Online Kage Arenası',
        arena: onlineMatchup?.arena ?? selectedArenaId,
        units: onlineMatchup ? onlineMatchup.enemyUnits : [],
      };
    }
    return ENEMY_WAVES[Math.min(round - 1, ENEMY_WAVES.length - 1)];
  }, [isOnlineMode, round, onlineMatchup, mp.room?.code, selectedArenaId]);

  const scoutedPlayer: OnlinePlayerSummary | null = useMemo(() => {
    if (!isOnlineMode || !scoutedPlayerId || !mp.room) return null;
    return mp.room.players.find((p) => p.id === scoutedPlayerId) ?? null;
  }, [isOnlineMode, scoutedPlayerId, mp.room]);

  const scoutedOpponentBridge = useMemo(() => {
    if (!scoutedPlayer || phase !== 'prep') return null;
    return {
      name: scoutedPlayer.nickname,
      arenaId: scoutedPlayer.arenaId,
      avatarId: scoutedPlayer.avatarId,
      units: mirrorBoardForEnemy(scoutedPlayer.boardUnits),
    };
  }, [scoutedPlayer, phase]);

  const myOnlineSummary = useMemo(() => {
    if (!isOnlineMode || !mp.room || !mp.playerId) return null;
    return mp.room.players.find((p) => p.id === mp.playerId) ?? null;
  }, [isOnlineMode, mp.room, mp.playerId]);

  // TFT Host-Arena Ownership: Scouted rival's arena -> Online PvP host's arena -> Player's chosen home arena!
  const activeArenaId: ArenaMapId =
    scoutedOpponentBridge?.arenaId ??
    (isOnlineMode && phase === 'combat' && onlineMatchup ? onlineMatchup.arena : selectedArenaId);

  const activeArenaOwnerName: string | null = scoutedOpponentBridge
    ? `${scoutedOpponentBridge.name} Arenası`
    : isOnlineMode && phase === 'combat' && onlineMatchup
      ? `${onlineMatchup.arenaOwnerName} Arenası`
      : null;

  const maxInterest = augments.includes('altin_yagmuru') ? 7 : 5;

  useEffect(() => {
    document.body.dataset.state = screen;
  }, [screen]);

  const bridgeRef = useRef<ArenaRenderBridge>({
    phase,
    arenaId: activeArenaId,
    arenaOwnerName: activeArenaOwnerName,
    wave,
    playerBoardUnits,
    playerBenchUnits,
    playerAvatarId: myOnlineSummary?.avatarId ?? 'nartuto',
    playerHp: hp,
    gold,
    maxInterest,
    opponentAvatarId: onlineMatchup?.opponentAvatar ?? null,
    opponentName: onlineMatchup?.opponentName ?? null,
    scoutedOpponent: null,
    mergeCelebrations: [],
    selectedUnitUid,
    selectedItemActive: selectedItemIndex !== null,
    draggedUnitUid: null,
    isDraggingUnit: false,
    isDraggingItem: false,
    draggedItemId: null,
    hoverCombineUnitUid: null,
    dragClientPos: null,
    combatState: null,
    lootOrbs: [],
    roundBanner,
  });
  bridgeRef.current.phase = phase;
  bridgeRef.current.arenaId = activeArenaId;
  bridgeRef.current.arenaOwnerName = activeArenaOwnerName;
  bridgeRef.current.wave = wave;
  bridgeRef.current.playerBoardUnits = playerBoardUnits;
  bridgeRef.current.playerBenchUnits = playerBenchUnits;
  bridgeRef.current.playerAvatarId = myOnlineSummary?.avatarId ?? 'nartuto';
  bridgeRef.current.playerHp = hp;
  bridgeRef.current.gold = gold;
  bridgeRef.current.maxInterest = maxInterest;
  bridgeRef.current.opponentAvatarId = onlineMatchup?.opponentAvatar ?? null;
  bridgeRef.current.opponentName = onlineMatchup?.opponentName ?? null;
  bridgeRef.current.scoutedOpponent = scoutedOpponentBridge;
  bridgeRef.current.mergeCelebrations = mergeCelebrationsRef.current;
  bridgeRef.current.selectedUnitUid = selectedUnitUid;
  bridgeRef.current.selectedItemActive = selectedItemIndex !== null;
  bridgeRef.current.draggedUnitUid =
    activeDrag?.payload.kind === 'unit' ? activeDrag.payload.uid : null;
  bridgeRef.current.isDraggingUnit = activeDrag?.payload.kind === 'unit';
  bridgeRef.current.isDraggingItem = activeDrag?.payload.kind === 'item';
  bridgeRef.current.draggedItemId =
    activeDrag?.payload.kind === 'item' ? activeDrag.payload.itemId : null;
  bridgeRef.current.hoverCombineUnitUid =
    activeDrag?.payload.kind === 'item' ? (activeDrag.hoverUnitUid ?? null) : null;
  bridgeRef.current.dragClientPos = activeDrag
    ? { x: activeDrag.clientX, y: activeDrag.clientY }
    : null;
  bridgeRef.current.lootOrbs = lootOrbs;
  bridgeRef.current.roundBanner = roundBanner;

  const resetRun = useCallback(
    (goToScreen: GameScreenState, openRound1Augment = false) => {
      clearTimers();
      if (isOnlineRef.current) {
        mp.leaveRoom();
      }
      setIsOnlineMode(false);
      setOnlineMatchup(null);
      setScoutedPlayerId(null);
      combatRef.current = null;
      bridgeRef.current.combatState = null;
      mergeCelebrationsRef.current = [];
      setRound(1);
      setPhase('prep');
      setPrepTimer(PREP_DURATION_SEC);
      setHp(INITIAL_HP);
      setGold(INITIAL_GOLD);
      setLevel(INITIAL_LEVEL);
      setXp(0);
      setStreak(0);
      setWins(0);
      setLosses(0);
      setTotalDamage(0);
      setHighestStar(1);
      setTopUnitTracker({});
      setAugments([]);
      setAugmentDraft(null);
      setRoster(createStarterRoster());
      setShop(rollShop(INITIAL_LEVEL, 5));
      setShopLocked(false);
      setInventoryItems(['keskin_kunai', 'cakra_parsomeni']);
      lootOrbsRef.current = [];
      bridgeRef.current.lootOrbs = [];
      setLootOrbs([]);
      pendingDragRef.current = null;
      activeDragRef.current = null;
      setActiveDrag(null);
      setSelectedUnitUid(null);
      setSelectedItemIndex(null);
      setDamageMeter([]);
      setRoundBanner(null);
      setRunSummary(null);
      setScreen(goToScreen);
      if (openRound1Augment) {
        openAugmentDraftIfDue(1, []);
      }
    },
    [clearTimers, mp.leaveRoom, openAugmentDraftIfDue],
  );

  const handleStartGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    sound.playCombatStart();
    resetRun('playing', true);
  }, [resetRun]);

  // ---- AUGMENT SELECTION ----

  const handleChooseAugment = useCallback(
    (aug: AugmentDef) => {
      setAugments((prev) => (prev.includes(aug.id) ? prev : [...prev, aug.id]));
      setAugmentDraft(null);
      sound.playMerge(3);

      // Apply instant augment bonuses immediately
      if (aug.id === 'altin_yagmuru') {
        setGold((g) => g + 16);
      } else if (aug.id === 'hizli_egitim') {
        const res = addXp(level, xp, 10);
        setLevel(res.level);
        setXp(res.xp);
      } else if (aug.id === 'celik_irade') {
        setHp((h) => Math.min(INITIAL_HP, h + 15));
      } else if (aug.id === 'efsaneler_cagrisi') {
        setGold((g) => g + 10);
        const r1 = BASE_ITEM_IDS[Math.floor(Math.random() * BASE_ITEM_IDS.length)];
        const r2 = BASE_ITEM_IDS[Math.floor(Math.random() * BASE_ITEM_IDS.length)];
        setInventoryItems((prev) => [...prev, r1, r2]);
      }

      showBanner(`${aug.name} Aktif!`, aug.shortBadge, 'merge', 2200);
    },
    [level, xp, showBanner],
  );

  const handleRerollAugments = useCallback(() => {
    if (!augmentDraft || augmentDraft.rerolled) return;
    const exclude = [...augments, ...augmentDraft.choices.map((c) => c.id)];
    const nextChoices = rollAugmentChoices(exclude, 3);
    const fallback = nextChoices.length >= 3 ? nextChoices : rollAugmentChoices(augments, 3);
    setAugmentDraft({ round: augmentDraft.round, choices: fallback, rerolled: true });
    sound.playReroll();
  }, [augmentDraft, augments]);

  // ---- SHOP, MERGE & ECONOMY ACTIONS ----

  const findEmptyBenchSlot = useCallback((units: OwnedUnit[]): number | null => {
    const used = new Set(units.filter((u) => u.location === 'bench').map((u) => u.benchIndex));
    for (let i = 0; i < BENCH_SIZE; i++) {
      if (!used.has(i)) return i;
    }
    return null;
  }, []);

  const handleBuyUnit = useCallback(
    (slotIndex: number) => {
      const slot = shop[slotIndex];
      if (!slot || slot.purchased || !slot.defId) return;
      const def = SHINOBI_BY_ID[slot.defId];
      if (!def || gold < def.cost) return;

      const emptyBench = findEmptyBenchSlot(roster);
      const sameOneStarCount = roster.filter((u) => u.defId === def.id && u.stars === 1).length;
      if (emptyBench === null && sameOneStarCount < 2) {
        showBanner('Yedek Kulübesi Dolu', 'Yeni shinobi almak için bir birim sat veya arenaya koy.', 'loss', 1600);
        return;
      }

      const newUnit: OwnedUnit = {
        uid: `u_${uidCounterRef.current++}`,
        defId: def.id,
        stars: 1,
        location: 'bench',
        benchIndex: emptyBench ?? 0,
        hex: null,
        items: [],
      };

      const merged = tryMergeUnits([...roster, newUnit]);
      setGold((g) => g - def.cost);
      setShop((prev) =>
        prev.map((s) => (s.slotIndex === slotIndex ? { ...s, purchased: true } : s)),
      );
      setRoster(merged.roster);
      if (merged.returnedItems.length > 0) {
        setInventoryItems((prev) => [...prev, ...merged.returnedItems]);
      }

      if (merged.merges.length > 0) {
        const lastMerge = merged.merges[merged.merges.length - 1];
        const mDef = SHINOBI_BY_ID[lastMerge.defId];
        setHighestStar((prev) => (lastMerge.newStars > prev ? lastMerge.newStars : prev));
        sound.playMerge(lastMerge.newStars);

        // Trigger golden pixel pillar celebration if merged unit is on the board!
        const mergedUnit = merged.roster.find((u) => u.uid === lastMerge.uid);
        if (mergedUnit?.hex) {
          const nowTs = performance.now();
          mergeCelebrationsRef.current = [
            ...mergeCelebrationsRef.current.filter((m) => nowTs - m.startedAt < 1200),
            {
              col: mergedUnit.hex.col,
              row: mergedUnit.hex.row,
              stars: lastMerge.newStars,
              startedAt: nowTs,
            },
          ];
        }

        showBanner(
          `${mDef.name} ${'★'.repeat(lastMerge.newStars)} Yükseldi!`,
          'Üç kopya birleşti — çakra gücü katlandı!',
          'merge',
          2200,
        );
        setSelectedUnitUid(lastMerge.uid);
      } else {
        sound.playBuy();
        setSelectedUnitUid(newUnit.uid);
      }
    },
    [shop, gold, roster, findEmptyBenchSlot, showBanner],
  );

  const handleReroll = useCallback(() => {
    if (gold < 2) return;
    setGold((g) => g - 2);
    setShop(rollShop(level, 5));
    setShopLocked(false);
    sound.playReroll();
  }, [gold, level]);

  const handleBuyXp = useCallback(() => {
    if (gold < 4 || level >= MAX_LEVEL) return;
    const next = addXp(level, xp, 4);
    setGold((g) => g - 4);
    setLevel(next.level);
    setXp(next.xp);
    if (next.leveledUp) {
      sound.playMerge(2);
      const nextCap = getMaxBoardUnits(next.level, augments);
      showBanner(`Seviye ${next.level}!`, `Artık arenaya ${nextCap} shinobi dizebilirsin.`, 'merge', 1800);
    } else {
      sound.playBuy();
    }
  }, [gold, level, xp, augments, showBanner]);

  const handleSellUnit = useCallback(
    (uid: string) => {
      if (phase !== 'prep') return;
      const target = roster.find((u) => u.uid === uid);
      if (!target) return;
      const def = SHINOBI_BY_ID[target.defId];
      const refund = getSellValue(def.cost, target.stars);

      setRoster((prev) => prev.filter((u) => u.uid !== uid));
      setGold((g) => g + refund);
      if (target.items.length > 0) {
        setInventoryItems((prev) => [...prev, ...target.items]);
      }
      if (selectedUnitUid === uid) setSelectedUnitUid(null);
      sound.playSell();
    },
    [phase, roster, selectedUnitUid],
  );

  const equipSpecificItemToUnit = useCallback(
    (itemIndex: number, uid: string) => {
      const itemId = inventoryItems[itemIndex];
      if (!itemId) return false;
      const target = roster.find((u) => u.uid === uid);
      if (!target) return false;

      const equipped = equipItemWithCombine(target.items, itemId);
      if (!equipped) return false;

      setRoster((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, items: equipped.nextItems } : u)),
      );
      setInventoryItems((prev) => prev.filter((_, idx) => idx !== itemIndex));
      setSelectedItemIndex(null);

      // Real TFT mid-combat item slamming: apply stat/HP/mana boost immediately to live fighting unit!
      if (phaseRef.current === 'combat' && combatRef.current) {
        const liveUnit = combatRef.current.units.find(
          (cu) => cu.uid === uid && cu.team === 'player' && cu.alive,
        );
        if (liveUnit) {
          const prevMaxHp = liveUnit.stats.maxHp;
          liveUnit.items = equipped.nextItems;
          liveUnit.stats = computeUnitStats(
            liveUnit.defId,
            liveUnit.stars,
            equipped.nextItems,
            synergies,
            augmentsRef.current,
          );
          const hpGain = Math.max(0, liveUnit.stats.maxHp - prevMaxHp);
          liveUnit.hp = Math.min(liveUnit.stats.maxHp, liveUnit.hp + hpGain);
          liveUnit.ghostHp = Math.max(liveUnit.ghostHp, liveUnit.hp);
        }
      }

      if (equipped.combinedInto) {
        const crafted = ITEMS[equipped.combinedInto];
        sound.playMerge(2);
        showBanner(
          `${crafted.name} Üretildi!`,
          `${SHINOBI_BY_ID[target.defId].name} · ${crafted.shortStat}`,
          'merge',
          2100,
        );
      } else {
        sound.playBuy();
        showBanner(
          `${ITEMS[itemId].name} Kuşanıldı`,
          `${SHINOBI_BY_ID[target.defId].name} (${ITEMS[itemId].shortStat})`,
          'merge',
          1500,
        );
      }
      return true;
    },
    [inventoryItems, roster, synergies, showBanner],
  );

  const combineInventoryItems = useCallback(
    (idxA: number, idxB: number) => {
      if (idxA === idxB) return false;
      const itemA = inventoryItems[idxA];
      const itemB = inventoryItems[idxB];
      if (!itemA || !itemB) return false;
      const result = combineItems(itemA, itemB);
      if (!result) return false;

      setInventoryItems((prev) => {
        const next: ItemId[] = [];
        for (let i = 0; i < prev.length; i++) {
          if (i === idxA || i === idxB) continue;
          next.push(prev[i]);
        }
        next.push(result);
        return next;
      });
      setSelectedItemIndex(null);
      sound.playMerge(2);
      showBanner(
        `${ITEMS[result].name} Üretildi!`,
        `Eşya birleştirildi · ${ITEMS[result].shortStat}`,
        'merge',
        1900,
      );
      return true;
    },
    [inventoryItems, showBanner],
  );

  const equipItemToUnit = useCallback(
    (uid: string) => {
      if (selectedItemIndex === null) return false;
      return equipSpecificItemToUnit(selectedItemIndex, uid);
    },
    [selectedItemIndex, equipSpecificItemToUnit],
  );

  // ---- POSITIONING (CLICK, DRAG-AND-DROP & [W] QUICK DEPLOY) ----

  const handleDropUnitOnHex = useCallback(
    (uid: string, hex: HexCoord) => {
      if (phase !== 'prep' || hex.row < PLAYER_START_ROW) return;
      setScoutedPlayerId(null);
      const moving = roster.find((u) => u.uid === uid);
      if (!moving) return;

      const occupant = roster.find(
        (u) => u.location === 'board' && u.hex?.col === hex.col && u.hex?.row === hex.row,
      );
      if (occupant && occupant.uid === moving.uid) return;

      if (occupant) {
        setRoster((prev) =>
          prev.map((u) => {
            if (u.uid === moving.uid) {
              return { ...u, location: 'board', benchIndex: null, hex: { ...hex } };
            }
            if (u.uid === occupant.uid) {
              return {
                ...u,
                location: moving.location,
                benchIndex: moving.benchIndex,
                hex: moving.hex ? { ...moving.hex } : null,
              };
            }
            return u;
          }),
        );
        sound.playPlace();
        setSelectedUnitUid(moving.uid);
        return;
      }

      if (moving.location === 'bench' && playerBoardUnits.length >= maxBoardUnits) {
        showBanner(
          'Arena Kapasitesi Dolu',
          `Şu an en fazla ${maxBoardUnits} shinobi dizebilirsin. Seviye Atla!`,
          'loss',
          1700,
        );
        return;
      }

      setRoster((prev) =>
        prev.map((u) =>
          u.uid === moving.uid
            ? { ...u, location: 'board', benchIndex: null, hex: { ...hex } }
            : u,
        ),
      );
      sound.playPlace();
      setSelectedUnitUid(moving.uid);
    },
    [phase, roster, playerBoardUnits.length, maxBoardUnits, showBanner],
  );

  const handleDropUnitOnBench = useCallback(
    (uid: string, benchIndex: number) => {
      if (phase !== 'prep') return;
      const moving = roster.find((u) => u.uid === uid);
      if (!moving) return;

      const occupant = roster.find(
        (u) => u.location === 'bench' && u.benchIndex === benchIndex,
      );
      if (occupant && occupant.uid === moving.uid) return;

      if (occupant) {
        setRoster((prev) =>
          prev.map((u) => {
            if (u.uid === moving.uid) {
              return { ...u, location: 'bench', benchIndex, hex: null };
            }
            if (u.uid === occupant.uid) {
              return {
                ...u,
                location: moving.location,
                benchIndex: moving.benchIndex,
                hex: moving.hex ? { ...moving.hex } : null,
              };
            }
            return u;
          }),
        );
      } else {
        setRoster((prev) =>
          prev.map((u) =>
            u.uid === moving.uid ? { ...u, location: 'bench', benchIndex, hex: null } : u,
          ),
        );
      }
      sound.playPlace();
      setSelectedUnitUid(moving.uid);
    },
    [phase, roster],
  );

  const handleQuickToggleUnit = useCallback(
    (uid: string) => {
      if (phase !== 'prep') return;
      const unit = roster.find((u) => u.uid === uid);
      if (!unit) return;

      if (unit.location === 'board') {
        const emptyBench = findEmptyBenchSlot(roster);
        if (emptyBench === null) {
          showBanner('Yedek Kulübesi Dolu', 'Birimi geri çekmek için boş yedek yuvası gerekli.', 'loss', 1400);
          return;
        }
        handleDropUnitOnBench(uid, emptyBench);
      } else {
        if (playerBoardUnits.length >= maxBoardUnits) {
          showBanner('Arena Kapasitesi Dolu', `En fazla ${maxBoardUnits} shinobi dizebilirsin.`, 'loss', 1500);
          return;
        }
        const def = SHINOBI_BY_ID[unit.defId];
        const occupied = new Set(playerBoardUnits.map((u) => `${u.hex!.col},${u.hex!.row}`));
        const rowOrder = def.range <= 1 ? [3, 4, 5] : [5, 4, 3];
        const colOrder = [3, 2, 4, 1, 5, 0, 6];
        for (const r of rowOrder) {
          for (const c of colOrder) {
            if (!occupied.has(`${c},${r}`)) {
              handleDropUnitOnHex(uid, { col: c, row: r });
              return;
            }
          }
        }
      }
    },
    [phase, roster, findEmptyBenchSlot, handleDropUnitOnBench, playerBoardUnits, maxBoardUnits, handleDropUnitOnHex, showBanner],
  );

  const handleStartUnitDrag = useCallback(
    (unit: OwnedUnit, clientX: number, clientY: number) => {
      if (phase !== 'prep') return;
      setScoutedPlayerId(null);
      pendingDragRef.current = {
        payload: { kind: 'unit', uid: unit.uid, defId: unit.defId, stars: unit.stars },
        startX: clientX,
        startY: clientY,
      };
    },
    [phase],
  );

  const handleStartItemDrag = useCallback(
    (itemIndex: number, itemId: ItemId, clientX: number, clientY: number) => {
      pendingDragRef.current = {
        payload: { kind: 'item', itemIndex, itemId },
        startX: clientX,
        startY: clientY,
      };
    },
    [],
  );

  const dragHandlersRef = useRef({
    handleSellUnit,
    handleDropUnitOnHex,
    handleDropUnitOnBench,
    equipSpecificItemToUnit,
    combineInventoryItems,
    roster,
  });
  dragHandlersRef.current = {
    handleSellUnit,
    handleDropUnitOnHex,
    handleDropUnitOnBench,
    equipSpecificItemToUnit,
    combineInventoryItems,
    roster,
  };

  useEffect(() => {
    const isOverSell = (clientX: number, clientY: number): boolean => {
      const els = document.elementsFromPoint(clientX, clientY);
      return els.some((el) => el instanceof HTMLElement && el.dataset.sellZone === 'true');
    };

    const findItemSlotAt = (clientX: number, clientY: number): number | null => {
      const els = document.elementsFromPoint(clientX, clientY);
      for (const el of els) {
        if (el instanceof HTMLElement && el.dataset.itemSlot !== undefined) {
          const parsed = Number(el.dataset.itemSlot);
          if (!Number.isNaN(parsed)) return parsed;
        }
      }
      return null;
    };

    const findBenchSlotAt = (clientX: number, clientY: number): number | null => {
      const canvasBench = canvasApiRef.current?.getBenchSlotAtClientPos(clientX, clientY);
      if (canvasBench !== null && canvasBench !== undefined) return canvasBench;
      const els = document.elementsFromPoint(clientX, clientY);
      for (const el of els) {
        if (el instanceof HTMLElement && el.dataset.benchSlot !== undefined) {
          const parsed = Number(el.dataset.benchSlot);
          if (!Number.isNaN(parsed)) return parsed;
        }
      }
      return null;
    };

    const onPointerMove = (e: PointerEvent) => {
      const current = activeDragRef.current;
      if (current) {
        const overSellZone =
          current.payload.kind === 'unit' && isOverSell(e.clientX, e.clientY);
        let hoverUnitUid: string | null = null;
        let hoverItemIndex: number | null = null;
        if (current.payload.kind === 'item') {
          const slotIdx = findItemSlotAt(e.clientX, e.clientY);
          if (slotIdx !== null && slotIdx !== current.payload.itemIndex) {
            hoverItemIndex = slotIdx;
          } else {
            hoverUnitUid =
              canvasApiRef.current?.getUnitAtClientPos(e.clientX, e.clientY)?.uid ?? null;
          }
        }
        const next: ActiveDrag = {
          payload: current.payload,
          clientX: e.clientX,
          clientY: e.clientY,
          overSellZone,
          hoverUnitUid,
          hoverItemIndex,
        };
        activeDragRef.current = next;
        bridgeRef.current.dragClientPos = { x: e.clientX, y: e.clientY };
        setActiveDrag(next);
        return;
      }

      const pending = pendingDragRef.current;
      if (!pending) return;
      if (Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY) >= 5) {
        const overSellZone =
          pending.payload.kind === 'unit' && isOverSell(e.clientX, e.clientY);
        let hoverUnitUid: string | null = null;
        let hoverItemIndex: number | null = null;
        if (pending.payload.kind === 'item') {
          const slotIdx = findItemSlotAt(e.clientX, e.clientY);
          if (slotIdx !== null && slotIdx !== pending.payload.itemIndex) {
            hoverItemIndex = slotIdx;
          } else {
            hoverUnitUid =
              canvasApiRef.current?.getUnitAtClientPos(e.clientX, e.clientY)?.uid ?? null;
          }
        }
        const started: ActiveDrag = {
          payload: pending.payload,
          clientX: e.clientX,
          clientY: e.clientY,
          overSellZone,
          hoverUnitUid,
          hoverItemIndex,
        };
        activeDragRef.current = started;
        bridgeRef.current.dragClientPos = { x: e.clientX, y: e.clientY };
        if (pending.payload.kind === 'unit') {
          setSelectedUnitUid(pending.payload.uid);
          setInspectedEnemy(null);
        } else {
          setSelectedItemIndex(pending.payload.itemIndex);
        }
        setActiveDrag(started);
      }
    };

    const finishDrag = (e?: PointerEvent) => {
      const current = activeDragRef.current;
      pendingDragRef.current = null;
      activeDragRef.current = null;
      bridgeRef.current.dragClientPos = null;

      if (!current) return;
      setActiveDrag(null);
      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 40);

      if (!e) return;

      const {
        handleSellUnit: sellFn,
        handleDropUnitOnHex: dropHexFn,
        handleDropUnitOnBench: dropBenchFn,
        equipSpecificItemToUnit: equipFn,
        combineInventoryItems: combineFn,
      } = dragHandlersRef.current;

      if (current.payload.kind === 'unit') {
        if (isOverSell(e.clientX, e.clientY)) {
          sellFn(current.payload.uid);
          return;
        }
        const benchIdx = findBenchSlotAt(e.clientX, e.clientY);
        if (benchIdx !== null) {
          dropBenchFn(current.payload.uid, benchIdx);
          return;
        }
        const hex = canvasApiRef.current?.getHexAtClientPos(e.clientX, e.clientY);
        if (hex && hex.row >= PLAYER_START_ROW) {
          dropHexFn(current.payload.uid, hex);
        }
      } else {
        // 1. Drop onto another component in the bottom-left Eşyalar rack to craft directly!
        const targetItemIdx = findItemSlotAt(e.clientX, e.clientY);
        if (targetItemIdx !== null && targetItemIdx !== current.payload.itemIndex) {
          combineFn(current.payload.itemIndex, targetItemIdx);
          return;
        }
        // 2. Drop directly onto ANY player shinobi (bench, prep board, OR live combat unit!)
        const targetUnit = canvasApiRef.current?.getUnitAtClientPos(e.clientX, e.clientY);
        if (targetUnit) {
          equipFn(current.payload.itemIndex, targetUnit.uid);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => finishDrag(e);
    const onCancel = () => finishDrag();

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('blur', onCancel);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', onCancel);
    };
  }, []);

  const handleSelectBenchSlot = useCallback(
    (benchIndex: number) => {
      if (suppressNextClickRef.current) return;
      setScoutedPlayerId(null);
      const unitInSlot = roster.find((u) => u.location === 'bench' && u.benchIndex === benchIndex);

      if (selectedItemIndex !== null && unitInSlot) {
        equipItemToUnit(unitInSlot.uid);
        return;
      }

      if (selectedUnitUid) {
        const selected = roster.find((u) => u.uid === selectedUnitUid);
        if (selected && selected.uid === unitInSlot?.uid) {
          setSelectedUnitUid(null);
          return;
        }
        if (selected && phase === 'prep') {
          if (!unitInSlot) {
            setRoster((prev) =>
              prev.map((u) =>
                u.uid === selected.uid
                  ? { ...u, location: 'bench', benchIndex, hex: null }
                  : u,
              ),
            );
            sound.playPlace();
            setSelectedUnitUid(null);
            return;
          } else {
            setRoster((prev) =>
              prev.map((u) => {
                if (u.uid === selected.uid) {
                  return { ...u, location: 'bench', benchIndex, hex: null };
                }
                if (u.uid === unitInSlot.uid) {
                  return {
                    ...u,
                    location: selected.location,
                    benchIndex: selected.benchIndex,
                    hex: selected.hex ? { ...selected.hex } : null,
                  };
                }
                return u;
              }),
            );
            sound.playPlace();
            setSelectedUnitUid(null);
            return;
          }
        }
      }

      setSelectedUnitUid(unitInSlot ? unitInSlot.uid : null);
    },
    [roster, selectedItemIndex, selectedUnitUid, phase, equipItemToUnit],
  );

  const handleHexClick = useCallback(
    (hex: HexCoord) => {
      if (scoutedOpponentBridge) {
        const scoutUnit = scoutedOpponentBridge.units.find(
          (eu) => eu.col === hex.col && eu.row === hex.row,
        );
        if (scoutUnit) {
          setInspectedEnemy({
            defId: scoutUnit.defId,
            stars: scoutUnit.stars,
            items: scoutUnit.items ?? [],
          });
        }
        return;
      }

      if (hex.row < PLAYER_START_ROW) {
        setSelectedUnitUid(null);
        const enemyAtHex = wave.units.find((eu) => eu.col === hex.col && eu.row === hex.row);
        if (enemyAtHex) {
          setInspectedEnemy({
            defId: enemyAtHex.defId,
            stars: enemyAtHex.stars,
            items: enemyAtHex.items ?? [],
          });
        } else {
          setInspectedEnemy(null);
        }
        return;
      }
      setInspectedEnemy(null);

      const unitAtHex = roster.find(
        (u) => u.location === 'board' && u.hex?.col === hex.col && u.hex?.row === hex.row,
      );

      if (selectedItemIndex !== null && unitAtHex) {
        equipItemToUnit(unitAtHex.uid);
        return;
      }

      if (phase !== 'prep') {
        if (unitAtHex) setSelectedUnitUid(unitAtHex.uid);
        return;
      }

      if (selectedUnitUid) {
        const selected = roster.find((u) => u.uid === selectedUnitUid);
        if (!selected) {
          setSelectedUnitUid(unitAtHex ? unitAtHex.uid : null);
          return;
        }

        if (unitAtHex && unitAtHex.uid === selected.uid) {
          setSelectedUnitUid(null);
          return;
        }

        if (unitAtHex) {
          setRoster((prev) =>
            prev.map((u) => {
              if (u.uid === selected.uid) {
                return { ...u, location: 'board', benchIndex: null, hex: { ...hex } };
              }
              if (u.uid === unitAtHex.uid) {
                return {
                  ...u,
                  location: selected.location,
                  benchIndex: selected.benchIndex,
                  hex: selected.hex ? { ...selected.hex } : null,
                };
              }
              return u;
            }),
          );
          sound.playPlace();
          setSelectedUnitUid(null);
          return;
        } else {
          if (selected.location === 'bench' && playerBoardUnits.length >= maxBoardUnits) {
            showBanner(
              'Arena Kapasitesi Dolu',
              `Şu an en fazla ${maxBoardUnits} shinobi dizebilirsin. Seviye Atla!`,
              'loss',
              1700,
            );
            return;
          }
          setRoster((prev) =>
            prev.map((u) =>
              u.uid === selected.uid
                ? { ...u, location: 'board', benchIndex: null, hex: { ...hex } }
                : u,
            ),
          );
          sound.playPlace();
          setSelectedUnitUid(null);
          return;
        }
      }

      setSelectedUnitUid(unitAtHex ? unitAtHex.uid : null);
    },
    [
      scoutedOpponentBridge,
      roster,
      selectedItemIndex,
      phase,
      selectedUnitUid,
      playerBoardUnits.length,
      maxBoardUnits,
      equipItemToUnit,
      showBanner,
      wave.units,
    ],
  );

  const handleSelectItemSafe = useCallback((index: number | null) => {
    if (suppressNextClickRef.current) return;
    setSelectedItemIndex(index);
  }, []);

  const handleAutoDeploy = useCallback(() => {
    if (phase !== 'prep') return;
    setScoutedPlayerId(null);
    const currentBoard = roster.filter((u) => u.location === 'board' && u.hex);
    const openSlots = maxBoardUnits - currentBoard.length;
    if (openSlots <= 0) return;

    const bench = roster
      .filter((u) => u.location === 'bench')
      .sort((a, b) => b.stars - a.stars || SHINOBI_BY_ID[b.defId].cost - SHINOBI_BY_ID[a.defId].cost);
    if (bench.length === 0) return;

    const occupied = new Set(currentBoard.map((u) => `${u.hex!.col},${u.hex!.row}`));
    const toPlace = bench.slice(0, openSlots);
    const placements = new Map<string, HexCoord>();

    for (const u of toPlace) {
      const def = SHINOBI_BY_ID[u.defId];
      const rowOrder = def.range <= 1 ? [3, 4, 5] : [5, 4, 3];
      const colOrder = [3, 2, 4, 1, 5, 0, 6];
      let assigned: HexCoord | null = null;
      for (const r of rowOrder) {
        for (const c of colOrder) {
          if (!occupied.has(`${c},${r}`)) {
            assigned = { col: c, row: r };
            occupied.add(`${c},${r}`);
            break;
          }
        }
        if (assigned) break;
      }
      if (assigned) placements.set(u.uid, assigned);
    }

    if (placements.size > 0) {
      setRoster((prev) =>
        prev.map((u) => {
          const hex = placements.get(u.uid);
          if (!hex) return u;
          return { ...u, location: 'board', benchIndex: null, hex };
        }),
      );
      sound.playPlace();
    }
  }, [phase, roster, maxBoardUnits]);

  // ---- COMBAT START & RESOLUTION ----

  const finishCombat = useCallback(
    (combat: CombatState) => {
      const roundDmgDealt = combat.units
        .filter((u) => u.team === 'player')
        .reduce((acc, u) => acc + u.damageDealt, 0);

      const nextTopTracker = { ...topUnitTracker };
      for (const u of combat.units) {
        if (u.team === 'player') {
          nextTopTracker[u.defId] = (nextTopTracker[u.defId] ?? 0) + u.damageDealt;
        }
      }
      setTopUnitTracker(nextTopTracker);
      const nextTotalDamage = totalDamage + roundDmgDealt;
      setTotalDamage(nextTotalDamage);

      // In Online Mode, server is authoritative for HP/rounds: report combat done and wait for sync!
      if (isOnlineRef.current) {
        mp.reportCombatDone(round);
        return;
      }

      const playerWon = combat.winner === 'player';
      const survivingEnemies = combat.units.filter((u) => u.team === 'enemy' && u.alive).length;

      const nextWins = playerWon ? wins + 1 : wins;
      const nextLosses = playerWon ? losses : losses + 1;
      setWins(nextWins);
      setLosses(nextLosses);

      const nextStreak = playerWon
        ? streak >= 0
          ? streak + 1
          : 1
        : streak <= 0
          ? streak - 1
          : -1;
      setStreak(nextStreak);

      const hpDamage = playerWon ? 0 : calculatePlayerDamage(round, survivingEnemies);
      const nextHp = Math.max(0, hp - hpDamage);
      setHp(nextHp);

      if (playerWon) {
        sound.playVictory();
        const orbHint =
          wave.isPve && lootOrbsRef.current.length > 0
            ? 'Sağ tıkla Kage’yi yürütüp küreleri topla!'
            : 'Harika strateji!';
        const itemMsg = wave.rewardItem ? ` · +${ITEMS[wave.rewardItem].name}` : '';
        showBanner(
          wave.isPve ? `${wave.stageLabel} Canavar Avı Tamam!` : 'Tur Kazanıldı!',
          `${orbHint}${itemMsg}`,
          'win',
          2400,
        );
        if (wave.rewardItem) {
          setInventoryItems((prev) => [...prev, wave.rewardItem!]);
        }
      } else {
        sound.playDefeat();
        showBanner('Tur Kaybedildi', `-${hpDamage} Kage Canı`, 'loss', 2200);
      }

      setPhase('resolution');

      let topDefId = 'nartuto';
      let topDmg = -1;
      for (const [id, d] of Object.entries(nextTopTracker)) {
        if (d > topDmg) {
          topDmg = d;
          topDefId = id;
        }
      }

      // Give slightly longer post-PvE window if Loot Orbs are on floor (players can also collect during Prep!)
      resolutionTimeoutRef.current = window.setTimeout(() => {
        if (nextHp <= 0) {
          setRunSummary({
            victory: false,
            roundReached: round,
            wins: nextWins,
            losses: nextLosses,
            totalDamage: nextTotalDamage,
            highestStar,
            topUnitName: SHINOBI_BY_ID[topDefId]?.name ?? 'Nartuto',
            remainingHp: 0,
          });
          setScreen('gameover');
          return;
        }

        if (playerWon && round >= MAX_ROUNDS) {
          setRunSummary({
            victory: true,
            roundReached: MAX_ROUNDS,
            wins: nextWins,
            losses: nextLosses,
            totalDamage: nextTotalDamage,
            highestStar,
            topUnitName: SHINOBI_BY_ID[topDefId]?.name ?? 'Nartuto',
            remainingHp: nextHp,
          });
          setScreen('gameover');
          return;
        }

        const income = calculateRoundIncome(gold, Math.abs(nextStreak), playerWon, augments);
        const xpRes = addXp(level, xp, 2);
        const nextRound = Math.min(MAX_ROUNDS, round + 1);

        setGold((g) => g + income.total);
        setLevel(xpRes.level);
        setXp(xpRes.xp);
        setRound(nextRound);
        if (!shopLocked) {
          setShop(rollShop(xpRes.level, 5));
        }
        combatRef.current = null;
        bridgeRef.current.combatState = null;
        setPrepTimer(PREP_DURATION_SEC);
        setPhase('prep');
        openAugmentDraftIfDue(nextRound, augments);
      }, 1650);
    },
    [
      topUnitTracker,
      totalDamage,
      wins,
      losses,
      streak,
      round,
      hp,
      wave,
      highestStar,
      gold,
      level,
      xp,
      augments,
      shopLocked,
      showBanner,
      mp.reportCombatDone,
      openAugmentDraftIfDue,
    ],
  );

  const finishCombatRef = useRef(finishCombat);
  finishCombatRef.current = finishCombat;

  const handleStartCombat = useCallback(() => {
    if (phase !== 'prep') return;

    // In Online mode, the CTA toggles "Hazır Ol!" to fast-forward the synchronized PvP timer!
    if (isOnlineMode) {
      const nextReady = !(myOnlineSummary?.ready ?? false);
      mp.setReady(nextReady);
      sound.playBuy();
      return;
    }

    pendingDragRef.current = null;
    activeDragRef.current = null;
    setActiveDrag(null);
    setAugmentDraft(null);

    let boardForCombat = playerBoardUnits;
    if (boardForCombat.length === 0) {
      const bench = roster.filter((u) => u.location === 'bench');
      if (bench.length > 0) {
        const first = bench[0];
        const deployed: OwnedUnit = {
          ...first,
          location: 'board',
          benchIndex: null,
          hex: { col: 3, row: 3 },
        };
        setRoster((prev) => prev.map((u) => (u.uid === first.uid ? deployed : u)));
        boardForCombat = [deployed];
      }
    }

    if (boardForCombat.length === 0) return;

    // Auto-collect any remaining floor Loot Orbs from previous stage when next combat launches (TFT magnetic sweep!)
    collectAllRemainingLootOrbs();

    const combat = createCombatState(boardForCombat, wave.units, {
      playerAugments: augments,
    });
    combatRef.current = combat;
    bridgeRef.current.combatState = combat;
    setSelectedUnitUid(null);
    setInspectedEnemy(null);
    setSelectedItemIndex(null);
    setDamageMeter([]);
    setPhase('combat');
    sound.playCombatStart();
  }, [
    phase,
    isOnlineMode,
    myOnlineSummary?.ready,
    mp.setReady,
    playerBoardUnits,
    roster,
    wave.units,
    augments,
    collectAllRemainingLootOrbs,
  ]);

  // ---- SOLO PREP COUNTDOWN TIMER ----

  useEffect(() => {
    if (isOnlineMode || screen !== 'playing' || phase !== 'prep' || augmentDraft) return;
    const id = window.setInterval(() => {
      setPrepTimer((prev) => {
        if (prev <= 1) {
          handleStartCombat();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isOnlineMode, screen, phase, augmentDraft, handleStartCombat]);

  // ---- 60 FPS COMBAT SIMULATION LOOP ----

  useEffect(() => {
    if (screen !== 'playing' || phase !== 'combat') return;

    let rafId = 0;
    let last = performance.now();
    let meterSyncAccum = 0;
    let resolved = false;

    const tick = (now: number) => {
      const rawDt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const combat = combatRef.current;
      if (!combat) return;

      const effectiveSpeed = isOnlineRef.current ? 1 : speedRef.current;
      stepCombat(combat, rawDt * effectiveSpeed);

      let hitPlayed = false;
      for (const ev of combat.events) {
        if (ev.type === 'jutsu') {
          sound.playJutsu(ev.jutsuType);
        } else if (ev.type === 'ko') {
          sound.playKo();
        } else if (ev.type === 'loot_drop' && ev.lootDrop) {
          spawnLootOrb(ev.x ?? 3, ev.y ?? 2, ev.lootDrop);
        } else if ((ev.type === 'hit' || ev.type === 'crit') && !hitPlayed) {
          sound.playHit(ev.type === 'crit');
          hitPlayed = true;
        }
      }

      meterSyncAccum += rawDt;
      if (meterSyncAccum >= 0.2) {
        meterSyncAccum = 0;
        const entries: DamageMeterEntry[] = combat.units
          .filter((u) => u.team === 'player')
          .map((u) => ({
            uid: u.uid,
            defId: u.defId,
            stars: u.stars,
            damage: u.damageDealt,
          }))
          .sort((a, b) => b.damage - a.damage);
        setDamageMeter(entries);
      }

      if (combat.winner !== null && !resolved) {
        resolved = true;
        const finalEntries: DamageMeterEntry[] = combat.units
          .filter((u) => u.team === 'player')
          .map((u) => ({
            uid: u.uid,
            defId: u.defId,
            stars: u.stars,
            damage: u.damageDealt,
          }))
          .sort((a, b) => b.damage - a.damage);
        setDamageMeter(finalEntries);
        finishCombatRef.current(combat);
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [screen, phase, spawnLootOrb]);

  // ---- GLOBAL KEYBOARD SHORTCUTS ----

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (screenRef.current === 'title') {
        if (!onlineModalOpen && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleStartGame();
        }
        return;
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (screenRef.current === 'playing') {
          e.preventDefault();
          setScreen('paused');
        } else if (screenRef.current === 'paused') {
          e.preventDefault();
          setScreen('playing');
        }
        return;
      }

      if (screenRef.current !== 'playing') return;

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleReroll();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleBuyXp();
      } else if ((e.key === 'w' || e.key === 'W') && selectedUnitUid && phaseRef.current === 'prep') {
        e.preventDefault();
        handleQuickToggleUnit(selectedUnitUid);
      } else if (e.key === ' ') {
        if (phaseRef.current === 'prep' && !augmentDraft) {
          e.preventDefault();
          handleStartCombat();
        }
      } else if ((e.key === 'e' || e.key === 'E') && selectedUnitUid && phaseRef.current === 'prep') {
        e.preventDefault();
        handleSellUnit(selectedUnitUid);
      } else if (e.key === 'm' || e.key === 'M') {
        setMuted((prev) => {
          sound.muted = !prev;
          return !prev;
        });
      } else if ((e.key === 'r' || e.key === 'R') && !isOnlineRef.current) {
        resetRun('playing', true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    onlineModalOpen,
    augmentDraft,
    handleStartGame,
    handleReroll,
    handleBuyXp,
    handleQuickToggleUnit,
    handleStartCombat,
    handleSellUnit,
    selectedUnitUid,
    resetRun,
  ]);

  if (screen === 'title') {
    return (
      <>
        <TitleScreen
          spriteRev={spriteRev}
          selectedArenaId={selectedArenaId}
          onSelectArena={handleSelectArena}
          onStart={handleStartGame}
          onOpenOnline={() => setOnlineModalOpen(true)}
        />
        {onlineModalOpen && (
          <OnlineLobbyModal
            spriteRev={spriteRev}
            room={mp.room}
            playerId={mp.playerId}
            error={mp.error}
            initialRoomCode={initialRoomParam}
            selectedArenaId={selectedArenaId}
            onSelectArena={handleSelectArena}
            onSetRoomArena={mp.setArena}
            onCreateRoom={mp.createRoom}
            onJoinRoom={mp.joinRoom}
            onToggleBots={mp.toggleBots}
            onStartMatch={mp.startMatch}
            onLeaveRoom={() => {
              mp.leaveRoom();
              setOnlineModalOpen(false);
            }}
            onClose={() => {
              mp.clearError();
              setOnlineModalOpen(false);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#08090d] select-none">
      {/* FULL-BLEED 100% VIEWPORT 2.5D ARENA & LIVE 3D BENCH CANVAS */}
      <main className="absolute inset-0 w-full h-full">
        <ArenaCanvas
          bridgeRef={bridgeRef}
          canvasApiRef={canvasApiRef}
          onHexClick={handleHexClick}
          onBenchSlotClick={handleSelectBenchSlot}
          onBoardUnitPointerDown={handleStartUnitDrag}
          onCollectLootOrb={handleCollectLootOrb}
        />
      </main>

      {/* Slim Floating TFT Top Stage Pill + Top-Right Rehber/Hasar Controls */}
      <TopHud
        round={round}
        phase={phase}
        prepTimer={prepTimer}
        hp={hp}
        maxHp={INITIAL_HP}
        arenaId={activeArenaId}
        arenaOwnerName={activeArenaOwnerName}
        augments={augments}
        combatSpeed={combatSpeed}
        muted={muted}
        isOnline={isOnlineMode}
        roomCode={mp.room?.code}
        opponentName={onlineMatchup?.opponentName ?? null}
        rightDrawerOpen={rightDrawerOpen}
        rightDrawerTab={rightDrawerTab}
        onToggleRightDrawer={handleToggleRightDrawer}
        onToggleSpeed={() => setCombatSpeed((s) => (s === 1 ? 2 : 1))}
        onToggleMute={() =>
          setMuted((prev) => {
            sound.muted = !prev;
            return !prev;
          })
        }
        onPause={() => setScreen((s) => (s === 'paused' ? 'playing' : 'paused'))}
        onRestart={() => resetRun('playing', true)}
      />

      {/* Compact Floating TFT Left-Edge Synergies */}
      <SynergyPanel synergies={synergies} />

      {/* Forged Bottom-Left Shinobi Armory Tray (Hover Recipe Matrix + Direct Drag & Combine!) */}
      <ItemArmoryTray
        inventoryItems={inventoryItems}
        roster={roster}
        selectedItemIndex={selectedItemIndex}
        draggedItemIndex={activeDrag?.payload.kind === 'item' ? activeDrag.payload.itemIndex : null}
        draggedItemId={activeDrag?.payload.kind === 'item' ? activeDrag.payload.itemId : null}
        hoverItemIndex={activeDrag?.payload.kind === 'item' ? (activeDrag.hoverItemIndex ?? null) : null}
        onStartItemDrag={handleStartItemDrag}
        onSelectItem={handleSelectItemSafe}
      />

      {/* Scouting Return Plaque when inspecting a rival's live board & arena */}
      {scoutedPlayer && phase === 'prep' && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-3.5 py-1.5 game-plaque border-[#38bdf8]">
          <span className="font-display font-bold text-xs text-[#e0f2fe]">
            Gözcü: {scoutedPlayer.nickname} ({ARENA_MAPS[scoutedPlayer.arenaId]?.name})
          </span>
          <button
            type="button"
            onClick={() => setScoutedPlayerId(null)}
            className="cursor-pointer rounded-lg px-2.5 py-1 bg-[#0284c7] hover:bg-[#0ea5e9] text-[11px] font-display font-bold text-white"
          >
            Kendi Arenana Dön
          </button>
        </div>
      )}

      {/* Compact Floating TFT Right-Edge Online Standings */}
      {isOnlineMode && mp.room && (
        <LobbyStandingsPanel
          room={mp.room}
          playerId={mp.playerId}
          scoutedPlayerId={scoutedPlayerId}
          canScout={phase === 'prep'}
          recentEmotes={mp.recentEmotes}
          onScoutPlayer={(player) => setScoutedPlayerId(player ? player.id : null)}
          onSendEmote={mp.sendEmote}
        />
      )}

      {/* On-Demand Collapsible Floating Right Drawer (Hidden by default!) */}
      <RightPanel
        isOpen={rightDrawerOpen}
        activeTab={rightDrawerTab}
        phase={phase}
        selectedUnit={selectedUnit}
        inspectedEnemy={inspectedEnemy}
        synergies={synergies}
        selectedItemIndex={selectedItemIndex}
        damageMeter={damageMeter}
        hasOnlineStandings={Boolean(isOnlineMode && mp.room)}
        onChangeTab={(tab) => {
          setRightDrawerTab(tab);
          setRightDrawerOpen(true);
        }}
        onClose={() => {
          setRightDrawerOpen(false);
          setSelectedUnitUid(null);
          setInspectedEnemy(null);
        }}
        onSellUnit={handleSellUnit}
        onEquipToSelected={equipItemToUnit}
      />

      {/* Compact Centered Floating TFT Bottom Shop Bar */}
      <ShopDock
        phase={phase}
        gold={gold}
        streak={streak}
        augments={augments}
        level={level}
        xp={xp}
        shop={shop}
        shopLocked={shopLocked}
        roster={roster}
        deployedCount={playerBoardUnits.length}
        maxBoardUnits={maxBoardUnits}
        isOnline={isOnlineMode}
        isOnlineReady={myOnlineSummary?.ready ?? false}
        draggedUnit={draggedUnit}
        isHoveringSellZone={activeDrag?.overSellZone ?? false}
        onBuyUnit={handleBuyUnit}
        onReroll={handleReroll}
        onBuyXp={handleBuyXp}
        onToggleLock={() => setShopLocked((l) => !l)}
        onAutoDeploy={handleAutoDeploy}
        onStartCombat={handleStartCombat}
      />

      {/* Crisp Direct Floating Pixel-Art Drag Ghost (Unit Sprite OR Live TFT Forge Combine Preview!) */}
      {activeDrag && activeDrag.payload.kind === 'unit' && draggedUnitSpriteUrl && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: activeDrag.clientX,
            top: activeDrag.clientY,
            transform: 'translate(-50%, -62%)',
          }}
        >
          <div className="flex flex-col items-center">
            <span className="px-2 py-0.5 bg-[#08090d]/96 border border-[#d4a03a] text-[10px] font-display font-bold text-[#fde047] shadow-md mb-0.5 whitespace-nowrap">
              {SHINOBI_BY_ID[activeDrag.payload.defId].name} {'★'.repeat(activeDrag.payload.stars)}
            </span>
            <img
              src={draggedUnitSpriteUrl}
              alt=""
              className="w-[142px] h-[110px] object-contain pixelated drop-shadow-[0_10px_14px_rgba(0,0,0,0.85)]"
            />
          </div>
        </div>
      )}

      {activeDrag && activeDrag.payload.kind === 'item' && (
        <ItemDragPreviewOverlay
          draggedItemId={activeDrag.payload.itemId}
          clientX={activeDrag.clientX}
          clientY={activeDrag.clientY}
          hoverItemIndex={activeDrag.hoverItemIndex ?? null}
          hoverUnitUid={activeDrag.hoverUnitUid ?? null}
          inventoryItems={inventoryItems}
          roster={roster}
        />
      )}

      {/* TFT Kage Mührü (Augment) Draft Modal on Rounds 1, 4, 7 */}
      {augmentDraft && screen === 'playing' && phase === 'prep' && (
        <AugmentModal
          round={augmentDraft.round}
          choices={augmentDraft.choices}
          canReroll={!augmentDraft.rerolled}
          onChoose={handleChooseAugment}
          onReroll={handleRerollAugments}
        />
      )}

      {screen === 'paused' && (
        <PauseModal
          onResume={() => setScreen('playing')}
          onRestart={() => resetRun('playing', true)}
          onTitle={() => resetRun('title', false)}
        />
      )}

      {screen === 'gameover' && runSummary && (
        <GameOverModal
          summary={runSummary}
          onPlayAgain={() => {
            if (isOnlineMode) {
              resetRun('title', false);
              setOnlineModalOpen(true);
            } else {
              handleStartGame();
            }
          }}
          onTitle={() => resetRun('title', false)}
        />
      )}
    </div>
  );
}
