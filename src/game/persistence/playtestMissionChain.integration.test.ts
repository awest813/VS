/**
 * Multi-mission playtest: simulates a new operative playing through all five
 * contracts in unlock order from a fresh save, verifying credits, payout
 * results, and contract state at every checkpoint.
 *
 * Depends on fake-indexeddb (vitest.setup.ts).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { db } from './SaveDB';
import { mergeAmmoForShipExtract } from './raidExtract';
import { persistStationRaidExtract } from './stationRaidPersist';
import {
  BLACK_SITE_BEACON_CONTRACT_TITLE,
  PLANET_BEACON_CONTRACT_TITLE,
  SALVAGER_SWEEP_CONTRACT_TITLE,
  SALVAGER_SWEEP_KILLS_REQUIRED,
  STATION_DEBRIS_CONTRACT_TITLE,
  STATION_DEBRIS_KILLS_REQUIRED,
  SURVEY_DRIVE_CONTRACT_TITLE,
  isContractUnlocked,
} from '../contracts/contractRules';

async function wipeAndSeed() {
  await db.transaction('rw', db.playerProfile, db.stashItems, db.contracts, async () => {
    await db.playerProfile.clear();
    await db.stashItems.clear();
    await db.contracts.clear();
  });
  await db.initializeDefault();
}

async function activateContract(title: string) {
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

async function completedContractCount(): Promise<number> {
  return db.contracts.filter((c) => c.isCompleted).count();
}

describe('Playtest: full five-mission chain (integration)', () => {
  beforeEach(async () => {
    await wipeAndSeed();
  });

  it('fresh save starts at $1000 with the first contract active', async () => {
    expect(await profileMoney()).toBe(1000);
    expect(await completedContractCount()).toBe(0);
    const contracts = await db.contracts.toArray();
    expect(contracts.some((c) => c.isActive && c.title === SURVEY_DRIVE_CONTRACT_TITLE)).toBe(true);
  });

  it('plays through all five missions in unlock order and accumulates full payout', async () => {
    // --- Mission 1: Recover Survey Drive (station chain, $750) ---
    {
      // Contract 1 is auto-active on a fresh save — no manual activation needed.
      const result = await persistStationRaidExtract({
        inventory: mergeAmmoForShipExtract([{ itemId: 'survey_drive', quantity: 1 }], 0, 0),
        stationKillsSinceDock: 0,
      });
      expect(result.paidContractTitle).toBe(SURVEY_DRIVE_CONTRACT_TITLE);
      expect(result.paidContractReward).toBe(750);
      expect(await profileMoney()).toBe(1750);
      const completed = await completedContractCount();
      expect(completed).toBe(1);
      expect(isContractUnlocked(STATION_DEBRIS_CONTRACT_TITLE, completed)).toBe(true);
    }

    // --- Mission 2: Clear Station Debris (station chain, $300) ---
    {
      await activateContract(STATION_DEBRIS_CONTRACT_TITLE);
      const result = await persistStationRaidExtract({
        inventory: mergeAmmoForShipExtract([], 0, 0),
        stationKillsSinceDock: STATION_DEBRIS_KILLS_REQUIRED,
      });
      expect(result.paidContractTitle).toBe(STATION_DEBRIS_CONTRACT_TITLE);
      expect(result.paidContractReward).toBe(300);
      expect(await profileMoney()).toBe(2050);
      const completed = await completedContractCount();
      expect(completed).toBe(2);
      expect(isContractUnlocked(PLANET_BEACON_CONTRACT_TITLE, completed)).toBe(true);
    }

    // --- Mission 3: Recover Beacon Core (planet, $600) ---
    {
      await activateContract(PLANET_BEACON_CONTRACT_TITLE);
      const result = await persistStationRaidExtract({
        inventory: mergeAmmoForShipExtract([{ itemId: 'beacon_core', quantity: 1 }], 0, 0),
        stationKillsSinceDock: 0,
      });
      expect(result.paidContractTitle).toBe(PLANET_BEACON_CONTRACT_TITLE);
      expect(result.paidContractReward).toBe(600);
      expect(await profileMoney()).toBe(2650);
      const completed = await completedContractCount();
      expect(completed).toBe(3);
      expect(isContractUnlocked(SALVAGER_SWEEP_CONTRACT_TITLE, completed)).toBe(true);
    }

    // --- Mission 4: Sweep Salvager Boarding Party (station chain, $950) ---
    {
      await activateContract(SALVAGER_SWEEP_CONTRACT_TITLE);
      const result = await persistStationRaidExtract({
        inventory: mergeAmmoForShipExtract([], 0, 0),
        stationKillsSinceDock: SALVAGER_SWEEP_KILLS_REQUIRED,
      });
      expect(result.paidContractTitle).toBe(SALVAGER_SWEEP_CONTRACT_TITLE);
      expect(result.paidContractReward).toBe(950);
      expect(await profileMoney()).toBe(3600);
      const completed = await completedContractCount();
      expect(completed).toBe(4);
      expect(isContractUnlocked(BLACK_SITE_BEACON_CONTRACT_TITLE, completed)).toBe(true);
    }

    // --- Mission 5: Recover Black Site Beacon (planet, $1400) ---
    {
      await activateContract(BLACK_SITE_BEACON_CONTRACT_TITLE);
      const result = await persistStationRaidExtract({
        inventory: mergeAmmoForShipExtract([{ itemId: 'beacon_core', quantity: 1 }], 0, 0),
        stationKillsSinceDock: 0,
      });
      expect(result.paidContractTitle).toBe(BLACK_SITE_BEACON_CONTRACT_TITLE);
      expect(result.paidContractReward).toBe(1400);
      expect(await profileMoney()).toBe(5000);
      expect(await completedContractCount()).toBe(5);
    }

    // All contracts are completed and none remain active.
    const allContracts = await db.contracts.toArray();
    expect(allContracts.every((c) => c.isCompleted)).toBe(true);
    expect(allContracts.every((c) => !c.isActive)).toBe(true);
  });

  it('incomplete runs do not pay out or advance the active contract', async () => {
    // Mission 1 without the drive — no payout, contract stays open.
    const result = await persistStationRaidExtract({
      inventory: mergeAmmoForShipExtract([{ itemId: 'scrap_metal', quantity: 3 }], 0, 0),
      stationKillsSinceDock: 0,
    });
    expect(result.paidContractTitle).toBeNull();
    expect(result.paidContractReward).toBe(0);
    expect(await profileMoney()).toBe(1000);
    expect(await completedContractCount()).toBe(0);

    const c = (await db.contracts.toArray()).find((r) => r.title === SURVEY_DRIVE_CONTRACT_TITLE);
    expect(c?.isCompleted).toBe(false);
    expect(c?.isActive).toBe(true);
  });

  it('kill-threshold missions do not pay out below the required count', async () => {
    // Reach mission 2 by completing mission 1 first.
    await persistStationRaidExtract({
      inventory: mergeAmmoForShipExtract([{ itemId: 'survey_drive', quantity: 1 }], 0, 0),
      stationKillsSinceDock: 0,
    });
    await activateContract(STATION_DEBRIS_CONTRACT_TITLE);

    // One kill short — no payout.
    const result = await persistStationRaidExtract({
      inventory: mergeAmmoForShipExtract([], 0, 0),
      stationKillsSinceDock: STATION_DEBRIS_KILLS_REQUIRED - 1,
    });
    expect(result.paidContractTitle).toBeNull();
    expect(result.paidContractReward).toBe(0);
    // Money stayed at post-mission-1 level.
    expect(await profileMoney()).toBe(1750);
    expect(await completedContractCount()).toBe(1);
  });

  it('later contracts are locked until the required missions are completed', async () => {
    expect(isContractUnlocked(STATION_DEBRIS_CONTRACT_TITLE, 0)).toBe(false);
    expect(isContractUnlocked(PLANET_BEACON_CONTRACT_TITLE, 1)).toBe(false);
    expect(isContractUnlocked(SALVAGER_SWEEP_CONTRACT_TITLE, 2)).toBe(false);
    expect(isContractUnlocked(BLACK_SITE_BEACON_CONTRACT_TITLE, 3)).toBe(false);

    expect(isContractUnlocked(STATION_DEBRIS_CONTRACT_TITLE, 1)).toBe(true);
    expect(isContractUnlocked(PLANET_BEACON_CONTRACT_TITLE, 2)).toBe(true);
    expect(isContractUnlocked(SALVAGER_SWEEP_CONTRACT_TITLE, 3)).toBe(true);
    expect(isContractUnlocked(BLACK_SITE_BEACON_CONTRACT_TITLE, 4)).toBe(true);
  });
});
