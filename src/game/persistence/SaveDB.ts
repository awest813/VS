import Dexie, { Table } from 'dexie';

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

      // Add initial contracts
      await this.contracts.bulkAdd([
        { title: 'Recover Survey Drive', description: 'Board the station, restore transit lift power, descend to moon base, retrieve survey drive from operations room.', reward: 750, isCompleted: false, isActive: false },
        { title: 'Clear Station Debris', description: 'Eliminate hostiles in the abandoned station corridor.', reward: 300, isCompleted: false, isActive: false }
      ]);
    }
  }
}

export const db = new SaveDB();
