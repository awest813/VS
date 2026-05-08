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
