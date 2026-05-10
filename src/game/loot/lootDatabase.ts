import type { LootItemDefinition } from './lootTypes';

/**
 * Single source for item metadata used by UI tinting, vendor math, and stack rules.
 * Only defines ids that exist in-game today.
 */
export const LOOT_DATABASE: Record<string, LootItemDefinition> = {
  scrap_metal: {
    id: 'scrap_metal',
    name: 'Scrap metal',
    category: 'resource',
    rarity: 'common',
    weight: 0.4,
    size: { width: 1, height: 1 },
    value: 10,
    stackable: true,
    maxStack: 99,
  },
  copper_wire: {
    id: 'copper_wire',
    name: 'Copper wire',
    category: 'resource',
    rarity: 'common',
    weight: 0.25,
    size: { width: 1, height: 1 },
    value: 25,
    stackable: true,
    maxStack: 99,
  },
  ammo_9mm: {
    id: 'ammo_9mm',
    name: '9×mm rounds',
    category: 'ammo',
    rarity: 'common',
    weight: 0.05,
    size: { width: 1, height: 1 },
    value: 1,
    stackable: true,
    maxStack: 999,
  },
  medkit: {
    id: 'medkit',
    name: 'Medkit',
    category: 'medical',
    rarity: 'uncommon',
    weight: 1.2,
    size: { width: 2, height: 1 },
    value: 40,
    stackable: true,
    maxStack: 20,
  },
  rifle_01: {
    id: 'rifle_01',
    name: 'Assault rifle',
    category: 'weapon',
    rarity: 'rare',
    weight: 3.2,
    size: { width: 2, height: 2 },
    value: 320,
    stackable: false,
  },
  shotgun_01: {
    id: 'shotgun_01',
    name: 'Pump shotgun',
    category: 'weapon',
    rarity: 'rare',
    weight: 3.4,
    size: { width: 2, height: 2 },
    value: 280,
    stackable: false,
  },
  pulse_rifle: {
    id: 'pulse_rifle',
    name: 'Pulse rifle',
    category: 'weapon',
    rarity: 'epic',
    weight: 3.1,
    size: { width: 2, height: 2 },
    value: 480,
    stackable: false,
  },
  survey_drive: {
    id: 'survey_drive',
    name: 'Survey drive',
    category: 'quest',
    rarity: 'rare',
    weight: 0.18,
    size: { width: 1, height: 1 },
    value: 750,
    stackable: false,
  },
  carbine_mk2: {
    id: 'carbine_mk2',
    name: 'Combat carbine',
    category: 'weapon',
    rarity: 'rare',
    weight: 3.0,
    size: { width: 2, height: 2 },
    value: 360,
    stackable: false,
  },
  bandage: {
    id: 'bandage',
    name: 'Bandage',
    category: 'medical',
    rarity: 'common',
    weight: 0.3,
    size: { width: 1, height: 1 },
    value: 15,
    stackable: true,
    maxStack: 20,
  },
};

export function getLootDefinition(itemId: string): LootItemDefinition | undefined {
  return LOOT_DATABASE[itemId];
}

export function lootTradeInCredits(itemId: string): number {
  return LOOT_DATABASE[itemId]?.value ?? 5;
}
