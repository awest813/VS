/**
 * Canonical primary weapon configs and pure helpers shared by HUD, loot tables,
 * persistence flow, and WeaponController runtime.
 */

export type PrimaryWeaponItemId =
  | 'rifle_01'
  | 'shotgun_01'
  | 'pulse_rifle'
  | 'carbine_mk2'
  | 'thermal_lance'
  | 'void_disruptor'
  | 'smg_flechette'
  | 'slug_cannon'
  | 'pistol_std'
  | 'revolver_454'
  | 'pulse_compact';

export const PRIMARY_WEAPON_ITEM_IDS: readonly PrimaryWeaponItemId[] = [
  'rifle_01',
  'shotgun_01',
  'pulse_rifle',
  'carbine_mk2',
  'thermal_lance',
  'void_disruptor',
  'smg_flechette',
  'slug_cannon',
  'pistol_std',
  'revolver_454',
  'pulse_compact',
] as const;

export type AmmoItemId =
  | 'ammo_9mm'
  | 'ammo_556'
  | 'ammo_762_ap'
  | 'ammo_12g'
  | 'ammo_20g_slug'
  | 'pulse_cell'
  | 'thermal_cell'
  | 'void_charge'
  | 'ammo_454_mag';

export const AMMO_ITEM_IDS: readonly AmmoItemId[] = [
  'ammo_9mm',
  'ammo_556',
  'ammo_762_ap',
  'ammo_12g',
  'ammo_20g_slug',
  'pulse_cell',
  'thermal_cell',
  'void_charge',
  'ammo_454_mag',
] as const;

export function isAmmoItemId(id: string): id is AmmoItemId {
  return (AMMO_ITEM_IDS as readonly string[]).includes(id);
}

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
  ammoItemId: AmmoItemId;
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
  ammoItemId: 'ammo_556',
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
  ammoItemId: 'ammo_12g',
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
  ammoItemId: 'pulse_cell',
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
  ammoItemId: 'ammo_762_ap',
  viewportMesh: { width: 0.09, height: 0.088, depth: 0.5 },
  viewportTintRgb: [0.14, 0.13, 0.1],
  viewportEmissiveRgb: [0.05, 0.06, 0.08],
  recoilScale: 1.15,
  optimalRangeMeters: 30,
  closeDamageMultiplier: 1.02,
  farDamageMultiplier: 0.74,
};

const THERMAL_LANCE: WeaponArchetype = {
  itemId: 'thermal_lance',
  displayName: 'Thermal lance',
  roleLabel: 'ANTI-ARMOR · CHARGE',
  magazineSize: 4,
  fireMode: 'semi', // Charge logic handled in controller
  fireRateMs: 2400,
  hitscanDamage: 240,
  reloadDurationMs: 3000,
  pelletCount: 1,
  spread: 0.002,
  hitscanRange: 50,
  ammoItemId: 'thermal_cell',
  viewportMesh: { width: 0.1, height: 0.1, depth: 0.6 },
  viewportTintRgb: [0.2, 0.1, 0.05],
  viewportEmissiveRgb: [0.4, 0.2, 0.0],
  recoilScale: 2.5,
  optimalRangeMeters: 40,
  closeDamageMultiplier: 1.0,
  farDamageMultiplier: 0.8,
};

const VOID_DISRUPTOR: WeaponArchetype = {
  itemId: 'void_disruptor',
  displayName: 'Void disruptor',
  roleLabel: 'ANOMALY · BURST',
  magazineSize: 18,
  fireMode: 'semi',
  fireRateMs: 600,
  hitscanDamage: 22,
  reloadDurationMs: 2500,
  pelletCount: 3,
  spread: 0.05,
  hitscanRange: 40,
  ammoItemId: 'void_charge',
  viewportMesh: { width: 0.11, height: 0.11, depth: 0.45 },
  viewportTintRgb: [0.1, 0.05, 0.15],
  viewportEmissiveRgb: [0.25, 0.1, 0.45],
  recoilScale: 1.2,
  optimalRangeMeters: 20,
  closeDamageMultiplier: 1.2,
  farDamageMultiplier: 0.5,
};

const SMG_FLECHETTE: WeaponArchetype = {
  itemId: 'smg_flechette',
  displayName: 'Flechette SMG',
  roleLabel: 'FAST ADS · CLEAR',
  magazineSize: 40,
  fireMode: 'auto',
  fireRateMs: 100,
  hitscanDamage: 18,
  reloadDurationMs: 1400,
  pelletCount: 1,
  spread: 0.025,
  hitscanRange: 30,
  ammoItemId: 'ammo_9mm',
  viewportMesh: { width: 0.07, height: 0.08, depth: 0.35 },
  viewportTintRgb: [0.1, 0.1, 0.12],
  viewportEmissiveRgb: [0.05, 0.05, 0.06],
  recoilScale: 0.6,
  optimalRangeMeters: 12,
  closeDamageMultiplier: 1.15,
  farDamageMultiplier: 0.3,
};

const SLUG_CANNON: WeaponArchetype = {
  itemId: 'slug_cannon',
  displayName: 'Slug cannon',
  roleLabel: 'STAGGER · LOUD',
  magazineSize: 5,
  fireMode: 'semi',
  fireRateMs: 1200,
  hitscanDamage: 90,
  reloadDurationMs: 3500,
  pelletCount: 1,
  spread: 0.008,
  hitscanRange: 60,
  ammoItemId: 'ammo_20g_slug',
  viewportMesh: { width: 0.14, height: 0.15, depth: 0.55 },
  viewportTintRgb: [0.15, 0.15, 0.15],
  viewportEmissiveRgb: [0.1, 0.1, 0.1],
  recoilScale: 3.2,
  optimalRangeMeters: 25,
  closeDamageMultiplier: 1.25,
  farDamageMultiplier: 0.45,
};

const PISTOL_STD: WeaponArchetype = {
  itemId: 'pistol_std',
  displayName: 'Station pistol',
  roleLabel: 'EMERGENCY · BACKUP',
  magazineSize: 12,
  fireMode: 'semi',
  fireRateMs: 350,
  hitscanDamage: 20,
  reloadDurationMs: 1200,
  pelletCount: 1,
  spread: 0.015,
  hitscanRange: 45,
  ammoItemId: 'ammo_9mm',
  viewportMesh: { width: 0.05, height: 0.07, depth: 0.22 },
  viewportTintRgb: [0.12, 0.12, 0.14],
  viewportEmissiveRgb: [0.02, 0.03, 0.04],
  recoilScale: 0.8,
  optimalRangeMeters: 15,
  closeDamageMultiplier: 1.1,
  farDamageMultiplier: 0.5,
};

const REVOLVER_454: WeaponArchetype = {
  itemId: 'revolver_454',
  displayName: 'Heavy revolver',
  roleLabel: 'HIGH DAMAGE · STAGGER',
  magazineSize: 6,
  fireMode: 'semi',
  fireRateMs: 500,
  hitscanDamage: 55,
  reloadDurationMs: 2800,
  pelletCount: 1,
  spread: 0.01,
  hitscanRange: 55,
  ammoItemId: 'ammo_454_mag',
  viewportMesh: { width: 0.06, height: 0.08, depth: 0.28 },
  viewportTintRgb: [0.18, 0.16, 0.14],
  viewportEmissiveRgb: [0.08, 0.04, 0.02],
  recoilScale: 2.2,
  optimalRangeMeters: 20,
  closeDamageMultiplier: 1.2,
  farDamageMultiplier: 0.6,
};

const PULSE_COMPACT: WeaponArchetype = {
  itemId: 'pulse_compact',
  displayName: 'Compact pulse',
  roleLabel: 'LIGHTWEIGHT · ANOMALY',
  magazineSize: 20,
  fireMode: 'semi',
  fireRateMs: 300,
  hitscanDamage: 16,
  reloadDurationMs: 1500,
  pelletCount: 1,
  spread: 0.02,
  hitscanRange: 50,
  ammoItemId: 'pulse_cell',
  viewportMesh: { width: 0.055, height: 0.075, depth: 0.25 },
  viewportTintRgb: [0.06, 0.12, 0.14],
  viewportEmissiveRgb: [0.01, 0.18, 0.22],
  recoilScale: 0.7,
  optimalRangeMeters: 15,
  closeDamageMultiplier: 1.1,
  farDamageMultiplier: 0.6,
};

export const WEAPON_ARCHETYPES: Record<PrimaryWeaponItemId, WeaponArchetype> = {
  rifle_01: RIFLE,
  shotgun_01: SHOTGUN,
  pulse_rifle: PULSE,
  carbine_mk2: CARBINE,
  thermal_lance: THERMAL_LANCE,
  void_disruptor: VOID_DISRUPTOR,
  smg_flechette: SMG_FLECHETTE,
  slug_cannon: SLUG_CANNON,
  pistol_std: PISTOL_STD,
  revolver_454: REVOLVER_454,
  pulse_compact: PULSE_COMPACT,
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
  { itemId: 'smg_flechette', credits: 180 },
  { itemId: 'revolver_454', credits: 140 },
  { itemId: 'thermal_lance', credits: 450 },
  { itemId: 'void_disruptor', credits: 380 },
  { itemId: 'slug_cannon', credits: 320 },
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
