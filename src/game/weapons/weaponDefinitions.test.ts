import { describe, expect, it } from 'vitest';
import {
  applyWeaponLootMods,
  computeDamageAtDistance,
  computeReloadTransfer,
  getWeaponArchetype,
  getWeaponRaidHudHint,
  isPrimaryWeaponItemId,
  PRIMARY_WEAPON_ITEM_IDS,
  weaponReloadBlockedReason,
  WEAPON_ARCHETYPES,
} from './weaponDefinitions';

describe('weaponDefinitions', () => {
  it('isPrimaryWeaponItemId', () => {
    expect(isPrimaryWeaponItemId('rifle_01')).toBe(true);
    expect(isPrimaryWeaponItemId('medkit')).toBe(false);
  });

  it('getWeaponArchetype falls back to rifle', () => {
    const a = getWeaponArchetype('unknown');
    expect(a.itemId).toBe('rifle_01');
    expect(a).toBe(WEAPON_ARCHETYPES.rifle_01);
  });

  it('applyWeaponLootMods', () => {
    const base = WEAPON_ARCHETYPES.rifle_01;
    expect(applyWeaponLootMods(base, null)).toEqual({ damage: 25, fireRateMs: 150 });
    expect(applyWeaponLootMods(base, { damageMod: 2, fireRateMod: 0.5 })).toEqual({
      damage: 50,
      fireRateMs: 75,
    });
  });

  it('applyWeaponLootMods clamps invalid combat tuning', () => {
    const base = WEAPON_ARCHETYPES.rifle_01;
    expect(applyWeaponLootMods(base, { damageMod: -10, fireRateMod: 0 })).toEqual({
      damage: 1,
      fireRateMs: 40,
    });
    expect(
      applyWeaponLootMods(base, {
        damageMod: Number.POSITIVE_INFINITY,
        fireRateMod: Number.NaN,
      })
    ).toEqual({
      damage: 25,
      fireRateMs: 150,
    });
  });

  it('computeReloadTransfer', () => {
    expect(computeReloadTransfer(10, 30, 50)).toEqual({ newMag: 30, newReserve: 30 });
    expect(computeReloadTransfer(30, 30, 99)).toEqual({ newMag: 30, newReserve: 99 });
    expect(computeReloadTransfer(28, 30, 1)).toEqual({ newMag: 29, newReserve: 0 });
    expect(computeReloadTransfer(-6, 30, -5)).toEqual({ newMag: 0, newReserve: 0 });
  });

  it('getWeaponRaidHudHint exposes loud role labels', () => {
    expect(getWeaponRaidHudHint('rifle_01')).toContain('MID-RANGE');
    expect(getWeaponRaidHudHint('shotgun_01')).toContain('CQB');
    expect(getWeaponRaidHudHint('pulse_rifle')).toContain('HIGH ROF');
  });

  it('every primary archetype defines viewport + recoil for FPS placeholder mesh', () => {
    for (const id of PRIMARY_WEAPON_ITEM_IDS) {
      const a = WEAPON_ARCHETYPES[id];
      expect(a.viewportMesh.depth).toBeGreaterThan(0.2);
      expect(a.recoilScale).toBeGreaterThan(0);
      expect(['auto', 'semi']).toContain(a.fireMode);
      expect(a.optimalRangeMeters).toBeGreaterThan(0);
      expect(a.farDamageMultiplier).toBeLessThanOrEqual(1);
    }
  });

  it('computeDamageAtDistance favors close-range pressure and long-range falloff', () => {
    const shotgun = WEAPON_ARCHETYPES.shotgun_01;
    const close = computeDamageAtDistance(shotgun, shotgun.hitscanDamage, 1);
    const mid = computeDamageAtDistance(shotgun, shotgun.hitscanDamage, shotgun.optimalRangeMeters);
    const far = computeDamageAtDistance(shotgun, shotgun.hitscanDamage, shotgun.hitscanRange);
    expect(close).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);

    const rifle = WEAPON_ARCHETYPES.rifle_01;
    const rifleClose = computeDamageAtDistance(rifle, rifle.hitscanDamage, 0);
    const rifleFar = computeDamageAtDistance(rifle, rifle.hitscanDamage, rifle.hitscanRange);
    expect(rifleClose).toBeGreaterThan(rifleFar);
  });

  it('shotgun is semi-auto while rifle/pulse remain automatic', () => {
    expect(WEAPON_ARCHETYPES.shotgun_01.fireMode).toBe('semi');
    expect(WEAPON_ARCHETYPES.rifle_01.fireMode).toBe('auto');
    expect(WEAPON_ARCHETYPES.pulse_rifle.fireMode).toBe('auto');
  });

  it('weaponReloadBlockedReason', () => {
    expect(weaponReloadBlockedReason(true, 0, 30, 30)).toBe('reloading');
    expect(weaponReloadBlockedReason(false, 30, 30, 30)).toBe('full');
    expect(weaponReloadBlockedReason(false, 5, 30, 0)).toBe('no_reserve');
    expect(weaponReloadBlockedReason(false, 5, 30, 10)).toBe(null);
  });
});
