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
      })
    ).toEqual({
      maxHealth: 150,
      maxStamina: 115,
      maxBattery: 100,
    });
  });

  it('stacks persistent weapon upgrades with loot mods', () => {
    expect(
      combineWeaponUpgradeMods(
        { damageMod: 1.1, fireRateMod: 0.9 },
        { ...DEFAULT_UPGRADE_STATE, weaponDamageTier: 1, weaponHandlingTier: 2 }
      )
    ).toEqual({
      damageMod: 1.2320000000000002,
      fireRateMod: 0.7560000000000001,
    });
  });

  it('reports upgrade level and unlock thresholds', () => {
    const offer = ARMORY_UPGRADE_OFFERS[0];
    expect(getUpgradeLevel(DEFAULT_UPGRADE_STATE, offer.id)).toBe(0);
    expect(isUpgradeUnlocked(0, offer)).toBe(false);
    expect(isUpgradeUnlocked(offer.unlockAfterCompleted, offer)).toBe(true);
  });
});
