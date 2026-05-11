import React, { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { Game } from './game/Game';
import { RAID_MEDKIT_COOLDOWN_MS, RAID_BANDAGE_COOLDOWN_MS } from './game/player/PlayerController';
import { RAID_GADGET_COOLDOWN_MS } from './game/raid/raidGadget';
import { RAID_LORE_BY_SEGMENT } from './game/level/raidLoreTerminals';
import { GameState } from './game/StateMachine';
import { db, StashItem, Contract } from './game/persistence/SaveDB';
import {
  getContractRaidHint,
  contractProgressSummary,
  hubDockingAllowed,
  getContractDeployZone,
} from './game/contracts/contractRules';
import { ARMORY_PRIMARY_OFFERS, getWeaponRaidHudHint } from './game/weapons/weaponDefinitions';
import { getLootDefinition, lootTradeInCredits } from './game/loot/lootDatabase';
import { lootColorForItemId } from './game/loot/lootUi';
import { getLoadoutPrimarySwapIds } from './game/hub/loadoutRules';
import { isPrimaryWeaponItemId } from './game/weapons/weaponDefinitions';
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
  const [health, setHealth] = useState({ current: 100, max: 100 });
  const [battery, setBattery] = useState({ current: 100, max: 100 });
  const [pointerLocked, setPointerLocked] = useState(typeof document !== 'undefined' && !!document.pointerLockElement);
  const [stationRaidKills, setStationRaidKills] = useState(0);
  const [equippedWeaponItemId, setEquippedWeaponItemId] = useState<string>('rifle_01');
  const [toast, setToast] = useState<string | null>(null);
  const [medkitCooldownMs, setMedkitCooldownMs] = useState(0);
  const [bandageCooldownMs, setBandageCooldownMs] = useState(0);
  const [gadgetCooldownMs, setGadgetCooldownMs] = useState(0);
  const [stamina, setStamina] = useState({ current: 100, max: 100 });
  const [environmentalSurge, setEnvironmentalSurge] = useState(false);
  const [loreTerminalText, setLoreTerminalText] = useState<string | null>(null);
  const [openMerchantId, setOpenMerchantId] = useState<string | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);

  const shipOpsDialogRef = useRef<HTMLDivElement>(null);

  const refreshDbToState = useCallback(async () => {
    const items = await db.stashItems.toArray();
    setStash(items.filter((i) => i.slot === 'stash'));
    setLoadout(items.filter((i) => i.slot === 'loadout'));
    const allContracts = await db.contracts.toArray();
    setContracts(allContracts);
    const active = allContracts.find((c) => c.isActive);
    setActiveContractId(active?.id ?? null);
    const profile = await db.playerProfile.toCollection().first();
    if (profile) setMoney(profile.money);
  }, []);

  useEffect(() => {
    void refreshDbToState();

    const cleanup = game.stateMachine.onStateChange((newState) => {
      setGameState(newState);
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
    window.addEventListener('raidGadgetDeployed', onGadget);
    window.addEventListener('raidLootPicked', onLoot as EventListener);
    window.addEventListener('raidExtractComplete', onExtract as EventListener);
    window.addEventListener('raidPlayerDeath', onDeath);
    return () => {
      window.removeEventListener('raidGadgetDeployed', onGadget);
      window.removeEventListener('raidLootPicked', onLoot as EventListener);
      window.removeEventListener('raidExtractComplete', onExtract as EventListener);
      window.removeEventListener('raidPlayerDeath', onDeath);
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
    if (!isShipUIOpen) return;
    const id = window.requestAnimationFrame(() => {
      shipOpsDialogRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [isShipUIOpen]);

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
  const canDockFromHub = hubDockingAllowed(contracts, activeContractId);
  const activeRaidContract = contracts.find((c) => c.isActive && !c.isCompleted);
  // Determine which airlocks are available based on the active contract's zone
  const activeContractDeployZone = activeRaidContract ? getContractDeployZone(activeRaidContract.title) : null;
  const canDockStation = canDockFromHub && activeContractDeployZone !== 'planet';
  const canDeployPlanet = canDockFromHub && activeContractDeployZone === 'planet';
  const raidContractZone =
    gameState === GameState.STATION ? 'station' : gameState === GameState.MOON_BASE ? 'moon' : gameState === GameState.PLANET ? 'planet' : null;
  const raidProgressLine = activeRaidContract
    ? contractProgressSummary(activeRaidContract.title, inventory, stationRaidKills)
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
      {toast && (
        <div className="ui-toast" role="status" aria-live="polite" style={{ zIndex: 24, pointerEvents: 'none' }}>
          <div style={{ ...panelBase, padding: '12px 22px', color: '#e8eef8', fontSize: 13, textAlign: 'center' }}>{toast}</div>
        </div>
      )}

      {(gameState === GameState.STATION || gameState === GameState.MOON_BASE || gameState === GameState.PLANET) && environmentalSurge && (
        // Layering: below toast (24) / lore (26); above contract (7) & pointer hint (20).
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
                width: 4,
                height: 4,
                marginLeft: -2,
                marginTop: -2,
                borderRadius: '50%',
                background:
                  healthLow ? '#fb7185' : batteryCritical && !healthLow ? '#fcd34d' : 'rgba(255,255,255,0.95)',
                boxShadow: '0 0 4px rgba(0,0,0,0.4)',
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
          <div style={{ ...panelBase, padding: '14px 16px', marginBottom: 12 }}>
            <h2 style={{ margin: '0 0 8px 0', ...hud.label() }}>
              BACKPACK
            </h2>
            {inventory.length === 0 ? (
              <p style={{ margin: 0, color: 'rgba(140,155,175,0.65)', fontSize: 13 }}>
                Empty — raid loot is not yours until a successful extract to the ship. Dying forfeits this pack.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
                {inventory.map((item, idx) => (
                  <li key={`${item.itemId}-${idx}`} style={{ fontSize: 13, color: lootColorForItemId(item.itemId) }}>
                    {formatItemId(item.itemId)}{' '}
                    <span style={{ fontFamily: fontMono, color: 'rgba(180, 200, 230, 0.9)', fontSize: 12 }}>×{item.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div
            style={{
              ...panelBase,
              padding: '16px 16px',
              outline: statusPanelOutline,
            }}
          >
            <h2 style={{ margin: '0 0 10px 0', ...hud.label() }}>
              STATUS
            </h2>
            <div
              style={{
                marginBottom: 10,
                paddingBottom: 10,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ marginBottom: 6, ...hud.sectionEyebrow('cool') }}>PRIMARY WEAPON</div>
              <div style={{ fontSize: 14, fontWeight: 650, marginBottom: 6 }}>{formatItemId(equippedWeaponItemId)}</div>
              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: 'rgba(150, 170, 200, 0.88)' }}>{getWeaponRaidHudHint(equippedWeaponItemId)}</p>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'rgba(160, 175, 195, 0.9)' }}>Health</span>
                <span style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 550, color: healthLow ? '#fda4af' : '#e8edf5' }}>
                  {Math.round(health.current)} / {health.max}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: 'rgba(0,0,0,0.35)', overflow: 'hidden' }}>
                <div style={{ width: `${healthPct}%`, height: '100%', background: healthBarColor, borderRadius: 4, transition: 'width 0.15s ease' }} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'rgba(160, 175, 195, 0.9)' }}>Flashlight</span>
                <span
                  style={{
                    fontFamily: fontMono,
                    fontSize: 13,
                    color: batteryLow ? '#fcd34d' : 'rgba(150, 210, 255, 0.95)',
                    fontWeight: batteryLow ? 600 : 400,
                  }}
                >
                  {battery.current}%
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 3, background: 'rgba(0,0,0,0.35)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${batteryPct}%`,
                    height: '100%',
                    background: batteryBarColor,
                    borderRadius: 3,
                    transition: 'width 0.15s ease, background 0.2s ease',
                  }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: staminaLow ? '#fb923c' : 'rgba(160, 175, 195, 0.9)' }}>Stamina</span>
                <span style={{ fontFamily: fontMono, fontSize: 13, color: staminaLow ? '#fb923c' : 'rgba(175, 220, 140, 0.92)', fontWeight: staminaLow ? 600 : 400 }}>
                  {stamina.current}%
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 3, background: 'rgba(0,0,0,0.35)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${staminaPct}%`,
                    height: '100%',
                    background: staminaBarColor,
                    borderRadius: 3,
                    transition: 'width 0.12s ease, background 0.2s ease',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'rgba(160, 175, 195, 0.9)' }}>Ammo</span>
              <span
                style={{
                  fontFamily: fontMono,
                  fontSize: 26,
                  fontWeight: 550,
                  color: reloading ? '#fbbf24' : ammoLow ? '#fda4af' : '#f1f5f9',
                  letterSpacing: '-0.02em',
                }}
              >
                {reloading ? '…' : ammo.current}
                <span style={{ fontSize: 15, color: 'rgba(160, 175, 195, 0.85)', fontWeight: 450 }}> / {ammo.reserve}</span>
              </span>
            </div>
            {reloading && (
              <p style={{ margin: '8px 0 0 0', fontSize: 12, fontWeight: 600, color: '#fcd34d', letterSpacing: '0.06em' }}>RELOADING</p>
            )}
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
                <span style={{ fontSize: 12, color: 'rgba(160, 175, 195, 0.9)' }}>Pulse (gadget)</span>
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
            style={{
              position: 'absolute',
              top: 'max(24px, env(safe-area-inset-top))',
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'auto',
              zIndex: 31,
              ...panelBase,
              padding: 'clamp(28px, 4vw, 40px)',
              width: 'min(1120px, calc(100vw - max(48px, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px))))',
              maxHeight: 'min(580px, calc(100vh - max(48px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))))',
              overflowY: 'auto',
              textAlign: 'center',
            }}
          >
          <p style={{ margin: '0 0 4px 0', ...hud.sectionEyebrow('ops') }}>OPS / CONTRACT</p>
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
                One mission at a time. Station &amp; moon contracts unlock Airlock Alpha (port); planet contracts unlock Airlock Beta (starboard). Meet objectives on-site, ride green extracts to stash loot; final extraction to the freighter settles payment.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 212, overflowY: 'auto' }}>
                {contracts.filter((c) => !c.isCompleted).length === 0 && (
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(140,155,175,0.75)' }}>No open contracts.</p>
                )}
                {contracts
                  .filter((c) => !c.isCompleted)
                  .map((contract) => (
                    <div
                      key={contract.id}
                      tabIndex={0}
                      role="button"
                      aria-pressed={activeContractId === contract.id}
                      className="ui-card-interactive"
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          await db.contracts.toCollection().modify({ isActive: false });
                          await db.contracts.update(contract.id!, { isActive: true });
                          await refreshDbToState();
                        }
                      }}
                      onClick={async () => {
                        await db.contracts.toCollection().modify({ isActive: false });
                        await db.contracts.update(contract.id!, { isActive: true });
                        await refreshDbToState();
                      }}
                      style={{
                        background: activeContractId === contract.id ? 'rgba(80, 30, 35, 0.78)' : 'rgba(30, 36, 48, 0.92)',
                        padding: '12px 14px',
                        border: `1px solid ${activeContractId === contract.id ? 'rgba(248, 113, 113, 0.5)' : 'rgba(255,255,255,0.07)'}`,
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{contract.title}</div>
                        {activeContractId === contract.id && (
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
                        )}
                      </div>
                      <div className="contract-desc" style={{ fontSize: 11, color: 'rgba(175, 190, 210, 0.88)', margin: '6px 0', lineHeight: 1.45 }}>
                        {contract.description}
                      </div>
                      <div style={{ fontSize: 13, color: '#fde68a', fontFamily: fontMono }}>¤ {contract.reward.toLocaleString()}</div>
                    </div>
                  ))}
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
                Keep one primary weapon in loadout; staging another from stash swaps the current one back out. Purchased 9×mm goes to stash
                — move it into loadout before undocking. Mid-raid, R moves reserve rounds into the magazine; rare moon drops can tweak
                damage and fire rate on that gun.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 212, overflowY: 'auto', paddingRight: 4 }}>
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
                      background: 'rgba(50, 32, 28, 0.68)',
                      padding: '10px 12px',
                      border: `1px solid ${money >= item.cost ? 'rgba(253, 186, 116, 0.3)' : 'rgba(253, 186, 116, 0.12)'}`,
                      borderRadius: 8,
                      cursor: money >= item.cost ? 'pointer' : 'not-allowed',
                      opacity: money >= item.cost ? 1 : 0.48,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: '#fde68a', fontFamily: fontMono }}>¤ {item.cost}</div>
                  </div>
                ))}
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
        const title  = isSP ? "Marta's Surplus" : isQM ? 'Quartermaster — Sgt. Hendrix' : 'Merchant';
        const flavor = isSP
          ? "Fresh from the last supply run. Don't ask where I sourced these."
          : isQM
          ? "I keep the armory stocked. You keep coming back alive. Deal?"
          : '';
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
              style={{
                position: 'absolute',
                top: 'max(24px, env(safe-area-inset-top))',
                left: '50%',
                transform: 'translateX(-50%)',
                pointerEvents: 'auto',
                zIndex: 31,
                ...panelBase,
                padding: 'clamp(24px, 3.5vw, 36px)',
                width: 'min(520px, calc(100vw - max(48px, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px))))',
                maxHeight: 'min(580px, calc(100vh - max(48px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))))',
                overflowY: 'auto',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: '0 0 4px 0', ...hud.sectionEyebrow('ops') }}>MERCHANT</p>
              <h1 style={{ margin: '0 0 8px 0', fontSize: 'clamp(1.15rem, 2.2vw, 1.55rem)', fontWeight: 700 }}>{title}</h1>
              {flavor && (
                <p style={{ margin: '0 0 14px 0', fontSize: 12, color: 'rgba(160, 175, 200, 0.82)', fontStyle: 'italic' }}>
                  "{flavor}"
                </p>
              )}
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
            style={{
              position: 'absolute',
              top: 'max(24px, env(safe-area-inset-top))',
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'auto',
              zIndex: 31,
              ...panelBase,
              padding: 'clamp(24px, 3.5vw, 36px)',
              width: 'min(560px, calc(100vw - max(48px, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px))))',
              maxHeight: 'min(580px, calc(100vh - max(48px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))))',
              overflowY: 'auto',
            }}
          >
            <p style={{ margin: '0 0 4px 0', ...hud.sectionEyebrow('ops') }}>SHIP BULLETIN BOARD</p>
            <h1 style={{ margin: '0 0 18px 0', fontSize: 'clamp(1.1rem, 2vw, 1.45rem)', fontWeight: 700, textAlign: 'center' }}>
              ICV Relentless — Crew Notices
            </h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
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
                    padding: '10px 14px',
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
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
