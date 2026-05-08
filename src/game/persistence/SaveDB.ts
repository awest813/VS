import Dexie, { Table } from 'dexie';
import { CANONICAL_CONTRACT_SEEDS } from '../contracts/contractRules';

export interface PlayerProfile {
  id?: number;
  name: string;
  money: number;
  reputation: number;
  health: number;
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
        health: 100
      });

      // Add some starting items
      await this.stashItems.bulkAdd([
        { itemId: 'rifle_01', quantity: 1, slot: 'stash' },
        { itemId: 'ammo_9mm', quantity: 60, slot: 'stash' },
        { itemId: 'medkit', quantity: 2, slot: 'stash' }
      ]);

      await this.contracts.bulkAdd(
        CANONICAL_CONTRACT_SEEDS.map((c) => ({
          ...c,
          isCompleted: false,
          isActive: false,
        }))
      );
    }
  }
}

export const db = new SaveDB();
