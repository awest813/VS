import { describe, expect, it } from 'vitest';
import {
  ARMORY_UPGRADE_OFFERS,
  applyArmorUpgradeBonuses,
  combineWeaponUpgradeMods,
  DEFAULT_UPGRADE_STATE,
  getUpgradeLevel,
  isUpgradeUnlocked,
  normalizeUpgradeState,
} from './profileProgression';

describe('profileProgression', () => {
  it('normalizes missing upgrade fields', () => {
    expect(normalizeUpgradeState(null)).toEqual(DEFAULT_UPGRADE_STATE);
    expect(normalizeUpgradeState({ weaponDamageTier: 2, servoAssistTier: 1 })).toEqual({
      weaponDamageTier: 2,
      weaponHandlingTier: 0,
      armorPlatingTier: 0,
      servoAssistTier: 1,
      batteryPackTier: 0,
    });
  });

  it('applies armor upgrades to health and stamina pools', () => {
    expect(applyArmorUpgradeBonuses(DEFAULT_UPGRADE_STATE)).toEqual({
      maxHealth: 100,
      maxStamina: 100,
      maxBattery: 100,
    });
    expect(
      applyArmorUpgradeBonuses({
        ...DEFAULT_UPGRADE_STATE,
        armorPlatingTier: 2,
        servoAssistTier: 1,
        batteryPackTier: 1,
      })
    ).toEqual({
      maxHealth: 150,
      maxStamina: 115,
      maxBattery: 125,
    });
  });

  it('stacks persistent weapon upgrades with loot mods', () => {
    const mods = combineWeaponUpgradeMods(
      { damageMod: 1.1, fireRateMod: 0.9 },
      { ...DEFAULT_UPGRADE_STATE, weaponDamageTier: 1, weaponHandlingTier: 2 }
    );
    expect(mods.damageMod).toBeCloseTo(1.232);
    expect(mods.fireRateMod).toBeCloseTo(0.756);
  });

  it('reports upgrade level and unlock thresholds', () => {
    const offer = ARMORY_UPGRADE_OFFERS[0];
    expect(getUpgradeLevel(DEFAULT_UPGRADE_STATE, offer.id)).toBe(0);
    expect(isUpgradeUnlocked(0, offer)).toBe(false);
    expect(isUpgradeUnlocked(offer.unlockAfterCompleted, offer)).toBe(true);
  });
});
