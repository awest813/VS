import { describe, expect, it } from 'vitest';
import { grantsFromLootTable, pickWeightedIndex, randomIntInclusive } from './lootRoller';
import { mergeRaidLootGrant, type RaidInventoryRow } from './raidInventoryMerge';

describe('lootRoller', () => {
  it('randomIntInclusive is inclusive', () => {
    expect(randomIntInclusive(3, 3, () => 0)).toBe(3);
    expect(randomIntInclusive(1, 2, () => 0)).toBe(1);
    expect(randomIntInclusive(1, 2, () => 0.999)).toBe(2);
  });

  it('pickWeightedIndex', () => {
    expect(pickWeightedIndex([10, 30, 60], 0)).toBe(0);
    expect(pickWeightedIndex([10, 30, 60], 9.99)).toBe(0);
    expect(pickWeightedIndex([10, 30, 60], 10)).toBe(1);
    expect(pickWeightedIndex([10, 30, 60], 39)).toBe(1);
    expect(pickWeightedIndex([10, 30, 60], 40)).toBe(2);
  });

  it('grantsFromLootTable maps weapon_primary to a primary weapon with mods', () => {
    let n = 0;
    /** Pick entry, rifle index (0 / 3), damage roll, firerate roll */
    const rndSeq = [0.1, 0, 0, 0.5];
    const rnd = () => rndSeq[n++] ?? 0;
    const grants = grantsFromLootTable(
      { id: 't', rolls: 1, entries: [{ mode: 'weapon_primary', weight: 1 }] },
      rnd
    );
    expect(grants).toHaveLength(1);
    expect(grants[0]!.itemId).toBe('rifle_01');
    expect(grants[0]!.quantity).toBe(1);
    expect(grants[0]!.stats?.damageMod).toBe(0.8);
    expect(grants[0]!.stats?.fireRateMod).toBe(1);
  });

  it('mergeRaidLootGrant stacks scrap up to maxStack', () => {
    const inv: RaidInventoryRow[] = [{ itemId: 'scrap_metal', quantity: 98 }];
    mergeRaidLootGrant(inv, { itemId: 'scrap_metal', quantity: 5 });
    const scrapStacks = inv.filter((r) => r.itemId === 'scrap_metal');
    expect(scrapStacks.some((s) => s.quantity === 99)).toBe(true);
    expect(inv.reduce((a, r) => a + (r.itemId === 'scrap_metal' ? r.quantity : 0), 0)).toBe(103);
  });
});
