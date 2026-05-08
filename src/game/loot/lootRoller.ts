import { PRIMARY_WEAPON_ITEM_IDS } from '../weapons/weaponDefinitions';
import type { RaidLootGrant, WeightedRaidLootEntry, WeightedRaidLootTable } from './lootTypes';

export function randomIntInclusive(min: number, max: number, rnd: () => number = Math.random): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(rnd() * (hi - lo + 1)) + lo;
}

/** `roll` expected in `[0, totalWeight)` — enables deterministic tests. */
export function pickWeightedIndex(weights: readonly number[], roll: number): number {
  let r = roll;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

export function pickWeightedRaidEntry(entries: WeightedRaidLootEntry[], rnd: () => number = Math.random): WeightedRaidLootEntry {
  const weights = entries.map((e) => e.weight);
  const sum = weights.reduce((a, b) => a + b, 0);
  const roll = rnd() * sum;
  const idx = pickWeightedIndex(weights, roll);
  return entries[idx]!;
}

function rollPrimaryWeaponGrant(rnd: () => number): RaidLootGrant {
  const ix = Math.floor(rnd() * PRIMARY_WEAPON_ITEM_IDS.length);
  const itemId = PRIMARY_WEAPON_ITEM_IDS[Math.min(ix, PRIMARY_WEAPON_ITEM_IDS.length - 1)]!;
  return {
    itemId,
    quantity: 1,
    stats: {
      damageMod: 0.8 + rnd() * 0.4,
      fireRateMod: 0.8 + rnd() * 0.4,
    },
  };
}

export function grantsFromLootTable(table: WeightedRaidLootTable, rnd: () => number = Math.random): RaidLootGrant[] {
  const out: RaidLootGrant[] = [];

  for (let i = 0; i < table.rolls; i++) {
    const entry = pickWeightedRaidEntry(table.entries, rnd);
    if (entry.mode === 'weapon_primary') {
      out.push(rollPrimaryWeaponGrant(rnd));
      continue;
    }

    const qty = randomIntInclusive(entry.minQuantity, entry.maxQuantity, rnd);
    if (qty > 0) {
      out.push({ itemId: entry.itemId, quantity: qty });
    }
  }

  return out;
}
