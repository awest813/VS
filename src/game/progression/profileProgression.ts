import type { WeaponLootMods } from '../weapons/weaponDefinitions';
import { getSuitArchetype, type SuitClassId } from '../player/suitDefinitions';

export interface PersistentUpgradeState {
  weaponDamageTier: number;
  weaponHandlingTier: number;
  armorPlatingTier: number;
  servoAssistTier: number;
  batteryPackTier: number;
}

export const DEFAULT_UPGRADE_STATE: PersistentUpgradeState = {
  weaponDamageTier: 0,
  weaponHandlingTier: 0,
  armorPlatingTier: 0,
  servoAssistTier: 0,
  batteryPackTier: 0,
};

export type UpgradeField = keyof PersistentUpgradeState;

export interface UpgradeOffer {
  id: UpgradeField;
  label: string;
  category: 'weapon' | 'armor';
  description: string;
  effectSummary: string;
  cost: number;
  maxLevel: number;
  unlockAfterCompleted: number;
}

export const ARMORY_UPGRADE_OFFERS: readonly UpgradeOffer[] = [
  {
    id: 'weaponDamageTier',
    label: 'Ballistics Uplink',
    category: 'weapon',
    description: 'Tightens calibration across issued primaries for harder hits.',
    effectSummary: '+12% weapon damage / level',
    cost: 180,
    maxLevel: 2,
    unlockAfterCompleted: 1,
  },
  {
    id: 'weaponHandlingTier',
    label: 'Cycle Tuner',
    category: 'weapon',
    description: 'Refits the feed timing on quartermaster weapons for faster follow-up shots.',
    effectSummary: '+8% fire cadence / level',
    cost: 220,
    maxLevel: 2,
    unlockAfterCompleted: 2,
  },
  {
    id: 'armorPlatingTier',
    label: 'Composite Plating',
    category: 'armor',
    description: 'Adds layered suit armor to keep you upright during longer contracts.',
    effectSummary: '+25 max health / level',
    cost: 240,
    maxLevel: 2,
    unlockAfterCompleted: 2,
  },
  {
    id: 'servoAssistTier',
    label: 'Servo Weave',
    category: 'armor',
    description: 'Reinforces the undersuit so sprinting and jump recovery hold longer.',
    effectSummary: '+15 max stamina / level',
    cost: 190,
    maxLevel: 2,
    unlockAfterCompleted: 3,
  },
  {
    id: 'batteryPackTier',
    label: 'High-Capacity Cell',
    category: 'armor',
    description: 'Installs a denser power cell so the flashlight runs longer before needing recharge.',
    effectSummary: '+25 max battery / level',
    cost: 160,
    maxLevel: 2,
    unlockAfterCompleted: 2,
  },
] as const;

export function normalizeUpgradeState(
  record: Partial<PersistentUpgradeState> | null | undefined
): PersistentUpgradeState {
  return {
    weaponDamageTier: Math.max(0, record?.weaponDamageTier ?? 0),
    weaponHandlingTier: Math.max(0, record?.weaponHandlingTier ?? 0),
    armorPlatingTier: Math.max(0, record?.armorPlatingTier ?? 0),
    servoAssistTier: Math.max(0, record?.servoAssistTier ?? 0),
    batteryPackTier: Math.max(0, record?.batteryPackTier ?? 0),
  };
}

export function applyArmorUpgradeBonuses(
  state: PersistentUpgradeState,
  suitClassId: SuitClassId = 'pathfinder'
): {
  maxHealth: number;
  maxStamina: number;
  maxBattery: number;
  speedMultiplier: number;
  jumpMultiplier: number;
  staminaRegenMultiplier: number;
  batteryRechargeMultiplier: number;
} {
  const upgrades = normalizeUpgradeState(state);
  const suit = getSuitArchetype(suitClassId);

  return {
    maxHealth: suit.baseHealth + upgrades.armorPlatingTier * 25,
    maxStamina: suit.baseStamina + upgrades.servoAssistTier * 15,
    maxBattery: suit.baseBattery + upgrades.batteryPackTier * 25,
    speedMultiplier: suit.speedMultiplier,
    jumpMultiplier: suit.jumpMultiplier,
    staminaRegenMultiplier: suit.staminaRegenMultiplier,
    batteryRechargeMultiplier: suit.batteryRechargeMultiplier,
  };
}

export function combineWeaponUpgradeMods(
  lootMods: WeaponLootMods | null | undefined,
  state: PersistentUpgradeState
): WeaponLootMods {
  const upgrades = normalizeUpgradeState(state);
  return {
    damageMod: (lootMods?.damageMod ?? 1) * (1 + upgrades.weaponDamageTier * 0.12),
    fireRateMod: (lootMods?.fireRateMod ?? 1) * Math.max(0.65, 1 - upgrades.weaponHandlingTier * 0.08),
  };
}

export function getUpgradeLevel(
  state: PersistentUpgradeState,
  field: UpgradeField
): number {
  return normalizeUpgradeState(state)[field];
}

export function isUpgradeUnlocked(
  completedContractCount: number,
  offer: Pick<UpgradeOffer, 'unlockAfterCompleted'>
): boolean {
  return completedContractCount >= offer.unlockAfterCompleted;
}
