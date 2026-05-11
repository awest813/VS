/**
 * Canonical primary weapon configs and pure helpers shared by HUD, loot tables,
 * persistence flow, and WeaponController runtime.
 */

export type PrimaryWeaponItemId = 'rifle_01' | 'shotgun_01' | 'pulse_rifle' | 'carbine_mk2';

export const PRIMARY_WEAPON_ITEM_IDS: readonly PrimaryWeaponItemId[] = [
  'rifle_01',
  'shotgun_01',
  'pulse_rifle',
  'carbine_mk2',
] as const;

export function isPrimaryWeaponItemId(id: string): id is PrimaryWeaponItemId {
  return (PRIMARY_WEAPON_ITEM_IDS as readonly string[]).includes(id);
}

/** Optional rolls on loot-instance weapons */
export interface WeaponLootMods {
  damageMod?: number;
  fireRateMod?: number;
}

export interface WeaponArchetype {
  itemId: PrimaryWeaponItemId;
  /** Human-readable HUD label */
  displayName: string;
  /** One-line combat fantasy — keep primaries visually distinct (few guns, loud roles). */
  roleLabel: string;
  magazineSize: number;
  fireMode: 'auto' | 'semi';
  fireRateMs: number;
  hitscanDamage: number;
  reloadDurationMs: number;
  pelletCount: number;
  /** Per-pellet spread factor added to normalized ray components before normalize() */
  spread: number;
  hitscanRange: number;
  /** Camera-local placeholder mesh (first-person box weapon). */
  viewportMesh: { width: number; height: number; depth: number };
  /** Albedo tint RGB 0–1 */
  viewportTintRgb: readonly [number, number, number];
  viewportEmissiveRgb: readonly [number, number, number];
  /** Multiplier on stock recoil kick animation */
  recoilScale: number;
  /** Distance where damage starts dropping off from close-quarters peak. */
  optimalRangeMeters: number;
  /** Damage multiplier at muzzle range (0m). */
  closeDamageMultiplier: number;
  /** Damage multiplier at max hitscan range. */
  farDamageMultiplier: number;
}

const RIFLE: WeaponArchetype = {
  itemId: 'rifle_01',
  displayName: 'Assault rifle',
  roleLabel: 'MID-RANGE · CONTROL',
  magazineSize: 30,
  fireMode: 'auto',
  fireRateMs: 150,
  hitscanDamage: 25,
  reloadDurationMs: 1800,
  pelletCount: 1,
  spread: 0.012,
  hitscanRange: 90,
  viewportMesh: { width: 0.085, height: 0.095, depth: 0.52 },
  viewportTintRgb: [0.12, 0.12, 0.14],
  viewportEmissiveRgb: [0.04, 0.09, 0.12],
  recoilScale: 1,
  optimalRangeMeters: 24,
  closeDamageMultiplier: 1.08,
  farDamageMultiplier: 0.62,
};

const SHOTGUN: WeaponArchetype = {
  itemId: 'shotgun_01',
  displayName: 'Pump shotgun',
  roleLabel: 'CQB · BURST',
  magazineSize: 8,
  fireMode: 'semi',
  fireRateMs: 800,
  hitscanDamage: 15,
  reloadDurationMs: 2200,
  pelletCount: 6,
  spread: 0.12,
  hitscanRange: 36,
  viewportMesh: { width: 0.125, height: 0.12, depth: 0.4 },
  viewportTintRgb: [0.14, 0.1, 0.07],
  viewportEmissiveRgb: [0.06, 0.04, 0.02],
  recoilScale: 1.38,
  optimalRangeMeters: 7,
  closeDamageMultiplier: 1.34,
  farDamageMultiplier: 0.18,
};

const PULSE: WeaponArchetype = {
  itemId: 'pulse_rifle',
  displayName: 'Pulse rifle',
  roleLabel: 'HIGH ROF · SHRED',
  magazineSize: 60,
  fireMode: 'auto',
  fireRateMs: 80,
  hitscanDamage: 12,
  reloadDurationMs: 2000,
  pelletCount: 1,
  spread: 0.018,
  hitscanRange: 76,
  viewportMesh: { width: 0.09, height: 0.085, depth: 0.46 },
  viewportTintRgb: [0.08, 0.14, 0.16],
  viewportEmissiveRgb: [0.02, 0.22, 0.28],
  recoilScale: 0.82,
  optimalRangeMeters: 18,
  closeDamageMultiplier: 1.12,
  farDamageMultiplier: 0.55,
};

const CARBINE: WeaponArchetype = {
  itemId: 'carbine_mk2',
  displayName: 'Combat carbine',
  roleLabel: 'LONG-RANGE · PRECISION',
  magazineSize: 25,
  fireMode: 'semi',
  fireRateMs: 200,
  hitscanDamage: 32,
  reloadDurationMs: 1600,
  pelletCount: 1,
  spread: 0.006,
  hitscanRange: 120,
  viewportMesh: { width: 0.09, height: 0.088, depth: 0.5 },
  viewportTintRgb: [0.14, 0.13, 0.1],
  viewportEmissiveRgb: [0.05, 0.06, 0.08],
  recoilScale: 1.15,
  optimalRangeMeters: 30,
  closeDamageMultiplier: 1.02,
  farDamageMultiplier: 0.74,
};

export const WEAPON_ARCHETYPES: Record<PrimaryWeaponItemId, WeaponArchetype> = {
  rifle_01: RIFLE,
  shotgun_01: SHOTGUN,
  pulse_rifle: PULSE,
  carbine_mk2: CARBINE,
};

const MIN_HITSCAN_DAMAGE = 1;
const MAX_HITSCAN_DAMAGE = 500;
const MIN_FIRE_RATE_MS = 40;
const MAX_FIRE_RATE_MS = 2500;

/** Ship armory — credits; starter save already includes a rifle in stash. */
export const ARMORY_PRIMARY_OFFERS: readonly { itemId: PrimaryWeaponItemId; credits: number }[] = [
  { itemId: 'rifle_01', credits: 60 },
  { itemId: 'shotgun_01', credits: 110 },
  { itemId: 'carbine_mk2', credits: 150 },
  { itemId: 'pulse_rifle', credits: 210 },
];

export function getWeaponArchetype(itemId: string): WeaponArchetype {
  if (isPrimaryWeaponItemId(itemId)) return WEAPON_ARCHETYPES[itemId];
  return RIFLE;
}

export function applyWeaponLootMods(
  archetype: WeaponArchetype,
  mods: WeaponLootMods | null | undefined
): { damage: number; fireRateMs: number } {
  let damage = archetype.hitscanDamage;
  let fireRateMs = archetype.fireRateMs;

  const clampFinite = (value: number, min: number, max: number, fallback: number): number => {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, value));
  };

  if (!mods) {
    return {
      damage: clampFinite(damage, MIN_HITSCAN_DAMAGE, MAX_HITSCAN_DAMAGE, archetype.hitscanDamage),
      fireRateMs: clampFinite(fireRateMs, MIN_FIRE_RATE_MS, MAX_FIRE_RATE_MS, archetype.fireRateMs),
    };
  }
  if (mods.damageMod != null) damage *= mods.damageMod;
  if (mods.fireRateMod != null) fireRateMs *= mods.fireRateMod;
  return {
    damage: clampFinite(damage, MIN_HITSCAN_DAMAGE, MAX_HITSCAN_DAMAGE, archetype.hitscanDamage),
    fireRateMs: clampFinite(fireRateMs, MIN_FIRE_RATE_MS, MAX_FIRE_RATE_MS, archetype.fireRateMs),
  };
}

export function computeReloadTransfer(
  currentMag: number,
  maxMag: number,
  reserve: number
): { newMag: number; newReserve: number } {
  const cappedMag = Math.max(0, Math.min(currentMag, maxMag));
  const needed = maxMag - cappedMag;
  const toReload = Math.min(needed, Math.max(0, reserve));
  return {
    newMag: cappedMag + toReload,
    newReserve: Math.max(0, reserve - toReload),
  };
}

export function weaponReloadBlockedReason(
  reloading: boolean,
  currentMag: number,
  maxMag: number,
  reserve: number
): 'reloading' | 'full' | 'no_reserve' | null {
  if (reloading) return 'reloading';
  if (currentMag >= maxMag) return 'full';
  if (reserve <= 0) return 'no_reserve';
  return null;
}

/** Distance damage curve: higher pressure in close quarters, lower lethality at long range. */
export function computeDamageAtDistance(
  archetype: WeaponArchetype,
  baseDamage: number,
  distance: number
): number {
  const damage = Math.max(MIN_HITSCAN_DAMAGE, baseDamage);
  const d = Math.max(0, distance);
  const optimal = Math.max(0.1, archetype.optimalRangeMeters);
  const maxRange = Math.max(optimal + 0.1, archetype.hitscanRange);
  const closeMul = Math.max(archetype.closeDamageMultiplier, archetype.farDamageMultiplier);
  const farMul = Math.min(archetype.closeDamageMultiplier, archetype.farDamageMultiplier);

  let scale = 1;
  if (d <= optimal) {
    const t = d / optimal;
    scale = closeMul + (1 - closeMul) * t;
  } else {
    const t = Math.min(1, (d - optimal) / (maxRange - optimal));
    scale = 1 + (farMul - 1) * t;
  }

  return Math.max(MIN_HITSCAN_DAMAGE, Math.round(damage * scale));
}

/** Short onboarding line for raid STATUS block */
export function getWeaponRaidHudHint(itemId: string): string {
  const a = getWeaponArchetype(itemId);
  const magFlow =
    a.pelletCount > 1
      ? `${a.pelletCount} pellets — tight indoors, falls off at range`
      : a.fireMode === 'semi'
        ? 'Click per shot — control cadence and spacing'
        : a.fireRateMs < 100
        ? 'Tap or hold — burns ammo fast'
        : 'Tap or hold — steady at medium range';
  return `${a.roleLabel} · ${a.displayName}. ${magFlow}. R loads magazine from reserves (${a.reloadDurationMs / 1000}s).`;
}
