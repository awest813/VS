import Dexie, { Table } from 'dexie';
import { CANONICAL_CONTRACT_SEEDS } from '../contracts/contractRules';
import { getExtraLoadoutPrimaryIds } from '../hub/loadoutRules';
import { DEFAULT_UPGRADE_STATE, normalizeUpgradeState } from '../progression/profileProgression';

export interface PlayerProfile {
  id?: number;
  name: string;
  money: number;
  reputation: number;
  health: number;
  weaponDamageTier: number;
  weaponHandlingTier: number;
  armorPlatingTier: number;
  servoAssistTier: number;
  batteryPackTier: number;
}

export interface StashItem {
  id?: number;
  itemId: string;
  quantity: number;
  slot: string; // 'stash', 'primary', 'secondary', 'utility', etc.
  stats?: any; // For randomized loot
}

export interface Contract {
  id?: number;
  title: string;
  description: string;
  reward: number;
  isCompleted: boolean;
  isActive: boolean;
}

export class SaveDB extends Dexie {
  playerProfile!: Table<PlayerProfile>;
  stashItems!: Table<StashItem>;
  contracts!: Table<Contract>;

  constructor() {
    // Legacy name — keep so existing IndexedDB saves survive the Void Sovereigns rebrand
    super('BunkerExtractionDB');
    this.version(1).stores({
      playerProfile: '++id, name',
      stashItems: '++id, itemId, slot',
      contracts: '++id, isCompleted, isActive'
    });
  }

  async initializeDefault() {
    const profileCount = await this.playerProfile.count();
    if (profileCount === 0) {
      await this.playerProfile.add({
        name: 'Operative',
        money: 1000,
        reputation: 0,
        health: 100,
        ...DEFAULT_UPGRADE_STATE,
      });
    } else {
      const profiles = await this.playerProfile.toArray();
      for (const profile of profiles) {
        if (profile.id === undefined) continue;
        const normalized = normalizeUpgradeState(profile);
        await this.playerProfile.update(profile.id, normalized);
      }
    }

    const stashCount = await this.stashItems.count();
    if (stashCount === 0) {
      await this.stashItems.bulkAdd([
        { itemId: 'rifle_01', quantity: 1, slot: 'stash' },
        { itemId: 'ammo_9mm', quantity: 60, slot: 'stash' },
        { itemId: 'medkit', quantity: 2, slot: 'stash' }
      ]);
    }

    const loadoutItems = await this.stashItems.where('slot').equals('loadout').toArray();
    for (const extraPrimaryId of getExtraLoadoutPrimaryIds(loadoutItems)) {
      await this.stashItems.update(extraPrimaryId, { slot: 'stash' });
    }

    const contracts = await this.contracts.toArray();
    if (contracts.length === 0) {
      await this.contracts.bulkAdd(
        CANONICAL_CONTRACT_SEEDS.map((c) => ({
          ...c,
          isCompleted: false,
          isActive: false,
        }))
      );
    } else {
      const byTitle = new Set(contracts.map((c) => c.title));
      for (const seed of CANONICAL_CONTRACT_SEEDS) {
        if (byTitle.has(seed.title)) continue;
        await this.contracts.add({
          ...seed,
          isCompleted: false,
          isActive: false,
        });
      }
    }

    const afterSeed = await this.contracts.toArray();
    const hasActiveOpen = afterSeed.some((c) => c.isActive && !c.isCompleted);
    if (!hasActiveOpen) {
      const firstOpen = afterSeed.find((c) => !c.isCompleted);
      if (firstOpen?.id !== undefined) {
        for (const active of afterSeed) {
          if (active.isActive && active.id !== undefined) {
            await this.contracts.update(active.id, { isActive: false });
          }
        }
        await this.contracts.update(firstOpen.id, { isActive: true });
      }
    }
  }
}

export const db = new SaveDB();
