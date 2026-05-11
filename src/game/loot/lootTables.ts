import type { WeightedRaidLootTable } from './lootTypes';

/** Standard moonbase salvage crate (not the scripted survey-drive objective crate). */
export const MOON_STANDARD_CRATE: WeightedRaidLootTable = {
  id: 'moon_standard_crate',
  rolls: 2,
  entries: [
    { mode: 'item', itemId: 'scrap_metal', weight: 15, minQuantity: 1, maxQuantity: 4 },
    { mode: 'item', itemId: 'copper_wire', weight: 15, minQuantity: 1, maxQuantity: 3 },
    { mode: 'item', itemId: 'medkit', weight: 10, minQuantity: 1, maxQuantity: 1 },
    { mode: 'item', itemId: 'ammo_9mm', weight: 15, minQuantity: 20, maxQuantity: 50 },
    { mode: 'item', itemId: 'ammo_12g', weight: 12, minQuantity: 8, maxQuantity: 20 },
    { mode: 'item', itemId: 'ammo_556', weight: 8, minQuantity: 15, maxQuantity: 30 },
    { mode: 'item', itemId: 'pulse_cell', weight: 10, minQuantity: 10, maxQuantity: 25 },
    { mode: 'item', itemId: 'flare_chem', weight: 10, minQuantity: 1, maxQuantity: 2 },
    { mode: 'item', itemId: 'shield_deploy', weight: 4, minQuantity: 1, maxQuantity: 1 },
    { mode: 'weapon_primary', weight: 15 },
  ],
};

/** Station transfer-corridor salvage crate. Skews ammo + consumables; weapon drops are rarer. */
export const STATION_STANDARD_CRATE: WeightedRaidLootTable = {
  id: 'station_standard_crate',
  rolls: 1,
  entries: [
    { mode: 'item', itemId: 'ammo_9mm', weight: 30, minQuantity: 15, maxQuantity: 40 },
    { mode: 'item', itemId: 'ammo_12g', weight: 15, minQuantity: 6, maxQuantity: 12 },
    { mode: 'item', itemId: 'scrap_metal', weight: 15, minQuantity: 1, maxQuantity: 3 },
    { mode: 'item', itemId: 'copper_wire', weight: 10, minQuantity: 1, maxQuantity: 2 },
    { mode: 'item', itemId: 'bandage', weight: 15, minQuantity: 1, maxQuantity: 2 },
    { mode: 'item', itemId: 'medkit', weight: 5, minQuantity: 1, maxQuantity: 1 },
    { mode: 'item', itemId: 'flare_chem', weight: 12, minQuantity: 1, maxQuantity: 2 },
    { mode: 'weapon_primary', weight: 10 },
  ],
};

/** Planet outpost salvage crate. Dangerous zone — rewards skew toward ammo, occasional rare drop. */
export const PLANET_STANDARD_CRATE: WeightedRaidLootTable = {
  id: 'planet_standard_crate',
  rolls: 2,
  entries: [
    { mode: 'item', itemId: 'ammo_9mm', weight: 15, minQuantity: 20, maxQuantity: 50 },
    { mode: 'item', itemId: 'ammo_762_ap', weight: 10, minQuantity: 10, maxQuantity: 25 },
    { mode: 'item', itemId: 'ammo_20g_slug', weight: 8, minQuantity: 5, maxQuantity: 12 },
    { mode: 'item', itemId: 'ammo_454_mag', weight: 8, minQuantity: 6, maxQuantity: 12 },
    { mode: 'item', itemId: 'thermal_cell', weight: 4, minQuantity: 1, maxQuantity: 4 },
    { mode: 'item', itemId: 'void_charge', weight: 4, minQuantity: 3, maxQuantity: 9 },
    { mode: 'item', itemId: 'scrap_metal', weight: 10, minQuantity: 1, maxQuantity: 3 },
    { mode: 'item', itemId: 'medkit', weight: 15, minQuantity: 1, maxQuantity: 1 },
    { mode: 'item', itemId: 'bandage', weight: 10, minQuantity: 1, maxQuantity: 3 },
    { mode: 'item', itemId: 'flare_chem', weight: 8, minQuantity: 1, maxQuantity: 2 },
    { mode: 'item', itemId: 'shield_deploy', weight: 5, minQuantity: 1, maxQuantity: 1 },
    { mode: 'weapon_primary', weight: 16 },
  ],
};
