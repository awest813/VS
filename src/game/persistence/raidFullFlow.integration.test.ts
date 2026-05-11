/**
 * IndexedDB-backed integration path: mimics docking prep → raid backpack → station green extract payout.
 * Depends on fake-indexeddb (vitest.setup.ts).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { db } from './SaveDB';
import { mergeAmmoForShipExtract } from './raidExtract';
import { persistStationRaidExtract } from './stationRaidPersist';
import { DEFAULT_UPGRADE_STATE } from '../progression/profileProgression';
import {
  STATION_DEBRIS_CONTRACT_TITLE,
  STATION_DEBRIS_KILLS_REQUIRED,
  SURVEY_DRIVE_CONTRACT_TITLE,
} from '../contracts/contractRules';
import { isPrimaryWeaponItemId } from '../weapons/weaponDefinitions';

async function wipeAndSeed() {
  await db.transaction('rw', db.playerProfile, db.stashItems, db.contracts, async () => {
    await db.playerProfile.clear();
    await db.stashItems.clear();
    await db.contracts.clear();
  });
  await db.initializeDefault();
}

async function setActiveContractByTitle(title: string) {
  await db.contracts.toCollection().modify({ isActive: false });
  const c = (await db.contracts.toArray()).find((row) => row.title === title);
  if (c?.id === undefined) throw new Error(`Missing contract: ${title}`);
  await db.contracts.update(c.id, { isActive: true });
}

async function profileMoney(): Promise<number> {
  const p = await db.playerProfile.toCollection().first();
  if (!p?.id) throw new Error('no profile');
  return p.money;
}

describe('Raid full flow (integration)', () => {
  beforeEach(async () => {
    await wipeAndSeed();
  });

  it('initializeDefault backfills canonical contracts and ensures an active open contract', async () => {
    await db.transaction('rw', db.playerProfile, db.stashItems, db.contracts, async () => {
      await db.playerProfile.clear();
      await db.stashItems.clear();
      await db.contracts.clear();
      await db.playerProfile.add({
        name: 'Legacy Operative',
        money: 500,
        reputation: 0,
        health: 100,
        ...DEFAULT_UPGRADE_STATE,
      });
    });

    await db.initializeDefault();

    const contracts = await db.contracts.toArray();
    expect(contracts.some((c) => c.title === SURVEY_DRIVE_CONTRACT_TITLE)).toBe(true);
    expect(contracts.some((c) => c.title === STATION_DEBRIS_CONTRACT_TITLE)).toBe(true);
    expect(contracts.some((c) => c.isActive && !c.isCompleted)).toBe(true);
  });

  it('initializeDefault backfills missing permanent upgrade tiers on legacy profiles', async () => {
    await db.transaction('rw', db.playerProfile, db.stashItems, db.contracts, async () => {
      await db.playerProfile.clear();
      await db.stashItems.clear();
      await db.contracts.clear();
      await db.playerProfile.add({
        name: 'Legacy Operative',
        money: 500,
        reputation: 0,
        health: 100,
      } as any);
    });

    await db.initializeDefault();

    const profile = await db.playerProfile.toCollection().first();
    expect(profile?.weaponDamageTier).toBe(0);
    expect(profile?.weaponHandlingTier).toBe(0);
    expect(profile?.armorPlatingTier).toBe(0);
    expect(profile?.servoAssistTier).toBe(0);
  });

  it('initializeDefault demotes extra staged primaries from legacy loadouts', async () => {
    await db.transaction('rw', db.playerProfile, db.stashItems, db.contracts, async () => {
      await db.playerProfile.clear();
      await db.stashItems.clear();
      await db.contracts.clear();
      await db.playerProfile.add({
        name: 'Legacy Operative',
        money: 500,
        reputation: 0,
        health: 100,
        ...DEFAULT_UPGRADE_STATE,
      });
      await db.stashItems.bulkAdd([
        { itemId: 'rifle_01', quantity: 1, slot: 'loadout' },
        { itemId: 'shotgun_01', quantity: 1, slot: 'loadout' },
        { itemId: 'ammo_9mm', quantity: 30, slot: 'loadout' },
      ]);
    });

    await db.initializeDefault();

    const loadoutItems = await db.stashItems.where('slot').equals('loadout').toArray();
    expect(loadoutItems.filter((item) => isPrimaryWeaponItemId(item.itemId))).toHaveLength(1);
    expect(loadoutItems.some((item) => item.itemId === 'ammo_9mm')).toBe(true);

    const shotgun = await db.stashItems.where('itemId').equals('shotgun_01').first();
    expect(shotgun?.slot).toBe('stash');
  });

  it('from fresh save: staged loadout merges to stash on extract without active contract payout', async () => {
    const rifle = await db.stashItems.where('itemId').equals('rifle_01').first();
    const ammoRow = await db.stashItems.where('itemId').equals('ammo_9mm').first();
    expect(rifle?.id).toBeDefined();
    await db.stashItems.update(rifle!.id!, { slot: 'loadout' });
    await db.stashItems.update(ammoRow!.id!, { slot: 'loadout', quantity: 30 });

    const moneyBefore = await profileMoney();
    const inventory = mergeAmmoForShipExtract([{ itemId: 'scrap_metal', quantity: 2 }], 12, 48);

    await persistStationRaidExtract({
      inventory,
      stationKillsSinceDock: 0,
    });

    expect(await profileMoney()).toBe(moneyBefore);
    const loadoutCount = await db.stashItems.where('slot').equals('loadout').count();
    expect(loadoutCount).toBe(0);

    const scrap = await db.stashItems
      .where('itemId')
      .equals('scrap_metal')
      .filter((r) => r.slot === 'stash' && !r.stats)
      .first();
    expect(scrap?.quantity).toBe(2);

    const ammoStash = await db.stashItems
      .where('itemId')
      .equals('ammo_9mm')
      .filter((r) => r.slot === 'stash' && !r.stats)
      .toArray();
    const ammoQty = ammoStash.reduce((s, r) => s + r.quantity, 0);
    /** Loadout-held reserve (30) + merged mag/reserve extract (60) after demotion = 90 */
    expect(ammoQty).toBeGreaterThanOrEqual(90);
  });

  it('survey drive raid: extract pays active contract when drive is in merged raid inventory', async () => {
    await setActiveContractByTitle(SURVEY_DRIVE_CONTRACT_TITLE);

    const moneyBefore = await profileMoney();
    const inventory = mergeAmmoForShipExtract([{ itemId: 'survey_drive', quantity: 1 }], 0, 0);

    const result = await persistStationRaidExtract({
      inventory,
      stationKillsSinceDock: 0,
    });

    expect(await profileMoney()).toBe(moneyBefore + 750);
    expect(result.paidContractTitle).toBe(SURVEY_DRIVE_CONTRACT_TITLE);
    expect(result.paidContractReward).toBe(750);

    const done = (await db.contracts.toArray()).find((row) => row.title === SURVEY_DRIVE_CONTRACT_TITLE);
    expect(done?.isCompleted).toBe(true);
    expect(done?.isActive).toBe(false);

    const driveInStash = await db.stashItems
      .where('itemId')
      .equals('survey_drive')
      .filter((r) => r.slot === 'stash')
      .first();
    expect(driveInStash?.quantity).toBe(1);
  });

  it('extract result reports no payout when contract goal not met', async () => {
    await setActiveContractByTitle(SURVEY_DRIVE_CONTRACT_TITLE);
    const result = await persistStationRaidExtract({
      inventory: mergeAmmoForShipExtract([{ itemId: 'scrap_metal', quantity: 1 }], 0, 0),
      stationKillsSinceDock: 0,
    });
    expect(result.paidContractTitle).toBeNull();
    expect(result.paidContractReward).toBe(0);
  });

  it('station debris raid: payout when kill threshold met; no payout below threshold', async () => {
    await setActiveContractByTitle(STATION_DEBRIS_CONTRACT_TITLE);

    const moneyBefore = await profileMoney();

    await persistStationRaidExtract({
      inventory: mergeAmmoForShipExtract([], 0, 0),
      stationKillsSinceDock: STATION_DEBRIS_KILLS_REQUIRED - 1,
    });
    expect(await profileMoney()).toBe(moneyBefore);
    let c = (await db.contracts.toArray()).find((row) => row.title === STATION_DEBRIS_CONTRACT_TITLE);
    expect(c?.isCompleted).toBe(false);

    await wipeAndSeed();
    await setActiveContractByTitle(STATION_DEBRIS_CONTRACT_TITLE);
    await persistStationRaidExtract({
      inventory: mergeAmmoForShipExtract([], 0, 0),
      stationKillsSinceDock: STATION_DEBRIS_KILLS_REQUIRED,
    });

    expect(await profileMoney()).toBe(moneyBefore + 300);
    c = (await db.contracts.toArray()).find((row) => row.title === STATION_DEBRIS_CONTRACT_TITLE);
    expect(c?.isCompleted).toBe(true);
  });
});
