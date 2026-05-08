/**
 * Data-first loot model aligned with extraction-shooter conventions.
 * Babylon meshes and Dexie stash are adapters; raids use `RaidLootGrant`.
 */

export type LootRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type LootCategory =
  | 'weapon'
  | 'ammo'
  | 'armor'
  | 'medical'
  | 'resource'
  | 'key'
  | 'quest'
  | 'valuable';

export interface LootItemDefinition {
  id: string;
  name: string;
  category: LootCategory;
  rarity: LootRarity;
  weight: number;
  size: { width: number; height: number };
  /** Typical vendor / scrap trade value */
  value: number;
  stackable: boolean;
  maxStack?: number;
  meshName?: string;
}

/** One logical reward from a loot table (maps to `game.raidInventory` rows). */
export interface RaidLootGrant {
  itemId: string;
  quantity: number;
  stats?: { damageMod?: number; fireRateMod?: number };
}

export type WeightedRaidLootEntry =
  | {
      mode: 'item';
      itemId: string;
      weight: number;
      minQuantity: number;
      maxQuantity: number;
    }
  | { mode: 'weapon_primary'; weight: number };

export interface WeightedRaidLootTable {
  id: string;
  /** Number of independent weighted picks (one moon crate = 1). */
  rolls: number;
  entries: WeightedRaidLootEntry[];
}
