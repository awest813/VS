import React, { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { Game } from './game/Game';
import { RAID_MEDKIT_COOLDOWN_MS, RAID_BANDAGE_COOLDOWN_MS } from './game/player/PlayerController';
import { GADGET_ARCHETYPES, type GadgetItemId } from './game/gadgets/gadgetDefinitions';
import { RAID_GADGET_COOLDOWN_MS } from './game/raid/raidGadget';
import { RAID_LORE_BY_SEGMENT } from './game/level/raidLoreTerminals';
import { GameState } from './game/StateMachine';
import { db, StashItem, type Contract, type PlayerProfile } from './game/persistence/SaveDB';
import {
  getContractRaidHint,
  contractProgressSummary,
  hubDockingAllowed,
  getContractDeployZone,
  getContractUnlockRequirement,
  isContractUnlocked,
} from './game/contracts/contractRules';
import { ARMORY_PRIMARY_OFFERS, getWeaponRaidHudHint } from './game/weapons/weaponDefinitions';
import { getLootDefinition, lootTradeInCredits } from './game/loot/lootDatabase';
import { lootColorForItemId } from './game/loot/lootUi';
import { getLoadoutPrimarySwapIds } from './game/hub/loadoutRules';
import { isPrimaryWeaponItemId } from './game/weapons/weaponDefinitions';
import {
  ARMORY_UPGRADE_OFFERS,
  DEFAULT_UPGRADE_STATE,
  getUpgradeLevel,
  isUpgradeUnlocked,
  normalizeUpgradeState,
  type UpgradeOffer,
} from './game/progression/profileProgression';
import { hud, humanizeHudTarget } from './ui/uiTokens';

const fontUi = hud.fontUi;
const fontMono = hud.fontMono;
const panelBase: CSSProperties = { ...hud.panel() };

const JUNK_ITEM_IDS = new Set(['scrap_metal', 'copper_wire']);

function formatItemId(id: string): string {
  const fromDb = getLootDefinition(id)?.name;
  if (fromDb) return fromDb;
  const map: Record<string, string> = {
    survey_drive: 'Survey drive',
    scrap_metal: 'Scrap',
    copper_wire: 'Copper wire',
    ammo_9mm: '9×mm rounds',
    medkit: 'Medkit',
    bandage: 'Bandage',
    rifle_01: 'Assault rifle',
    shotgun_01: 'Pump shotgun',
    pulse_rifle: 'Pulse rifle',
    carbine_mk2: 'Combat carbine',
    thermal_lance: 'Thermal lance',
    void_disruptor: 'Void disruptor',
    smg_flechette: 'Flechette SMG',
    slug_cannon: 'Slug cannon',
    pistol_std: 'Standard pistol',
    revolver_454: '.454 Revolver',
    pulse_compact: 'Compact pulse',
    ammo_12g: '12g Buckshot',
    ammo_556: '5.56mm Standard',
    ammo_762_ap: '7.62mm AP',
    thermal_cell: 'Thermal cell',
    void_charge: 'Void charge',
    ammo_20g_slug: '20g Slug',
    ammo_454_mag: '.454 Magnum',
    flare_chem: 'Chem flare',
    shield_deploy: 'Portable shield',
    sensor_sweep: 'Sensor sweep',
  };
  return map[id] ?? id.replace(/_/g, ' ');
}

interface AppProps {
  game: Game;
}

const App: React.FC<AppProps> = ({ game }) => {
  const [gameState, setGameState] = useState<GameState>(game.stateMachine.getState());
  const [ammo, setAmmo] = useState({ current: 30, reserve: 90, max: 30 });
  const [reloading, setReloading] = useState(false);
  const [stash, setStash] = useState<StashItem[]>([]);
  const [loadout, setLoadout] = useState<StashItem[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [activeContractId, setActiveContractId] = useState<number | null>(null);
  const [inventory, setInventory] = useState<{ itemId: string; quantity: number }[]>([]);
  const [hoveredTarget, setHoveredTarget] = useState<string | null>(null);
  const [isShipUIOpen, setIsShipUIOpen] = useState<boolean>(false);
  const [money, setMoney] = useState<number>(0);
  const [profileUpgrades, setProfileUpgrades] = useState(DEFAULT_UPGRADE_STATE);
  const [health, setHealth] = useState({ current: 100, max: 100 });
  const [battery, setBattery] = useState({ current: 100, max: 100 });
  const [pointerLocked, setPointerLocked] = useState(typeof document !== 'undefined' && !!document.pointerLockElement);
  const [stationRaidKills, setStationRaidKills] = useState(0);
  const [equippedWeaponItemId, setEquippedWeaponItemId] = useState<string>('rifle_01');
  const [suitClass, setSuitClass] = useState<string>('pathfinder');
  const [toast, setToast] = useState<string | null>(null);
  const [medkitCooldownMs, setMedkitCooldownMs] = useState(0);
  const [bandageCooldownMs, setBandageCooldownMs] = useState(0);
  const [gadgetCooldownMs, setGadgetCooldownMs] = useState(0);
  const [stamina, setStamina] = useState({ current: 100, max: 100 });
  const [environmentalSurge, setEnvironmentalSurge] = useState(false);
  const [loreTerminalText, setLoreTerminalText] = useState<string | null>(null);
  const [openMerchantId, setOpenMerchantId] = useState<string | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeTab, setNoticeTab] = useState<'open' | 'history' | 'lore'>('open');
  const [isDeploying, setIsDeploying] = useState(false);
  const [hitMarker, setHitMarker] = useState(false);
  const [raidFailed, setRaidFailed] = useState(false);
  const [hasSaveData, setHasSaveData] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [npcDialogue, setNpcDialogue] = useState<string | null>(null);
  const [damageVignette, setDamageVignette] = useState(0); // 0-1 intensity

  const DIALOGUE_POOLS: Record<string, { greetings: string[], lore: string[], onBuy: string[] }> = {
    supply_post: {
      greetings: [
        "Need something to stop the bleeding? Or just something to keep the edge off?",
        "Credit's good here. Just don't tell the Captain about the tax-free status.",
        "Raid went well, I hope? If not, you'll need more of these."
      ],
      lore: [
        "The Meridian-class was never meant for this sector. We're running on fumes and stubbornness.",
        "Sgt. Hendrix thinks he's the only one keeping us alive. He forgets who supplies the medkits."
      ],
      onBuy: [
        "Good choice. Don't use it all in one place.",
        "That's the last of that batch. Use it well.",
        "Sourced that from a Moon Base wreck. Still works though."
      ]
    },
    quartermaster: {
      greetings: [
        "Check your gear twice, die once. What do you need, Operative?",
        "The armory is always open for those with the credits to back it up.",
        "Staging a deployment? Make sure you've got enough lead."
      ],
      lore: [
        "Frontier Outpost Alpha was the first to fall. I lost good people there.",
        "This suit you're wearing... it's seen three other pilots before you. Don't make it four."
      ],
      onBuy: [
        "Maintain it. It'll maintain you.",
        "High quality. Standard issue for Void Sovereigns.",
        "Don't waste it on the scenery. Aim for the center mass."
      ]
    },
    tech_specialist: {
      greetings: [
        "Scanning your suit... servos are 82% nominal. Could be better.",
        "Engineering isn't a miracle shop, but for enough credits, I can try.",
        "Watch your heat signature in the debris field. It's a death trap."
      ],
      lore: [
        "The environmental surge isn't natural. Something out there is drawing power.",
        "I've been tweaking the reactor core. We've got 15% more thrust, but it's shaky."
      ],
      onBuy: [
        "Installing the bypass now. Should give you more juice.",
        "Toughened the plating. Try not to test it immediately.",
        "Optimized the sensor array. You'll see them before they see you."
      ]
    }
  };

  const shipOpsDialogRef = useRef<HTMLDivElement>(null);

  const checkSaveData = useCallback(async () => {
    const count = await db.playerProfile.count();
    setHasSaveData(count > 0);
  }, []);

  const refreshDbToState = useCallback(async () => {
    const items = await db.stashItems.toArray();
    setStash(items.filter((i) => i.slot === 'stash'));
    setLoadout(items.filter((i) => i.slot === 'loadout'));
    const allContracts = await db.contracts.toArray();
    setContracts(allContracts);
    const active = allContracts.find((c) => c.isActive);
    setActiveContractId(active?.id ?? null);
    const profile = await db.playerProfile.toCollection().first();
    if (profile) {
      setMoney(profile.money);
      setProfileUpgrades(normalizeUpgradeState(profile));
      setSuitClass(profile.suitClass || 'pathfinder');
    } else {
      setMoney(0);
      setProfileUpgrades(DEFAULT_UPGRADE_STATE);
    }
    await game.syncDataFromDb();

    // Auto-trigger results screen when all contracts completed and back on ship
    const currentState = game.stateMachine.getState();
    if (currentState === GameState.SHIP) {
      const allContracts = await db.contracts.toArray();
      if (allContracts.length > 0 && allContracts.every(c => c.isCompleted)) {
        setTimeout(() => game.showResults(), 2400);
      }
    }
  }, []);

  useEffect(() => {
    void refreshDbToState();

    void checkSaveData();
    const cleanup = game.stateMachine.onStateChange((newState, oldState) => {
      setGameState(newState);
      
      // Trigger deployment cinematic when moving from SHIP to a raid scene
      if (oldState === GameState.SHIP && 
         (newState === GameState.STATION || newState === GameState.PLANET)) {
        setIsDeploying(true);
        setTimeout(() => setIsDeploying(false), 1600);
      }
    });

    const interval = setInterval(() => {
      setEnvironmentalSurge(game.raidEnvironmentalSurge);
      if (game.player) {
        setGadgetCooldownMs(game.player.gadgetCooldownRemainingMs);
        if (game.player.weapon) {
          const w = game.player.weapon;
          setAmmo({
            current: w.currentAmmo,
            reserve: w.reserveAmmo,
            max: w.maxAmmo,
          });
          setReloading(!!w.isReloading);
          setEquippedWeaponItemId(w.weaponItemId);
        }
        const st = game.stateMachine.getState();
        if (st === GameState.STATION || st === GameState.MOON_BASE || st === GameState.PLANET) {
          setStationRaidKills(game.enemiesKilledStation);
        }
        if (game.player.inventory) {
          setInventory([...game.player.inventory]);
        }
        setHealth({ current: game.player.health, max: game.player.maxHealth });
        setBattery({ current: Math.round(game.player.battery), max: game.player.maxBattery });
        setStamina({ current: Math.round(game.player.stamina), max: game.player.maxStamina });
        setHoveredTarget(game.player.hoveredInteractable || null);
        setMedkitCooldownMs(game.player.medkitCooldownRemainingMs);
        setBandageCooldownMs(game.player.bandageCooldownRemainingMs);
        if (game.player.suitClass) setSuitClass(game.player.suitClass);
      } else {
        setGadgetCooldownMs(0);
      }
    }, 100);

    const toggleUI = () => {
      setIsShipUIOpen((prev) => !prev);
    };
    window.addEventListener('toggleShipUI', toggleUI);

    const onOpenMerchant = (e: Event) => {
      const ce = e as CustomEvent<{ merchantId?: string }>;
      if (ce.detail?.merchantId) setOpenMerchantId(ce.detail.merchantId);
    };
    window.addEventListener('openMerchant', onOpenMerchant as EventListener);

    const onShowNotice = () => setNoticeOpen(true);
    window.addEventListener('showCrewNotice', onShowNotice);

    const onLockChange = () => {
      setPointerLocked(!!document.pointerLockElement);
    };
    document.addEventListener('pointerlockchange', onLockChange);

    return () => {
      cleanup();
      clearInterval(interval);
      window.removeEventListener('toggleShipUI', toggleUI);
      window.removeEventListener('openMerchant', onOpenMerchant as EventListener);
      window.removeEventListener('showCrewNotice', onShowNotice);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
  }, [game, refreshDbToState]);

  useEffect(() => {
    const onLore = (e: Event) => {
      const ce = e as CustomEvent<{ segmentId?: string }>;
      const id = ce.detail?.segmentId;
      const body = id ? RAID_LORE_BY_SEGMENT[id] : undefined;
      if (body) setLoreTerminalText(body);
    };
    window.addEventListener('raidLorePing', onLore as EventListener);
    return () => window.removeEventListener('raidLorePing', onLore as EventListener);
  }, []);

  useEffect(() => {
    if (!loreTerminalText) return;
    const t = window.setTimeout(() => setLoreTerminalText(null), 14000);
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLoreTerminalText(null);
    };
    window.addEventListener('keydown', onEsc);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onEsc);
    };
  }, [loreTerminalText]);

  useEffect(() => {
    const onGadget = () => setToast('Concussive pulse · hostiles slowed in radius.');
    const onLoot = (e: Event) => {
      const ce = e as CustomEvent<{ itemId?: string; quantity?: number; isObjective?: boolean }>;
      const id = ce.detail?.itemId;
      if (!id) return;
      const qty = Math.max(1, ce.detail?.quantity ?? 1);
      const label = formatItemId(id);
      if (ce.detail?.isObjective || id === 'survey_drive') {
        setToast(`Objective secured · ${label} in pack. Extract via green to bank.`);
      } else {
        setToast(`Looted ${label} ×${qty} · forfeit on death until you green-extract.`);
      }
    };
    const onExtract = (e: Event) => {
      const ce = e as CustomEvent<{ paidContractTitle?: string | null; paidContractReward?: number; itemCount?: number }>;
      const title = ce.detail?.paidContractTitle ?? null;
      const reward = ce.detail?.paidContractReward ?? 0;
      if (title) {
        setToast(`Contract complete · ${title} · +¤ ${reward.toLocaleString()}.`);
      } else {
        const items = ce.detail?.itemCount ?? 0;
        setToast(items > 0 ? `Extracted to ship · ${items} stack${items === 1 ? '' : 's'} banked to stash.` : 'Extracted to ship · empty pack.');
      }
    };
    const onDeath = () => setToast('Raid failed · backpack forfeited. Restage in ship ops.');
    const onEngineToast = (e: Event) => {
      const ce = e as CustomEvent<{ message?: string }>;
      if (ce.detail?.message) setToast(ce.detail.message);
    };
    window.addEventListener('raidGadgetDeployed', onGadget);
    window.addEventListener('raidLootPicked', onLoot as EventListener);
    window.addEventListener('raidExtractComplete', onExtract as EventListener);
    window.addEventListener('raidPlayerDeath', onDeath);
    window.addEventListener('toast', onEngineToast as EventListener);
    return () => {
      window.removeEventListener('raidGadgetDeployed', onGadget);
      window.removeEventListener('raidLootPicked', onLoot as EventListener);
      window.removeEventListener('raidExtractComplete', onExtract as EventListener);
      window.removeEventListener('raidPlayerDeath', onDeath);
      window.removeEventListener('toast', onEngineToast as EventListener);
    };
  }, []);

  useEffect(() => {
    if (gameState !== GameState.SHIP) return;
    void refreshDbToState();
  }, [gameState, refreshDbToState]);

  useEffect(() => {
    if (!isShipUIOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsShipUIOpen(false);
        game.canvas?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isShipUIOpen, game]);

  useEffect(() => {
    if (!openMerchantId && !noticeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMerchantId(null);
        setNoticeOpen(false);
        game.canvas?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openMerchantId, noticeOpen, game]);

  useEffect(() => {
    const hitMarkerTimer = { id: 0 };
    const onHit = () => {
      setHitMarker(true);
      clearTimeout(hitMarkerTimer.id);
      hitMarkerTimer.id = window.setTimeout(() => setHitMarker(false), 140);
    };
    window.addEventListener('enemyHit', onHit);
    return () => {
      window.removeEventListener('enemyHit', onHit);
      clearTimeout(hitMarkerTimer.id);
    };
  }, []);

  useEffect(() => {
    const onDeath = () => setRaidFailed(true);
    window.addEventListener('raidPlayerDeath', onDeath);
    return () => window.removeEventListener('raidPlayerDeath', onDeath);
  }, []);

  useEffect(() => {
    let vignetteTimer = 0;
    const onPlayerHit = (e: Event) => {
      const { healthPct } = (e as CustomEvent).detail ?? {};
      const intensity = healthPct < 0.25 ? 0.85 : healthPct < 0.5 ? 0.55 : 0.35;
      setDamageVignette(intensity);
      clearTimeout(vignetteTimer);
      vignetteTimer = window.setTimeout(() => setDamageVignette(0), 350);
    };
    window.addEventListener('playerHit', onPlayerHit);
    return () => {
      window.removeEventListener('playerHit', onPlayerHit);
      clearTimeout(vignetteTimer);
    };
  }, []);

  // Clear the death overlay once the scene returns to ship
  useEffect(() => {
    if (gameState === GameState.SHIP) setRaidFailed(false);
  }, [gameState]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const stashJunkQuantity = stash.reduce((sum, i) => {
    if (JUNK_ITEM_IDS.has(i.itemId)) return sum + i.quantity;
    return sum;
  }, 0);

  const sellJunk = async () => {
    let totalEarned = 0;

    await db.transaction('rw', db.stashItems, db.playerProfile, async () => {
      const items = await db.stashItems.toArray();
      const profile = await db.playerProfile.toCollection().first();
      if (!profile) return;

      for (const item of items) {
        if (item.slot === 'stash' && JUNK_ITEM_IDS.has(item.itemId)) {
          totalEarned += lootTradeInCredits(item.itemId) * item.quantity;
          await db.stashItems.delete(item.id!);
        }
      }

      if (totalEarned > 0) {
        await db.playerProfile.update(profile.id!, { money: profile.money + totalEarned });
      }
    });

    await refreshDbToState();
    setToast(
      totalEarned > 0
        ? `Sold junk for ¤ ${totalEarned.toLocaleString()}.`
        : 'No scrap or copper wire in stash to sell.'
    );
  };

  const buyItem = async (itemId: string, cost: number, quantity: number = 1) => {
    let success = false;
    await db.transaction('rw', db.stashItems, db.playerProfile, async () => {
      const profile = await db.playerProfile.toCollection().first();
      if (!profile || profile.money < cost) return;

      await db.playerProfile.update(profile.id!, { money: profile.money - cost });

      const existing = await db.stashItems
        .where('itemId')
        .equals(itemId)
        .filter((s) => s.slot === 'stash')
        .first();
      if (existing) {
        await db.stashItems.update(existing.id!, { quantity: existing.quantity + quantity });
      } else {
        await db.stashItems.add({ itemId, quantity, slot: 'stash' });
      }
      success = true;
    });

    if (success) {
      await refreshDbToState();
      const label = getLootDefinition(itemId)?.name ?? itemId.replace(/_/g, ' ');
      setToast(`Purchased ${label} (${quantity}×) · check stash.`);
    }
  };

  const buyUpgrade = async (offer: UpgradeOffer, completedContractCount: number) => {
    if (!isUpgradeUnlocked(completedContractCount, offer)) {
      setToast(`Locked · clear ${offer.unlockAfterCompleted} contract${offer.unlockAfterCompleted === 1 ? '' : 's'} first.`);
      return;
    }

    let outcome = 'missing_profile';
    let nextLevel = 0;

    await db.transaction('rw', db.playerProfile, async () => {
      const profile = await db.playerProfile.toCollection().first();
      if (!profile) return;

      const upgrades = normalizeUpgradeState(profile);
      const currentLevel = getUpgradeLevel(upgrades, offer.id);
      if (currentLevel >= offer.maxLevel) {
        outcome = 'maxed';
        return;
      }
      if (profile.money < offer.cost) {
        outcome = 'insufficient';
        return;
      }

      nextLevel = currentLevel + 1;
      const patch: Partial<PlayerProfile> = {
        money: profile.money - offer.cost,
        [offer.id]: nextLevel,
      };
      await db.playerProfile.update(profile.id!, patch);
      outcome = 'purchased';
    });

    await refreshDbToState();

    if (outcome === 'purchased') {
      setToast(`Installed ${offer.label} · Lv ${nextLevel}/${offer.maxLevel}.`);
    } else if (outcome === 'maxed') {
      setToast(`${offer.label} already at max level.`);
    } else if (outcome === 'insufficient') {
      setToast(`Not enough credits for ${offer.label}.`);
    }
  };

  const changeSuitClass = async (sc: string) => {
    await db.transaction('rw', db.playerProfile, async () => {
      const profile = await db.playerProfile.toCollection().first();
      if (!profile) return;
      await db.playerProfile.update(profile.id!, { suitClass: sc as any });
    });
    setSuitClass(sc);
    setToast(`Suit reconfigured to ${sc.replace(/_/g, ' ')} protocol.`);
  };

  const stageItemToLoadout = async (item: StashItem) => {
    if (item.id === undefined) return;
    const itemId = item.id;

    const swappedPrimaryNames: string[] = [];
    await db.transaction('rw', db.stashItems, async () => {
      if (isPrimaryWeaponItemId(item.itemId)) {
        const allItems = await db.stashItems.toArray();
        const swapIds = getLoadoutPrimarySwapIds(allItems, itemId);
        for (const swapId of swapIds) {
          const swapItem = allItems.find((row) => row.id === swapId);
          if (swapItem) swappedPrimaryNames.push(formatItemId(swapItem.itemId));
          await db.stashItems.update(swapId, { slot: 'stash' });
        }
      }

      await db.stashItems.update(itemId, { slot: 'loadout' });
    });

    await refreshDbToState();

    const label = formatItemId(item.itemId);
    if (swappedPrimaryNames.length === 1) {
      setToast(`Staged ${label} · ${swappedPrimaryNames[0]} returned to stash.`);
      return;
    }
    if (swappedPrimaryNames.length > 1) {
      setToast(`Staged ${label} · previous primaries returned to stash.`);
      return;
    }
    setToast(`Staged ${label} in loadout.`);
  };

  const inFirstPerson =
    (gameState === GameState.SHIP || gameState === GameState.STATION || gameState === GameState.MOON_BASE || gameState === GameState.PLANET) &&
    !isShipUIOpen &&
    openMerchantId === null &&
    !noticeOpen;
  const showPointerHint = inFirstPerson && !pointerLocked;
  const healthPct = health.max > 0 ? Math.min(100, (health.current / health.max) * 100) : 0;
  const batteryPct = battery.max > 0 ? Math.min(100, (battery.current / battery.max) * 100) : 0;
  const staminaPct = stamina.max > 0 ? Math.min(100, (stamina.current / stamina.max) * 100) : 0;
  const ammoLow = ammo.max > 0 && ammo.current <= Math.max(1, Math.floor(ammo.max * 0.2));
  const healthLow = healthPct < 28;
  const batteryLow = battery.max > 0 && batteryPct <= 22;
  const batteryCritical = battery.max > 0 && batteryPct < 10;
  const staminaLow = staminaPct < 20;
  const statusPanelOutline =
    healthLow ? '1px solid rgba(251, 113, 133, 0.38)' : batteryLow ? '1px solid rgba(251, 191, 36, 0.32)' : undefined;
  const batteryBarColor =
    batteryLow ?
      'linear-gradient(90deg, #fcd34d, #d97706)'
    : 'linear-gradient(90deg, #38bdf8, #0ea5e9)';

  const healthBarColor =
    healthPct > 55 ? 'linear-gradient(90deg, #34d399, #10b981)' : healthPct > 28 ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' : 'linear-gradient(90deg, #fb7185, #ef4444)';

  const staminaBarColor = staminaLow
    ? 'linear-gradient(90deg, #f97316, #ea580c)'
    : 'linear-gradient(90deg, #a3e635, #65a30d)';

  const completedContracts = contracts.filter((c) => c.isCompleted);
  const completedContractCount = completedContracts.length;
  const canDockFromHub = hubDockingAllowed(contracts, activeContractId);
  const activeRaidContract = contracts.find((c) => c.isActive && !c.isCompleted);
  const armoryUpgradeOffers = ARMORY_UPGRADE_OFFERS.map((offer) => {
    const level = getUpgradeLevel(profileUpgrades, offer.id);
    const unlocked = isUpgradeUnlocked(completedContractCount, offer);
    return { ...offer, level, unlocked };
  });
  // Determine which airlocks are available based on the active contract's zone
  const activeContractDeployZone = activeRaidContract ? getContractDeployZone(activeRaidContract.title) : null;
  const canDockStation = canDockFromHub && activeContractDeployZone !== 'planet';
  const canDeployPlanet = canDockFromHub && activeContractDeployZone === 'planet';
  const raidContractZone =
    gameState === GameState.STATION ? 'station' : gameState === GameState.MOON_BASE ? 'moon' : gameState === GameState.PLANET ? 'planet' : null;
  const raidProgressLine = activeRaidContract
    ? contractProgressSummary(activeRaidContract.title, inventory, stationRaidKills, game)
    : null;

  const medkitQty = inventory.reduce((n, i) => n + (i.itemId === 'medkit' ? i.quantity : 0), 0);
  const bandageQty = inventory.reduce((n, i) => n + (i.itemId === 'bandage' ? i.quantity : 0), 0);
  const medkitReadyFillPct =
    medkitCooldownMs <= 0
      ? 100
      : Math.min(100, ((RAID_MEDKIT_COOLDOWN_MS - medkitCooldownMs) / RAID_MEDKIT_COOLDOWN_MS) * 100);
  const bandageReadyFillPct =
    bandageCooldownMs <= 0
      ? 100
      : Math.min(100, ((RAID_BANDAGE_COOLDOWN_MS - bandageCooldownMs) / RAID_BANDAGE_COOLDOWN_MS) * 100);

  const gadgetReadyFillPct =
    gadgetCooldownMs <= 0
      ? 100
      : Math.min(100, ((RAID_GADGET_COOLDOWN_MS - gadgetCooldownMs) / RAID_GADGET_COOLDOWN_MS) * 100);

  const safePad = {
    paddingLeft: 'max(24px, env(safe-area-inset-left))',
    paddingRight: 'max(24px, env(safe-area-inset-right))',
    paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
    paddingTop: 'max(24px, env(safe-area-inset-top))',
  };

  // ── NEW CAMPAIGN handler ────────────────────────────────────────────────────
  const handleNewCampaign = async () => {
    await db.transaction('rw', db.playerProfile, db.stashItems, db.contracts, async () => {
      await db.playerProfile.clear();
      await db.stashItems.clear();
      await db.contracts.clear();
    });
    await db.initializeDefault();
    await refreshDbToState();
    await checkSaveData();
    game.startGame();
  };

  const handleResume = async () => {
    await refreshDbToState();
    game.startGame();
  };

  return (
    <div
      className="ui-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        color: '#e8edf5',
        fontFamily: fontUi,
        fontSize: 14,
        lineHeight: 1.45,
      }}
    >
      {/* ── DAMAGE VIGNETTE ─────────────────────────────────────────────── */}
      {damageVignette > 0 && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 90,
            pointerEvents: 'none',
            background: `radial-gradient(ellipse at center, transparent 35%, rgba(220, 20, 20, ${damageVignette.toFixed(2)}) 100%)`,
            transition: 'opacity 0.1s ease',
          }}
        />
      )}

      {/* ── TITLE SCREEN ────────────────────────────────────────────────── */}
      {gameState === GameState.START_MENU && (
        <div
          role="main"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(ellipse at 50% 60%, rgba(10,18,35,1) 0%, rgba(2,4,10,1) 100%)',
            pointerEvents: 'auto',
            overflow: 'hidden',
          }}
        >
          {/* Starfield / Particles */}
          <div style={{ position: 'absolute', inset: 0, opacity: 0.4, zIndex: 0 }} className="ui-drift">
            <div style={{ position: 'absolute', width: 2, height: 2, background: '#fff', borderRadius: '50%', top: '20%', left: '30%', boxShadow: '0 0 10px #fff' }} />
            <div style={{ position: 'absolute', width: 1, height: 1, background: '#fff', borderRadius: '50%', top: '45%', left: '70%' }} />
            <div style={{ position: 'absolute', width: 3, height: 3, background: '#38bdf8', borderRadius: '50%', top: '80%', left: '20%', opacity: 0.6, boxShadow: '0 0 15px #38bdf8' }} />
            <div style={{ position: 'absolute', width: 1, height: 1, background: '#fff', borderRadius: '50%', top: '15%', left: '85%' }} />
            <div style={{ position: 'absolute', width: 2, height: 2, background: '#fff', borderRadius: '50%', top: '65%', left: '15%' }} />
          </div>

          {/* Scanline overlay */}
          <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)', pointerEvents: 'none', zIndex: 1 }} />
          {/* Heavy Vignette */}
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 30%, rgba(2,6,14,0.95) 100%)', pointerEvents: 'none', zIndex: 1 }} />

          <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 580, padding: '0 24px' }}>
            {/* Eyebrow */}
            <div style={{ fontSize: 11, letterSpacing: '0.36em', fontWeight: 700, color: 'rgba(125, 185, 255, 0.65)', marginBottom: 20, textTransform: 'uppercase' as const }}>
              ICV RELENTLESS · MERIDIAN-CLASS FREIGHTER
            </div>

            {/* Game title */}
            <h1 style={{
              margin: '0 0 10px 0',
              fontSize: 'clamp(3rem, 10vw, 6rem)',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              background: 'linear-gradient(135deg, #e8f4ff 0%, #94c8ff 40%, #4898e8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: 'none',
              filter: 'drop-shadow(0 0 40px rgba(80, 160, 255, 0.4))',
            }}>
              VOID SOVEREIGNS
            </h1>

            <p style={{ margin: '0 0 48px 0', fontSize: 16, lineHeight: 1.65, color: 'rgba(175, 200, 235, 0.78)', fontWeight: 400, letterSpacing: '0.01em' }}>
              The derelict stack drifts at the edge of the transit corridor. Someone left data behind.
              <br />
              <span style={{ color: 'rgba(130, 165, 210, 0.6)', fontSize: 14 }}>Board. Extract. Get paid. Don't die.</span>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', alignItems: 'center' }}>
              {hasSaveData && (
                <div className="ui-bracket" style={{ padding: 2 }}>
                  <button
                    type="button"
                    onClick={handleResume}
                    className="ui-fade-in"
                    style={{
                      padding: '16px 52px',
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      background: 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      boxShadow: '0 8px 32px rgba(2, 132, 199, 0.4)',
                      width: 320,
                      fontFamily: fontUi,
                    }}
                  >
                    RESUME EXPEDITION
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (hasSaveData) {
                    setShowNewGameConfirm(true);
                  } else {
                    void handleNewCampaign();
                  }
                }}
                style={{
                  padding: '14px 52px',
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  background: hasSaveData ? 'rgba(30, 41, 59, 0.65)' : 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)',
                  color: hasSaveData ? 'rgba(186, 230, 253, 0.9)' : '#fff',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  boxShadow: hasSaveData ? 'none' : '0 8px 32px rgba(2, 132, 199, 0.4)',
                  width: 320,
                  transition: 'all 0.2s ease',
                  fontFamily: fontUi,
                }}
              >
                {hasSaveData ? 'START NEW GAME' : 'BEGIN EXPEDITION'}
              </button>

              <div style={{ marginTop: 20, fontSize: 10, color: 'rgba(130, 165, 210, 0.35)', letterSpacing: '0.15em', fontWeight: 600 }}>
                BUILD 0.2.4-BETA · CRYPTOGRAPHIC LINK SECURE
              </div>
            </div>

            {/* Confirmation Dialog for New Game */}
            {showNewGameConfirm && (
              <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2, 6, 14, 0.92)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 200,
              }}>
                <div className="ui-panel ui-fade-in" style={{ padding: 48, textAlign: 'center', maxWidth: 460, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <div style={{ color: '#ef4444', fontSize: 10, fontWeight: 800, letterSpacing: '0.3em', marginBottom: 16 }}>⚠ CRITICAL SYSTEM OVERWRITE</div>
                  <h2 style={{ margin: '0 0 16px 0', fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>ERASE ALL PROGRESS?</h2>
                  <p style={{ margin: '0 0 32px 0', fontSize: 14, color: 'rgba(160, 175, 200, 0.85)', lineHeight: 1.6 }}>
                    Confirmed: Starting a new expedition will <span style={{ color: '#fff', fontWeight: 700 }}>permanently purge</span> all stash items, mission history, and character reputation.
                  </p>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <button
                      onClick={() => setShowNewGameConfirm(false)}
                      style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                    >
                      ABORT
                    </button>
                    <button
                      onClick={() => {
                        setShowNewGameConfirm(false);
                        void handleNewCampaign();
                      }}
                      style={{ flex: 1, padding: '14px', background: 'linear-gradient(180deg, #ef4444, #991b1b)', border: 'none', color: '#fff', fontWeight: 700, borderRadius: 6, cursor: 'pointer', fontSize: 13, boxShadow: '0 4px 20px rgba(239, 68, 68, 0.3)' }}
                    >
                      PURGE & RESTART
                    </button>
                  </div>
                </div>
              </div>
            )}

            <p style={{ marginTop: 28, fontSize: 11, color: 'rgba(120, 145, 175, 0.55)', letterSpacing: '0.06em' }}>
              WASD MOVE · MOUSE LOOK · E INTERACT · R RELOAD · F FLASHLIGHT · H MEDKIT · G GADGET
            </p>
          </div>
        </div>
      )}

      {/* ── RESULTS / VICTORY SCREEN ─────────────────────────────────────── */}
      {gameState === GameState.RESULTS && (
        <div
          role="main"
          aria-label="Mission results"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(ellipse at 50% 40%, rgba(5,20,10,1) 0%, rgba(2,4,8,1) 100%)',
            pointerEvents: 'auto',
          }}
        >
          <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.14) 2px, rgba(0,0,0,0.14) 4px)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 560, padding: '0 24px' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.36em', fontWeight: 700, color: 'rgba(100, 220, 130, 0.65)', marginBottom: 16 }}>
              ALL CONTRACTS SETTLED
            </div>
            <h1 style={{
              margin: '0 0 8px 0',
              fontSize: 'clamp(2.5rem, 8vw, 5rem)',
              fontWeight: 900,
              letterSpacing: '-0.01em',
              background: 'linear-gradient(135deg, #d4ffd4 0%, #5efa8a 50%, #22c55e 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 30px rgba(60, 220, 100, 0.4))',
            }}>
              MISSION COMPLETE
            </h1>
            <p style={{ margin: '0 0 32px 0', fontSize: 14, color: 'rgba(175, 220, 190, 0.75)', lineHeight: 1.6 }}>
              Every contract cleared. The freighter extracts clean.<br />
              <span style={{ fontFamily: fontMono, color: '#4ade80' }}>Credits transferred. Reputation: ESTABLISHED.</span>
            </p>

            {/* Contract summary */}
            <div style={{ ...panelBase, padding: '20px 28px', marginBottom: 32, textAlign: 'left' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(130, 185, 150, 0.65)', marginBottom: 14, fontWeight: 700 }}>DEBRIEF</div>
              {contracts.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                  <span style={{ color: 'rgba(200, 230, 210, 0.9)' }}>{c.title}</span>
                  <span style={{ fontFamily: fontMono, color: '#4ade80', fontSize: 12 }}>¤ {c.reward.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 14, fontWeight: 700 }}>
                <span style={{ color: 'rgba(200, 230, 210, 0.8)' }}>TOTAL EARNED</span>
                <span style={{ fontFamily: fontMono, color: '#86efac' }}>¤ {contracts.reduce((s, c) => s + c.reward, 0).toLocaleString()}</span>
              </div>
            </div>

            <button
              id="btn-new-campaign"
              type="button"
              onClick={handleNewCampaign}
              style={{
                padding: '14px 44px',
                fontSize: 14,
                fontFamily: fontUi,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                cursor: 'pointer',
                background: 'linear-gradient(135deg, rgba(15, 50, 25, 0.95), rgba(10, 35, 18, 0.95))',
                color: '#86efac',
                border: '1px solid rgba(74, 222, 128, 0.35)',
                borderRadius: 8,
                boxShadow: '0 0 28px rgba(34, 197, 94, 0.2)',
              }}
            >
              New Campaign
            </button>
          </div>
        </div>
      )}

      {/* Low-health screen vignette */}
      {healthLow && inFirstPerson && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 2,
            background: 'radial-gradient(ellipse at center, transparent 52%, rgba(220, 20, 40, 0.38) 100%)',
            animation: 'pulse-vignette 1.2s ease-in-out infinite',
          }}
        />
      )}

      {/* Raid-failed death overlay */}
      {raidFailed && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 4, 6, 0.82)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 'clamp(2rem, 6vw, 4rem)', fontWeight: 800, letterSpacing: '0.12em', color: '#ef4444', textShadow: '0 0 40px rgba(239,68,68,0.55)' }} className="glitch-effect">
            RAID FAILED
          </div>
          <div style={{ marginTop: 14, fontSize: 14, color: 'rgba(200,210,225,0.82)', letterSpacing: '0.06em' }}>
            Backpack forfeited · returning to ship…
          </div>
        </div>
      )}
      {toast && (
        <div className="ui-toast" role="status" aria-live="polite" style={{ zIndex: 24, pointerEvents: 'none' }}>
          <div style={{ ...panelBase, padding: '12px 22px', color: '#e8eef8', fontSize: 13, textAlign: 'center' }}>{toast}</div>
        </div>
      )}

      {(gameState === GameState.STATION || gameState === GameState.MOON_BASE || gameState === GameState.PLANET) && environmentalSurge && (
        <div
          style={{
            position: 'absolute',
            top: safePad.paddingTop,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 23,
            pointerEvents: 'none',
            ...panelBase,
            padding: '8px 20px',
            fontSize: 11,
            letterSpacing: '0.14em',
            fontWeight: 650,
            color: '#fecaca',
            borderColor: 'rgba(248, 113, 113, 0.35)',
          }}
        >
          GRID SURGE · LIGHTS COMPRESSED · HOSTILES HOT
        </div>
      )}

      {loreTerminalText && (
        <>
          <div
            aria-hidden
            onClick={() => setLoreTerminalText(null)}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 25,
              background: 'rgba(2, 4, 10, 0.62)',
              pointerEvents: 'auto',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="raid-lore-heading"
            aria-live="polite"
            style={{
              position: 'absolute',
              bottom: 'max(120px, calc(env(safe-area-inset-bottom, 0px) + 96px))',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 26,
              pointerEvents: 'auto',
              maxWidth: 'min(520px, calc(100vw - 40px))',
            }}
          >
            <div style={{ ...panelBase, padding: '16px 18px' }}>
              <h2 id="raid-lore-heading" style={{ margin: '0 0 10px 0', ...hud.sectionEyebrow('contract') }}>
                TERMINAL
              </h2>
              <p style={{ margin: '0 0 12px 0', fontSize: 13, lineHeight: 1.55, color: 'rgba(210, 220, 235, 0.94)' }}>
                {loreTerminalText}
              </p>
              <button
                type="button"
                onClick={() => setLoreTerminalText(null)}
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  fontFamily: fontUi,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: 'rgba(55, 65, 85, 0.95)',
                  color: '#e8edf5',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                }}
              >
                Close <span style={{ fontFamily: fontMono, color: 'rgba(165, 190, 220, 0.85)', fontWeight: 500 }}>Esc</span>
              </button>
            </div>
          </div>
        </>
      )}

      {gameState === GameState.SHIP && !isShipUIOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: safePad.paddingBottom,
            left: safePad.paddingLeft,
            maxWidth: 400,
            pointerEvents: 'none',
            ...panelBase,
            padding: '14px 18px',
            zIndex: 8,
          }}
        >
          <div style={{ marginBottom: 8, ...hud.sectionEyebrow('hub') }}>ICV RELENTLESS — FREIGHTER HUB</div>
          <p style={{ margin: '0 0 8px 0', fontSize: 13, lineHeight: 1.55, color: 'rgba(200, 215, 235, 0.92)' }}>
            Head to the bridge and aim at the <strong style={{ fontWeight: 650 }}>operations console</strong> (cyan screen), then press{' '}
            <span style={{ fontFamily: fontMono, color: '#a5d8ff' }}>E</span> — stash, loadout, contracts, armory, and deployment.
          </p>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'rgba(155, 175, 205, 0.82)' }}>
            Three mission zones: <strong>Abandoned Station</strong> (Airlock Alpha · port) ·{' '}
            <strong>Moon Base</strong> (via station lift) · <strong>Planet Outpost</strong> (Airlock Beta · starboard).
            Flashlight batteries recharge aboard.
          </p>
        </div>
      )}

      {activeRaidContract && raidContractZone && (
        <div
          style={{
            position: 'absolute',
            top: safePad.paddingTop,
            right: safePad.paddingRight,
            maxWidth: 'min(360px, calc(100vw - 48px))',
            pointerEvents: 'none',
            zIndex: 7,
            ...panelBase,
            padding: '14px 18px',
          }}
        >
          <div style={{ marginBottom: 6, ...hud.sectionEyebrow('contract') }}>ACTIVE CONTRACT</div>
          <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 6 }}>{activeRaidContract.title}</div>
          <div style={{ fontSize: 11, fontFamily: fontMono, color: '#fde68a', marginBottom: 10 }}>¤ {activeRaidContract.reward.toLocaleString()}</div>
          <p style={{ margin: '0 0 10px 0', fontSize: 12, lineHeight: 1.55, color: 'rgba(195, 210, 235, 0.88)' }}>
            {getContractRaidHint(activeRaidContract.title, raidContractZone)}
          </p>
          {raidProgressLine && (
            <p
              style={{
                margin: 0,
                fontSize: 11,
                lineHeight: 1.45,
                color: 'rgba(145, 200, 255, 0.88)',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: 10,
              }}
            >
              {raidProgressLine}
            </p>
          )}
        </div>
      )}

      {showPointerHint && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          <div
            style={{
              ...panelBase,
              pointerEvents: 'none',
              padding: '16px 32px',
              maxWidth: 360,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 650, letterSpacing: '0.02em', color: 'rgba(240, 246, 255, 0.97)', marginBottom: 6 }}>
              Click to play
            </div>
            <div style={{ fontSize: 13, fontWeight: 450, color: 'rgba(170, 190, 220, 0.88)', lineHeight: 1.5 }}>
              {gameState === GameState.SHIP ? (
                <>
                  Locks the cursor for look and movement. On the bridge, <span style={{ fontFamily: fontMono }}>Esc</span> closes ship
                  ops if open.
                </>
              ) : (
                <>
                  Locks the cursor for look, fire, and reload. <span style={{ fontFamily: fontMono }}>Esc</span> closes ship ops,
                  lore terminals, and other overlays.
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {inFirstPerson && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              position: 'relative',
              opacity: pointerLocked ? 0.85 : 0.35,
              transition: 'opacity 0.2s ease',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                bottom: 0,
                width: 2,
                marginLeft: -1,
                background: 'rgba(255,255,255,0.9)',
                boxShadow: '0 0 6px rgba(0,0,0,0.5)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: 2,
                marginTop: -1,
                background: 'rgba(255,255,255,0.9)',
                boxShadow: '0 0 6px rgba(0,0,0,0.5)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: hitMarker ? 8 : 4,
                height: hitMarker ? 8 : 4,
                marginLeft: hitMarker ? -4 : -2,
                marginTop: hitMarker ? -4 : -2,
                borderRadius: '50%',
                background:
                  hitMarker ? '#ff3b3b' : healthLow ? '#fb7185' : batteryCritical && !healthLow ? '#fcd34d' : 'rgba(255,255,255,0.95)',
                boxShadow: hitMarker ? '0 0 8px rgba(255,60,60,0.8)' : '0 0 4px rgba(0,0,0,0.4)',
                transition: 'width 0.06s ease, height 0.06s ease, background 0.06s ease, box-shadow 0.06s ease',
              }}
            />
          </div>
          {hoveredTarget && (
            <div
              style={{
                ...panelBase,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 500,
                border: '1px solid rgba(120, 200, 255, 0.25)',
                whiteSpace: 'nowrap',
                letterSpacing: '0.03em',
                textTransform: 'uppercase' as const,
              }}
            >
              <span style={{ color: 'rgba(150, 200, 255, 0.85)', marginRight: 10, fontFamily: fontMono }}>E</span>
              {humanizeHudTarget(hoveredTarget)}
            </div>
          )}
        </div>
      )}

      {(gameState === GameState.STATION || gameState === GameState.MOON_BASE || gameState === GameState.PLANET) && (
        <div
          style={{
            position: 'absolute',
            bottom: safePad.paddingBottom,
            left: safePad.paddingLeft,
            pointerEvents: 'auto',
            maxWidth: 'min(300px, calc(100vw - 48px))',
          }}
        >
          <div className="ui-bracket ui-panel ui-fade-in" style={{ padding: '14px 18px', marginBottom: 12, border: '1px solid rgba(56, 189, 248, 0.15)' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.015) 1px, rgba(255,255,255,0.015) 2px)', pointerEvents: 'none' }} />
            <h2 style={{ margin: '0 0 8px 0', ...hud.label(), fontSize: 10, letterSpacing: '0.25em', color: '#38bdf8' }}>
              STORAGE / BACKPACK
            </h2>
            {inventory.length === 0 ? (
              <p style={{ margin: 0, color: 'rgba(140,155,175,0.45)', fontSize: 11, fontStyle: 'italic' }}>
                Empty — loot secured on extract.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
                {inventory.map((item, idx) => (
                  <li key={`${item.itemId}-${idx}`} style={{ fontSize: 12, color: lootColorForItemId(item.itemId), fontWeight: 500 }}>
                    {formatItemId(item.itemId).toUpperCase()}{' '}
                    <span style={{ fontFamily: fontMono, color: 'rgba(180, 200, 230, 0.65)', fontSize: 11 }}>[{item.quantity}]</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div
            className="ui-panel ui-bracket ui-fade-in"
            style={{
              padding: '16px 20px',
              border: '1px solid rgba(56, 189, 248, 0.15)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(56, 189, 248, 0.02) 1px, rgba(56, 189, 248, 0.02) 2px)', pointerEvents: 'none' }} />
            
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ ...hud.sectionEyebrow('suit'), color: '#38bdf8', fontSize: 9 }}>
                SUIT-LINK // <span style={{ color: '#fff', fontWeight: 800 }}>{suitClass.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 8, color: 'rgba(56, 189, 248, 0.4)', fontFamily: fontMono, letterSpacing: '0.1em' }}>
                BIO_MONITOR_ACTIVE
              </div>
            </div>

            {/* Health Bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', color: '#94a3b8' }}>VITALS</span>
                <span style={{ fontFamily: fontMono, fontSize: 13, fontWeight: 700, color: healthLow ? '#ef4444' : '#fff' }}>
                  {Math.round(health.current)}%
                </span>
              </div>
              <div style={{ height: 8, background: 'rgba(0,0,0,0.4)', borderRadius: 1, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ 
                  width: `${healthPct}%`, 
                  height: '100%', 
                  background: `repeating-linear-gradient(90deg, ${healthBarColor}, ${healthBarColor} 4px, transparent 4px, transparent 5px)`, 
                  transition: 'width 0.2s ease-out' 
                }} />
              </div>
            </div>

            {/* Stamina Bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', color: '#94a3b8' }}>KINETIC</span>
                <span style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 700, color: staminaLow ? '#fb923c' : '#7dd3fc' }}>
                  {Math.round(stamina.current)}
                </span>
              </div>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.4)', borderRadius: 1, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ 
                  width: `${staminaPct}%`, 
                  height: '100%', 
                  background: `repeating-linear-gradient(90deg, ${staminaBarColor}, ${staminaBarColor} 4px, transparent 4px, transparent 5px)`, 
                  transition: 'width 0.15s linear' 
                }} />
              </div>
            </div>

            {/* Ammo Display */}
            <div style={{ 
              marginTop: 18, 
              paddingTop: 12, 
              borderTop: '1px solid rgba(56, 189, 248, 0.1)',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}>
              <div>
                <div style={{ fontSize: 8, fontWeight: 800, color: '#94a3b8', marginBottom: 2 }}>MUNITIONS</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{formatItemId(equippedWeaponItemId).toUpperCase()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ 
                  fontFamily: fontMono, 
                  fontSize: 28, 
                  fontWeight: 800, 
                  color: reloading ? '#fbbf24' : ammoLow ? '#ef4444' : '#fff',
                  lineHeight: 1
                }}>
                  {reloading ? '...' : ammo.current}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(148, 163, 184, 0.6)', fontFamily: fontMono, marginLeft: 4 }}>
                  / {ammo.reserve}
                </span>
              </div>
            </div>
          </div>
            <div style={{ marginTop: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'rgba(160, 175, 195, 0.9)' }}>Medkit</span>
                <span style={{ fontFamily: fontMono, fontSize: 13, color: 'rgba(190, 230, 200, 0.92)' }}>
                  ×{medkitQty}
                  {medkitCooldownMs > 0 ? (
                    <span style={{ color: '#fcd34d', marginLeft: 8 }}>{(medkitCooldownMs / 1000).toFixed(1)}s</span>
                  ) : (
                    <span style={{ color: 'rgba(130, 175, 145, 0.75)', marginLeft: 8, fontSize: 11 }}>ready</span>
                  )}
                </span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: 'rgba(0,0,0,0.35)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${medkitReadyFillPct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #34d399, #059669)',
                    borderRadius: 2,
                    transition: 'width 0.12s linear',
                  }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'rgba(160, 175, 195, 0.9)' }}>Bandage</span>
                <span style={{ fontFamily: fontMono, fontSize: 13, color: 'rgba(190, 230, 200, 0.92)' }}>
                  ×{bandageQty}
                  {bandageCooldownMs > 0 ? (
                    <span style={{ color: '#fcd34d', marginLeft: 8 }}>{(bandageCooldownMs / 1000).toFixed(1)}s</span>
                  ) : (
                    <span style={{ color: 'rgba(130, 175, 145, 0.75)', marginLeft: 8, fontSize: 11 }}>ready</span>
                  )}
                </span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: 'rgba(0,0,0,0.35)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${bandageReadyFillPct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #6ee7b7, #059669)',
                    borderRadius: 2,
                    transition: 'width 0.12s linear',
                  }}
                />
              </div>
            </div>
            <div style={{ marginTop: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'rgba(160, 175, 195, 0.9)' }}>
                  {(() => {
                    const g = inventory.find(i => GADGET_ARCHETYPES[i.itemId as GadgetItemId]);
                    return g ? formatItemId(g.itemId) : 'Gadget';
                  })()}
                </span>
                <span style={{ fontFamily: fontMono, fontSize: 13, color: 'rgba(180, 210, 255, 0.95)' }}>
                  {gadgetCooldownMs > 0 ? (
                    <span style={{ color: '#93c5fd' }}>{(gadgetCooldownMs / 1000).toFixed(1)}s</span>
                  ) : (
                    <span style={{ color: 'rgba(130, 165, 210, 0.75)', fontSize: 11 }}>ready</span>
                  )}
                </span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: 'rgba(0,0,0,0.35)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${gadgetReadyFillPct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #60a5fa, #2563eb)',
                    borderRadius: 2,
                    transition: 'width 0.12s linear',
                  }}
                />
              </div>
            </div>
            <p style={{ margin: '12px 0 0 0', fontSize: 11, lineHeight: 1.6, color: 'rgba(130, 145, 165, 0.88)', wordSpacing: '-0.02em' }}>
              Move <span style={{ fontFamily: fontMono, color: 'rgba(155,175,205,0.95)' }}>WASD</span> · Sprint{' '}
              <span style={{ fontFamily: fontMono }}>Shift</span> · Jump <span style={{ fontFamily: fontMono }}>Space</span> · Fire mouse ·{' '}
              <span style={{ fontFamily: fontMono }}>E</span> interact · <span style={{ fontFamily: fontMono }}>R</span> reload ·{' '}
              <span style={{ fontFamily: fontMono }}>F</span> flashlight · <span style={{ fontFamily: fontMono }}>H</span> medkit (
              {RAID_MEDKIT_COOLDOWN_MS / 1000}s) · <span style={{ fontFamily: fontMono }}>B</span> bandage ({RAID_BANDAGE_COOLDOWN_MS / 1000}s) · <span style={{ fontFamily: fontMono }}>G</span> pulse ({RAID_GADGET_COOLDOWN_MS / 1000}s)
            </p>
          </div>
        </div>
      )}

      {gameState === GameState.SHIP && isShipUIOpen && (
        <>
          <div
            aria-hidden
            onClick={() => setIsShipUIOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 30,
              background: 'rgba(2, 6, 14, 0.78)',
              backdropFilter: 'blur(6px)',
              pointerEvents: 'auto',
            }}
          />
          <div
            ref={shipOpsDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ship-ops-heading"
            className="ui-panel ui-fade-in"
            style={{
              position: 'absolute',
              top: 'max(24px, env(safe-area-inset-top))',
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'auto',
              zIndex: 31,
              padding: 'clamp(28px, 4vw, 40px)',
              width: 'min(1120px, calc(100vw - max(48px, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px))))',
              maxHeight: 'min(580px, calc(100vh - max(48px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))))',
              overflowY: 'auto',
              textAlign: 'center',
            }}
          >
            <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8', animation: 'pulse 1s infinite alternate' }} />
              <div style={{ fontSize: 9, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.15em' }}>COMMAND LINK SECURE</div>
            </div>
            <p className="ui-eyebrow ui-eyebrow-ops">OPS / CONTRACT</p>
            <h1 id="ship-ops-heading" style={{ margin: '0 0 12px 0', fontSize: 'clamp(1.35rem, 2.4vw, 1.85rem)', fontWeight: 700, letterSpacing: '-0.02em' }}>
              ICV Relentless — Freighter Ops
            </h1>
          <p style={{ margin: '0 0 20px 0', fontSize: 12, color: 'rgba(160, 175, 200, 0.82)' }}>
            <span style={{ fontFamily: fontMono, color: 'rgba(180, 215, 255, 0.9)' }}>Esc</span> or backdrop click to close · Same data as the cyan bridge screen ·
            {' '}
            {contracts.some((c) => !c.isCompleted)
              ? 'Select a contract to unlock the corresponding airlock'
              : 'All contracts complete — free deployment is available'}
          </p>
          <h2 style={{ color: '#fde68a', margin: '0 0 22px 0', fontSize: 'clamp(1.05rem, 2vw, 1.35rem)', fontFamily: fontMono, fontWeight: 550 }}>¤ {money.toLocaleString()}</h2>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              aria-label={canDockStation ? 'Dock with abandoned station via Airlock Alpha' : (activeContractDeployZone === 'planet' ? 'Active contract deploys to planet — use Deploy to Outpost' : 'Select a station or moon contract to unlock Airlock Alpha')}
              title={!canDockStation ? (activeContractDeployZone === 'planet' ? 'Switch to a station/moon contract to unlock Airlock Alpha' : 'Activate a station or moon contract to dock') : undefined}
              onClick={() => {
                setIsShipUIOpen(false);
                game.stateMachine.setState(GameState.STATION);
              }}
              disabled={!canDockStation}
              style={{
                padding: '14px 28px',
                fontSize: 15,
                fontFamily: fontUi,
                fontWeight: 600,
                cursor: canDockStation ? 'pointer' : 'not-allowed',
                background: canDockStation ? 'linear-gradient(180deg, #b91c1c, #7f1d1d)' : 'rgba(60, 65, 75, 0.8)',
                color: canDockStation ? '#fff' : 'rgba(180, 185, 195, 0.6)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                letterSpacing: '0.06em',
              }}
            >
              {canDockStation ? 'AIRLOCK α — STATION' : activeContractDeployZone === 'planet' ? 'α LOCKED (PLANET CONTRACT)' : 'SELECT A CONTRACT'}
            </button>
            <button
              type="button"
              aria-label={canDeployPlanet ? 'Deploy to planet outpost via Airlock Beta' : 'Select the planet beacon contract to unlock Airlock Beta'}
              title={!canDeployPlanet ? (activeContractDeployZone === 'station_chain' ? 'Switch to the planet beacon contract to unlock Airlock Beta' : 'Activate the Recover Beacon Core contract to deploy') : undefined}
              onClick={() => {
                setIsShipUIOpen(false);
                game.stateMachine.setState(GameState.PLANET);
              }}
              disabled={!canDeployPlanet}
              style={{
                padding: '14px 28px',
                fontSize: 15,
                fontFamily: fontUi,
                fontWeight: 600,
                cursor: canDeployPlanet ? 'pointer' : 'not-allowed',
                background: canDeployPlanet ? 'linear-gradient(180deg, #1d4ed8, #1e3a8a)' : 'rgba(60, 65, 75, 0.8)',
                color: canDeployPlanet ? '#fff' : 'rgba(180, 185, 195, 0.6)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                letterSpacing: '0.06em',
              }}
            >
              {canDeployPlanet ? 'AIRLOCK β — OUTPOST' : activeContractDeployZone === 'station_chain' ? 'β LOCKED (STATION CONTRACT)' : 'SELECT PLANET CONTRACT'}
            </button>
            <button
              type="button"
              aria-label="Close ship operations"
              onClick={() => setIsShipUIOpen(false)}
              style={{
                padding: '14px 28px',
                fontSize: 15,
                fontFamily: fontUi,
                fontWeight: 600,
                cursor: 'pointer',
                background: 'rgba(55, 60, 72, 0.95)',
                color: '#e8edf5',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                letterSpacing: '0.05em',
              }}
            >
              Close
            </button>
          </div>

          <div className="ops-grid">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10, marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 13, letterSpacing: '0.1em', fontWeight: 600 }}>STASH</h3>
                <button
                  type="button"
                  aria-label={stashJunkQuantity > 0 ? 'Sell scrap and copper wire from stash for credits' : 'No junk items in stash'}
                  onClick={() => void sellJunk()}
                  disabled={stashJunkQuantity === 0}
                  style={{
                    background: stashJunkQuantity > 0 ? 'linear-gradient(180deg, #fbbf24, #d97706)' : 'rgba(70, 60, 40, 0.5)',
                    color: stashJunkQuantity > 0 ? '#1a1510' : 'rgba(170,165,155,0.5)',
                    border: 'none',
                    padding: '7px 14px',
                    cursor: stashJunkQuantity > 0 ? 'pointer' : 'not-allowed',
                    fontWeight: 700,
                    fontFamily: fontUi,
                    borderRadius: 8,
                    fontSize: 11,
                    letterSpacing: '0.06em',
                  }}
                >
                  SELL JUNK
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(150,165,185,0.85)', margin: '0 0 12px 0', lineHeight: 1.45 }}>
                Click an item card to stage it into loadout. New primaries swap the old one back to stash. Junk = scrap metal &amp;
                copper wire only.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxHeight: 212, overflowY: 'auto', paddingBottom: 2 }}>
                {stash.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'rgba(140,155,175,0.75)', padding: '12px 8px', textAlign: 'center', borderRadius: 8 }}>
                    Stash is empty — extracted raid loot appears here.
                  </div>
                ) : (
                  stash.map((item) => (
                    <div
                      key={item.id}
                      tabIndex={0}
                      role="button"
                      className="ui-card-interactive"
                       onKeyDown={async (e) => {
                         if (e.key === 'Enter' || e.key === ' ') {
                           e.preventDefault();
                           await stageItemToLoadout(item);
                         }
                       }}
                       onClick={() => void stageItemToLoadout(item)}
                      style={{
                        background: 'rgba(30, 36, 48, 0.92)',
                        padding: '10px 12px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 11, color: lootColorForItemId(item.itemId), fontWeight: 600 }}>{formatItemId(item.itemId)}</div>
                      <div style={{ fontSize: 16, fontFamily: fontMono, fontWeight: 550, marginTop: 4 }}>×{item.quantity}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: 13, letterSpacing: '0.1em', fontWeight: 600, color: '#7dd3fc', borderBottom: '1px solid rgba(125, 211, 252, 0.2)', paddingBottom: 10 }}>
                LOADOUT
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: 11, lineHeight: 1.45, color: 'rgba(150, 168, 195, 0.82)', textAlign: 'left' }}>
                Click items from stash to stage one primary (rifle, shotgun, or pulse) plus 9×mm for reserves. Staging a new primary
                automatically swaps the old one out. Staged gear comes with you from the shuttle; ammunition you find mid-raid stays on
                you until green extract saves it.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxHeight: 212, overflowY: 'auto', paddingBottom: 2 }}>
                {loadout.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'rgba(140,155,175,0.75)', padding: '12px 8px', textAlign: 'center', borderRadius: 8 }}>
                    No items staged · click stash cards to equip before docking.
                  </div>
                ) : (
                  loadout.map((item) => (
                    <div
                      key={item.id}
                      tabIndex={0}
                      role="button"
                      className="ui-card-interactive"
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          await db.stashItems.update(item.id!, { slot: 'stash' });
                          await refreshDbToState();
                        }
                      }}
                      onClick={async () => {
                        await db.stashItems.update(item.id!, { slot: 'stash' });
                        await refreshDbToState();
                      }}
                      style={{
                        background: 'rgba(20, 40, 58, 0.6)',
                        padding: '10px 12px',
                        border: '1px solid rgba(125, 211, 252, 0.28)',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 11, color: lootColorForItemId(item.itemId), fontWeight: 600 }}>{formatItemId(item.itemId)}</div>
                      <div style={{ fontSize: 16, fontFamily: fontMono, fontWeight: 550, marginTop: 4 }}>×{item.quantity}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ flex: '1.35 1 260px', minWidth: 0 }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: 13, letterSpacing: '0.1em', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                CONTRACTS
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: 11, lineHeight: 1.45, color: 'rgba(150, 168, 195, 0.82)', textAlign: 'left' }}>
                One mission at a time. Clear contracts in sequence to unlock harder deployments, new quartermaster tech, and heavier armor refits. Station &amp; moon contracts use Airlock Alpha (port); planet contracts use Airlock Beta (starboard).
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 212, overflowY: 'auto' }}>
                {contracts.filter((c) => !c.isCompleted).length === 0 && (
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(140,155,175,0.75)' }}>No open contracts.</p>
                )}
                {contracts
                  .filter((c) => !c.isCompleted)
                  .map((contract) => {
                    const unlocked = isContractUnlocked(contract.title, completedContractCount);
                    const unlockRequirement = getContractUnlockRequirement(contract.title);
                    return (
                      <button
                        key={contract.id}
                        type="button"
                        tabIndex={unlocked ? 0 : -1}
                        aria-pressed={activeContractId === contract.id}
                        disabled={!unlocked}
                        className={`contract-card ${unlocked ? 'ui-card-interactive' : ''}`}
                        onKeyDown={async (e) => {
                          if (!unlocked) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            await db.contracts.toCollection().modify({ isActive: false });
                            await db.contracts.update(contract.id!, { isActive: true });
                            await refreshDbToState();
                          }
                        }}
                        onClick={async () => {
                          if (!unlocked) return;
                          await db.contracts.toCollection().modify({ isActive: false });
                          await db.contracts.update(contract.id!, { isActive: true });
                          await refreshDbToState();
                        }}
                        style={{
                          background: activeContractId === contract.id ? 'rgba(80, 30, 35, 0.78)' : 'rgba(30, 36, 48, 0.92)',
                          border: `1px solid ${
                            activeContractId === contract.id
                              ? 'rgba(248, 113, 113, 0.5)'
                              : unlocked
                                ? 'rgba(255,255,255,0.07)'
                                : 'rgba(125, 211, 252, 0.18)'
                          }`,
                          cursor: unlocked ? 'pointer' : 'not-allowed',
                          opacity: unlocked ? 1 : 0.58,
                          color: '#e2e8f0',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{contract.title}</div>
                          {activeContractId === contract.id ? (
                            <span
                              style={{
                                flexShrink: 0,
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: '0.12em',
                                color: '#fecaca',
                                border: '1px solid rgba(248, 113, 113, 0.4)',
                                borderRadius: 4,
                                padding: '2px 6px',
                              }}
                            >
                              ACTIVE
                            </span>
                          ) : !unlocked ? (
                            <span
                              style={{
                                flexShrink: 0,
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: '0.12em',
                                color: '#bae6fd',
                                border: '1px solid rgba(125, 211, 252, 0.28)',
                                borderRadius: 4,
                                padding: '2px 6px',
                              }}
                            >
                              LOCKED
                            </span>
                          ) : null}
                        </div>
                        <div className="contract-desc" style={{ fontSize: 11, color: 'rgba(175, 190, 210, 0.88)', margin: '6px 0', lineHeight: 1.45 }}>
                          {contract.description}
                        </div>
                        {!unlocked && (
                          <div style={{ fontSize: 10, color: '#93c5fd', marginBottom: 6 }}>
                            Clear {unlockRequirement} contract{unlockRequirement === 1 ? '' : 's'} to unlock.
                          </div>
                        )}
                        <div style={{ fontSize: 13, color: '#fde68a', fontFamily: fontMono }}>¤ {contract.reward.toLocaleString()}</div>
                      </button>
                    );
                  })}
              </div>
              {completedContracts.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: 10, letterSpacing: '0.12em', color: 'rgba(130,155,145,0.75)', fontWeight: 600 }}>
                    COMPLETED
                  </p>
                  {completedContracts.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        fontSize: 12,
                        color: 'rgba(120, 180, 150, 0.75)',
                        padding: '4px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      {c.title}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: 13, letterSpacing: '0.1em', fontWeight: 600, color: '#fdba74', borderBottom: '1px solid rgba(253, 186, 116, 0.2)', paddingBottom: 10 }}>
                ARMORY
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: 11, lineHeight: 1.45, color: 'rgba(150, 168, 195, 0.82)', textAlign: 'left' }}>
                Once a contract is selected, deploy via the appropriate airlock row.
              </p>
              
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8, fontSize: 10, letterSpacing: '0.12em', color: '#7dd3fc', fontWeight: 700 }}>
                  SUIT SELECTION
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { id: 'pathfinder', label: 'PATHFINDER', tip: 'Balanced mobility & energy' },
                    { id: 'bulwark', label: 'BULWARK', tip: '+50% Health, -20% Speed' },
                    { id: 'tech_specialist', label: 'TECH SPEC', tip: 'Fast hack & sensor range' }
                  ].map((sc) => (
                    <button
                      key={sc.id}
                      title={sc.tip}
                      onClick={() => void changeSuitClass(sc.id)}
                      style={{
                        padding: '10px 4px',
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: fontUi,
                        cursor: 'pointer',
                        background: suitClass === sc.id ? 'linear-gradient(180deg, #38bdf8, #0284c7)' : 'rgba(30, 41, 59, 0.7)',
                        color: suitClass === sc.id ? '#082f49' : 'rgba(186, 230, 253, 0.85)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: 6,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                {[
                  ...ARMORY_PRIMARY_OFFERS.map((o) => ({
                    id: o.itemId,
                    name: getLootDefinition(o.itemId)?.name ?? o.itemId,
                    cost: o.credits,
                  })),
                  { id: 'ammo_9mm', name: 'Ammo ×30', cost: 20, qty: 30 },
                  { id: 'medkit', name: 'Medkit', cost: 50 },
                  { id: 'bandage', name: 'Bandage ×3', cost: 25, qty: 3 },
                ].map((item) => (
                  <div
                    key={item.id}
                    tabIndex={money >= item.cost ? 0 : -1}
                    role="button"
                    className={money >= item.cost ? 'ui-card-interactive' : undefined}
                    onKeyDown={(e) => {
                      if (money < item.cost) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void buyItem(item.id, item.cost, item.qty || 1);
                      }
                    }}
                    onClick={() => void buyItem(item.id, item.cost, item.qty || 1)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(50, 32, 28, 0.68)',
                      padding: '10px 12px',
                      border: `1px solid ${money >= item.cost ? 'rgba(253, 186, 116, 0.3)' : 'rgba(253, 186, 116, 0.12)'}`,
                      borderRadius: 8,
                      cursor: money >= item.cost ? 'pointer' : 'not-allowed',
                      opacity: money >= item.cost ? 1 : 0.48,
                      textAlign: 'left'
                    }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: '#fde68a', fontFamily: fontMono }}>¤ {item.cost}</div>
                    </div>
                  ))}
                <div style={{ marginTop: 6, marginBottom: 2, fontSize: 10, letterSpacing: '0.12em', color: 'rgba(253, 186, 116, 0.72)', fontWeight: 700 }}>
                  UPGRADES
                </div>
                {armoryUpgradeOffers.map((offer) => {
                  const atMax = offer.level >= offer.maxLevel;
                  const canBuy = offer.unlocked && !atMax && money >= offer.cost;
                  return (
                    <div
                      key={offer.id}
                      tabIndex={canBuy ? 0 : -1}
                      role="button"
                      className={canBuy ? 'ui-card-interactive' : undefined}
                      onKeyDown={(e) => {
                        if (!canBuy) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void buyUpgrade(offer, completedContractCount);
                        }
                      }}
                      onClick={() => {
                        if (!canBuy) return;
                        void buyUpgrade(offer, completedContractCount);
                      }}
                      style={{
                        background: offer.category === 'weapon' ? 'rgba(50, 32, 20, 0.68)' : 'rgba(30, 44, 38, 0.72)',
                        padding: '10px 12px',
                        border: `1px solid ${
                          canBuy
                            ? offer.category === 'weapon'
                              ? 'rgba(253, 186, 116, 0.3)'
                              : 'rgba(134, 239, 172, 0.24)'
                            : 'rgba(255,255,255,0.08)'
                        }`,
                        borderRadius: 8,
                        cursor: canBuy ? 'pointer' : 'default',
                        opacity: offer.unlocked ? 1 : 0.56,
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{offer.label}</div>
                          <div style={{ fontSize: 10, color: offer.category === 'weapon' ? '#fdba74' : '#86efac', marginTop: 2 }}>
                            Lv {offer.level}/{offer.maxLevel} · {offer.effectSummary}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: '#fde68a', fontFamily: fontMono, flexShrink: 0 }}>
                          {atMax ? 'MAX' : `¤ ${offer.cost}`}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(175, 190, 210, 0.82)', marginTop: 6, lineHeight: 1.45 }}>
                        {offer.description}
                      </div>
                      {!offer.unlocked && (
                        <div style={{ fontSize: 10, color: '#93c5fd', marginTop: 6 }}>
                          Unlocks after {offer.unlockAfterCompleted} completed contract{offer.unlockAfterCompleted === 1 ? '' : 's'}.
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* ── MERCHANT PANEL ─────────────────────────────────────────────────── */}
      {gameState === GameState.SHIP && openMerchantId !== null && (() => {
        const isSP   = openMerchantId === 'supply_post';
        const isQM   = openMerchantId === 'quartermaster';
        const isTS   = openMerchantId === 'tech_specialist';
        const title  = isSP ? "Marta's Surplus" : isQM ? 'Quartermaster — Sgt. Hendrix' : isTS ? 'Engineering — Kaelen' : 'Merchant';
        
        const pool = DIALOGUE_POOLS[openMerchantId] || { greetings: [""], lore: [""], onBuy: [""] };
        const displayDialogue = npcDialogue || pool.greetings[0];

        const items: { id: string; name: string; cost: number; qty?: number }[] = isSP
          ? [
              { id: 'ammo_9mm', name: 'Ammo ×30',   cost: 20, qty: 30 },
              { id: 'medkit',   name: 'Medkit',      cost: 50 },
              { id: 'bandage',  name: 'Bandage ×3',  cost: 25, qty: 3  },
            ]
          : isQM
          ? [
              ...ARMORY_PRIMARY_OFFERS.map((o) => ({
                id:   o.itemId,
                name: getLootDefinition(o.itemId)?.name ?? o.itemId,
                cost: o.credits,
              })),
              { id: 'ammo_9mm', name: 'Ammo ×30',  cost: 20, qty: 30 },
              { id: 'medkit',   name: 'Medkit',     cost: 50 },
              { id: 'bandage',  name: 'Bandage ×3', cost: 25, qty: 3  },
            ]
          : isTS
          ? [
              { id: 'scrap_metal', name: 'Scrap Metal Bundle', cost: 120, qty: 5 },
              { id: 'circuits',     name: 'Circuit Boards',    cost: 200, qty: 2 },
            ]
          : [];

        return (
          <>
            <div
              aria-hidden
              onClick={() => setOpenMerchantId(null)}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 30,
                background: 'rgba(2, 6, 14, 0.78)',
                backdropFilter: 'blur(6px)',
                pointerEvents: 'auto',
              }}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className="ui-panel ui-fade-in"
              style={{
                position: 'absolute',
                top: 'max(24px, env(safe-area-inset-top))',
                left: '50%',
                transform: 'translateX(-50%)',
                pointerEvents: 'auto',
                zIndex: 31,
                padding: 'clamp(24px, 3.5vw, 36px)',
                width: 'min(520px, calc(100vw - max(48px, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px))))',
                maxHeight: 'min(580px, calc(100vh - max(48px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))))',
                overflowY: 'auto',
                textAlign: 'center',
              }}
            >
              <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(56, 189, 248, 0.4)', letterSpacing: '0.1em' }}>COMMS_LINK: ESTABLISHED</div>
                <div style={{ display: 'flex', gap: 2 }}>
                  <div style={{ width: 2, height: 4, background: '#38bdf8' }} />
                  <div style={{ width: 2, height: 6, background: '#38bdf8' }} />
                  <div style={{ width: 2, height: 8, background: '#38bdf8' }} />
                  <div style={{ width: 2, height: 10, background: '#38bdf8' }} />
                </div>
              </div>

              <div className="ui-bracket" style={{ width: 64, height: 64, margin: '0 auto 16px', background: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 24, opacity: 0.5 }}>{isSP ? '📦' : isQM ? '🛡️' : '🔧'}</div>
                <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(56, 189, 248, 0.05) 1px, rgba(56, 189, 248, 0.05) 2px)', pointerEvents: 'none' }} />
              </div>

              <p className="ui-eyebrow ui-eyebrow-hub">VNDR / UPLINK</p>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '1.45rem', fontWeight: 700 }}>{title}</h2>
              <p style={{ margin: '0 0 24px 0', fontSize: 13, color: 'rgba(160, 175, 200, 0.75)', fontStyle: 'italic', lineHeight: 1.5, minHeight: '3em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                "{displayDialogue}"
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
                <button 
                  onClick={() => {
                    const lore = pool.lore[Math.floor(Math.random() * pool.lore.length)];
                    setNpcDialogue(lore);
                  }}
                  style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', borderRadius: 4, cursor: 'pointer' }}
                >
                  DISCOVER LORE
                </button>
                <button 
                  onClick={() => {
                    const greet = pool.greetings[Math.floor(Math.random() * pool.greetings.length)];
                    setNpcDialogue(greet);
                  }}
                  style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 4, cursor: 'pointer' }}
                >
                  TALK
                </button>
              </div>
              <h2 style={{ color: '#fde68a', margin: '0 0 18px 0', fontSize: 'clamp(1rem, 1.8vw, 1.2rem)', fontFamily: fontMono, fontWeight: 550 }}>¤ {money.toLocaleString()}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    tabIndex={money >= item.cost ? 0 : -1}
                    role="button"
                    className={money >= item.cost ? 'ui-card-interactive' : undefined}
                    onKeyDown={(e) => {
                      if (money < item.cost) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void buyItem(item.id, item.cost, item.qty ?? 1);
                      }
                    }}
                    onClick={() => { if (money >= item.cost) void buyItem(item.id, item.cost, item.qty ?? 1); }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(50, 32, 20, 0.68)',
                      padding: '10px 14px',
                      border: `1px solid ${money >= item.cost ? 'rgba(253, 186, 116, 0.3)' : 'rgba(253, 186, 116, 0.1)'}`,
                      borderRadius: 8,
                      cursor: money >= item.cost ? 'pointer' : 'not-allowed',
                      opacity: money >= item.cost ? 1 : 0.46,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: '#fde68a', fontFamily: fontMono, flexShrink: 0, marginLeft: 12 }}>¤ {item.cost}</div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setOpenMerchantId(null)}
                style={{
                  padding: '11px 26px',
                  fontSize: 14,
                  fontFamily: fontUi,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: 'rgba(55, 60, 72, 0.95)',
                  color: '#e8edf5',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  letterSpacing: '0.05em',
                }}
              >
                Close
              </button>
            </div>
          </>
        );
      })()}

      {/* ── CREW NOTICE BOARD ──────────────────────────────────────────────── */}
      {gameState === GameState.SHIP && noticeOpen && (
        <>
          <div
            aria-hidden
            onClick={() => setNoticeOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 30,
              background: 'rgba(2, 6, 14, 0.78)',
              backdropFilter: 'blur(6px)',
              pointerEvents: 'auto',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Crew Notice Board"
            className="ui-panel ui-fade-in"
            style={{
              position: 'absolute',
              top: 'max(24px, env(safe-area-inset-top))',
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'auto',
              zIndex: 31,
              padding: 'clamp(24px, 3.5vw, 36px)',
              width: 'min(560px, calc(100vw - max(48px, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px))))',
              maxHeight: 'min(580px, calc(100vh - max(48px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))))',
              overflowY: 'auto',
            }}
          >
            <p className="ui-eyebrow ui-eyebrow-ops">SHIP BULLETIN BOARD</p>
            <h1 style={{ margin: '0 0 18px 0', fontSize: 'clamp(1.1rem, 2vw, 1.45rem)', fontWeight: 700, textAlign: 'center' }}>
              ICV Relentless — Crew Notices
            </h1>
            <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 20 }}>
              <button 
                onClick={() => setNoticeTab('open')}
                style={{ 
                  padding: '10px 16px', 
                  background: 'transparent', 
                  color: noticeTab === 'open' ? '#38bdf8' : 'rgba(148, 163, 184, 0.6)', 
                  border: 'none', 
                  borderBottom: noticeTab === 'open' ? '2px solid #38bdf8' : 'none',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer' 
                }}
              >
                OPEN WARRANTS
              </button>
              <button 
                onClick={() => setNoticeTab('history')}
                style={{ 
                  padding: '10px 16px', 
                  background: 'transparent', 
                  color: noticeTab === 'history' ? '#34d399' : 'rgba(148, 163, 184, 0.6)', 
                  border: 'none', 
                  borderBottom: noticeTab === 'history' ? '2px solid #34d399' : 'none',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer' 
                }}
              >
                SERVICE HISTORY
              </button>
              <button 
                onClick={() => setNoticeTab('lore')}
                style={{ 
                  padding: '10px 16px', 
                  background: 'transparent', 
                  color: noticeTab === 'lore' ? '#94a3b8' : 'rgba(148, 163, 184, 0.6)', 
                  border: 'none', 
                  borderBottom: noticeTab === 'lore' ? '2px solid #94a3b8' : 'none',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer' 
                }}
              >
                CREW NOTICES
              </button>
            </div>

            {noticeTab === 'open' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                {contracts.filter(c => !c.isCompleted).length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: 'rgba(148, 163, 184, 0.5)', fontSize: 13 }}>
                    No active warrants available. All sectors secured.
                  </div>
                ) : (
                  contracts.filter(c => !c.isCompleted).map(contract => {
                    const unlocked = isContractUnlocked(contract.title, completedContractCount);
                    const isActive = activeContractId === contract.id;
                    
                    return (
                      <div
                        key={contract.id}
                        style={{
                          background: isActive ? 'rgba(56, 189, 248, 0.08)' : 'rgba(30, 41, 59, 0.4)',
                          border: `1px solid ${isActive ? 'rgba(56, 189, 248, 0.4)' : unlocked ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}`,
                          borderRadius: 12,
                          padding: 20,
                          textAlign: 'left',
                          transition: 'all 0.2s ease',
                          opacity: unlocked ? 1 : 0.5,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: unlocked ? '#f8fafc' : '#94a3b8' }}>
                            {contract.title}
                          </h3>
                          <div style={{ fontSize: 14, color: '#fde68a', fontFamily: fontMono, fontWeight: 600 }}>
                            ¤ {contract.reward.toLocaleString()}
                          </div>
                        </div>
                        
                        <p style={{ margin: '0 0 16px 0', fontSize: 12, color: 'rgba(148, 163, 184, 0.9)', lineHeight: 1.5 }}>
                          {contract.description}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 10, letterSpacing: '0.08em', fontWeight: 700, color: 'rgba(148, 163, 184, 0.6)', textTransform: 'uppercase' }}>
                            Target: {getContractDeployZone(contract.title)?.replace('_', ' ') || 'Classified'}
                          </div>
                          
                          {isActive ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontSize: 11, fontWeight: 700, animation: 'pulse 1.5s infinite alternate' }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 10px #38bdf8' }} />
                              ACCEPTED WARRANT
                            </div>
                          ) : unlocked ? (
                            <button
                              onClick={async () => {
                                await db.contracts.toCollection().modify({ isActive: false });
                                await db.contracts.update(contract.id!, { isActive: true });
                                await refreshDbToState();
                                setToast(`Warrant accepted: ${contract.title}`);
                                setNoticeOpen(false);
                              }}
                              style={{
                                padding: '8px 20px',
                                background: '#0ea5e9',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)',
                              }}
                            >
                              ACCEPT CONTRACT
                            </button>
                          ) : (
                            <div style={{ fontSize: 11, color: 'rgba(148, 163, 184, 0.5)', fontStyle: 'italic' }}>
                              LOCKED: Complete {getContractUnlockRequirement(contract.title)} missions
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {noticeTab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {contracts.filter(c => c.isCompleted).length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: 'rgba(148, 163, 184, 0.5)', fontSize: 13 }}>
                    No service records found. Complete missions to build your history.
                  </div>
                ) : (
                  contracts.filter(c => c.isCompleted).map(contract => (
                    <div
                      key={contract.id}
                      style={{
                        background: 'rgba(20, 35, 30, 0.6)',
                        border: '1px solid rgba(52, 211, 153, 0.15)',
                        borderRadius: 10,
                        padding: '14px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{contract.title}</div>
                        <div style={{ fontSize: 10, color: '#34d399', fontWeight: 600, letterSpacing: '0.05em', marginTop: 4 }}>WARRANT CLEARED</div>
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(148, 163, 184, 0.8)', fontFamily: fontMono }}>
                        +¤ {contract.reward.toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {noticeTab === 'lore' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {[
                  { tag: '⚠ SHIP NOTICE', text: 'Cargo bay pressurization drill 0300 ship-time. All crew must muster in the aft cross-corridor. Report anomalies to the bridge.' },
                  { tag: '─ MARTA\'S SURPLUS', text: 'Restocked after the last run. Medkits, bandages, and 9×mm fresh from station logistics. No returns on firearms. — M.R.' },
                  { tag: '⚠ SECURITY ADVISORY', text: 'Airlock Alpha authorisation is restricted to command biometrics during active contracts. Tampering is a felony under Frontier Charter Article 18.' },
                  { tag: '─ CREW NOTICE', text: 'Coffee machine in the aft mess is broken again. Anyone with a spare 12-mm fuse strip, see Hendrix. — Engineering' },
                  { tag: '▶ FREIGHT MANIFEST', text: 'ICV Relentless, Meridian-class. Bound: Frontier Station Delta-9. Cargo: medical surplus (declared), survey equipment (restricted). Return ETA: OPEN.' },
                  { tag: '─ SGT. HENDRIX', text: 'Anyone messes with the weapon racks without a sign-out form is on cleanup duty for a month. You know who you are.' },
                ].map(({ tag, text }, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(20, 28, 40, 0.72)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 8,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(163, 230, 180, 0.85)', marginBottom: 4, fontFamily: fontMono }}>{tag}</div>
                    <div style={{ fontSize: 12, lineHeight: 1.55, color: 'rgba(200, 212, 228, 0.9)' }}>{text}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setNoticeOpen(false)}
                style={{
                  padding: '11px 26px',
                  fontSize: 14,
                  fontFamily: fontUi,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: 'rgba(55, 60, 72, 0.95)',
                  color: '#e8edf5',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  letterSpacing: '0.05em',
                  width: '100%',
                }}
              >
                CLOSE BOARD
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── DEPLOYMENT OVERLAY ────────────────────────────────────────────── */}
      {isDeploying && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 200,
            background: '#020617',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            pointerEvents: 'auto'
          }}
        >
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, transparent 1px, transparent 2px)',
            backgroundSize: '100% 3px',
            pointerEvents: 'none'
          }} />
          
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)',
            boxShadow: '0 0 15px rgba(56,189,248,0.3)',
            animation: 'scan-sweep 2s linear infinite'
          }} />
          
          <div style={{ 
            fontSize: 10, 
            letterSpacing: '0.5em', 
            color: '#38bdf8', 
            marginBottom: 20, 
            fontWeight: 700,
            animation: 'pulse 0.5s infinite alternate' 
          }}>
            TRANSIT IN PROGRESS
          </div>
          
          <h2 style={{ 
            margin: 0, 
            fontSize: 'clamp(2rem, 5vw, 3.5rem)', 
            fontWeight: 900, 
            letterSpacing: '-0.02em',
            color: '#f8fafc',
            textAlign: 'center'
          }}>
            DEPLOYING TO <span style={{ color: '#0ea5e9' }}>{
              gameState === GameState.STATION ? 'STATION DELTA-9' : 
              gameState === GameState.PLANET ? 'PLANET OUTPOST' : 
              'CLASSIFIED ZONE'
            }</span>
          </h2>

          {activeRaidContract && (
            <div style={{ 
              marginTop: 24, 
              padding: '12px 20px', 
              background: 'rgba(56, 189, 248, 0.05)', 
              border: '1px solid rgba(56, 189, 248, 0.2)', 
              borderRadius: 8,
              maxWidth: 480,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 10, color: '#38bdf8', fontWeight: 700, letterSpacing: '0.2em', marginBottom: 6 }}>MISSION BRIEFING</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{activeRaidContract.title}</div>
              <div style={{ fontSize: 12, color: 'rgba(148, 163, 184, 0.85)', lineHeight: 1.5 }}>{activeRaidContract.description}</div>
            </div>
          )}
          
          <div style={{ 
            marginTop: 40, 
            width: 300, 
            height: 2, 
            background: 'rgba(255,255,255,0.1)', 
            position: 'relative' 
          }}>
            <div style={{ 
              position: 'absolute', 
              height: '100%', 
              width: '100%', 
              background: '#0ea5e9', 
              boxShadow: '0 0 15px #0ea5e9',
              transformOrigin: 'left',
              animation: 'deploy-progress 1.6s ease-in-out forwards' 
            }} />
          </div>

          <div style={{ 
            position: 'absolute', 
            bottom: 60, 
            fontSize: 11, 
            fontFamily: fontMono, 
            color: 'rgba(148, 163, 184, 0.5)',
            textAlign: 'center'
          }}>
            POD_UUID: {Math.random().toString(16).substring(2, 10).toUpperCase()} · VELOCITY: 4,820 M/S · SHIELD_STRUCT: NOMINAL
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
