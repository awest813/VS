import { describe, expect, it } from 'vitest';
import { LootContainer } from './LootContainer';

describe('LootContainer', () => {
  it('fromGrants dequeues in order via takeNext', () => {
    const c = LootContainer.fromGrants([
      { itemId: 'a', quantity: 1 },
      { itemId: 'b', quantity: 2 },
    ]);
    expect(c.snapshot()).toHaveLength(2);
    expect(c.takeNext()?.itemId).toBe('a');
    expect(c.takeNext()?.itemId).toBe('b');
    expect(c.takeNext()).toBeNull();
    expect(c.isEmpty).toBe(true);
  });

  it('takeAll drains queue', () => {
    const c = LootContainer.fromGrants([{ itemId: 'scrap_metal', quantity: 3 }]);
    const bulk = c.takeAll();
    expect(bulk).toHaveLength(1);
    expect(c.isEmpty).toBe(true);
    expect(c.takeNext()).toBeNull();
  });

  it('fromTable uses loot table id and rolls deterministic grants', () => {
    let n = 0;
    const rndSeq = [0.1, 0, 0, 0.5];
    const rnd = () => rndSeq[n++] ?? 0;
    const c = LootContainer.fromTable({ id: 't', rolls: 1, entries: [{ mode: 'weapon_primary', weight: 1 }] }, rnd);
    expect(c.lootTableId).toBe('t');
    const g = c.takeNext();
    expect(g?.itemId).toBe('rifle_01');
    expect(c.isEmpty).toBe(true);
  });
});
