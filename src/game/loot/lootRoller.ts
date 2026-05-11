import { PRIMARY_WEAPON_ITEM_IDS, type PrimaryWeaponItemId } from '../weapons/weaponDefinitions';
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
  // Define weights for primary weapons to balance rarity
  const weaponWeights: { id: PrimaryWeaponItemId; weight: number }[] = [
    { id: 'rifle_01', weight: 100 },
    { id: 'shotgun_01', weight: 80 },
    { id: 'smg_flechette', weight: 80 },
    { id: 'pistol_std', weight: 70 },
    { id: 'pulse_compact', weight: 60 },
    { id: 'carbine_mk2', weight: 50 },
    { id: 'revolver_454', weight: 50 },
    { id: 'pulse_rifle', weight: 40 },
    { id: 'slug_cannon', weight: 20 },
    { id: 'void_disruptor', weight: 10 },
    { id: 'thermal_lance', weight: 5 },
  ];

  const totalWeight = weaponWeights.reduce((sum, w) => sum + w.weight, 0);
  const roll = rnd() * totalWeight;
  let current = 0;
  let itemId: PrimaryWeaponItemId = 'rifle_01';

  for (const w of weaponWeights) {
    current += w.weight;
    if (roll < current) {
      itemId = w.id;
      break;
    }
  }

  return {
    itemId,
    quantity: 1,
    stats: {
      damageMod: 0.85 + rnd() * 0.35,
      fireRateMod: 0.9 + rnd() * 0.25,
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
