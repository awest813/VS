import type { WeightedRaidLootTable } from './lootTypes';

/** Standard moonbase salvage crate (not the scripted survey-drive objective crate). */
export const MOON_STANDARD_CRATE: WeightedRaidLootTable = {
  id: 'moon_standard_crate',
  rolls: 1,
  entries: [
    { mode: 'item', itemId: 'scrap_metal', weight: 20, minQuantity: 1, maxQuantity: 4 },
    { mode: 'item', itemId: 'copper_wire', weight: 20, minQuantity: 1, maxQuantity: 3 },
    { mode: 'item', itemId: 'medkit', weight: 12, minQuantity: 1, maxQuantity: 1 },
    { mode: 'item', itemId: 'ammo_9mm', weight: 28, minQuantity: 20, maxQuantity: 50 },
    { mode: 'weapon_primary', weight: 20 },
  ],
};

/** Station transfer-corridor salvage crate. Skews ammo + consumables; weapon drops are rarer. */
export const STATION_STANDARD_CRATE: WeightedRaidLootTable = {
  id: 'station_standard_crate',
  rolls: 1,
  entries: [
    { mode: 'item', itemId: 'ammo_9mm', weight: 35, minQuantity: 15, maxQuantity: 40 },
    { mode: 'item', itemId: 'scrap_metal', weight: 22, minQuantity: 1, maxQuantity: 3 },
    { mode: 'item', itemId: 'copper_wire', weight: 18, minQuantity: 1, maxQuantity: 2 },
    { mode: 'item', itemId: 'bandage', weight: 20, minQuantity: 1, maxQuantity: 2 },
    { mode: 'item', itemId: 'medkit', weight: 10, minQuantity: 1, maxQuantity: 1 },
    { mode: 'weapon_primary', weight: 12 },
  ],
};

/** Planet outpost salvage crate. Dangerous zone — rewards skew toward ammo, occasional rare drop. */
export const PLANET_STANDARD_CRATE: WeightedRaidLootTable = {
  id: 'planet_standard_crate',
  rolls: 1,
  entries: [
    { mode: 'item', itemId: 'ammo_9mm', weight: 30, minQuantity: 20, maxQuantity: 50 },
    { mode: 'item', itemId: 'scrap_metal', weight: 18, minQuantity: 1, maxQuantity: 3 },
    { mode: 'item', itemId: 'copper_wire', weight: 14, minQuantity: 1, maxQuantity: 3 },
    { mode: 'item', itemId: 'medkit', weight: 15, minQuantity: 1, maxQuantity: 1 },
    { mode: 'item', itemId: 'bandage', weight: 12, minQuantity: 1, maxQuantity: 3 },
    { mode: 'weapon_primary', weight: 18 },
  ],
};
