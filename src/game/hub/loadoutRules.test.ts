import { describe, expect, it } from 'vitest';
import { getExtraLoadoutPrimaryIds, getLoadoutPrimarySwapIds } from './loadoutRules';

describe('loadoutRules', () => {
  it('keeps the first staged primary and demotes extras', () => {
    expect(
      getExtraLoadoutPrimaryIds([
        { id: 1, itemId: 'rifle_01', slot: 'loadout' },
        { id: 2, itemId: 'ammo_9mm', slot: 'loadout' },
        { id: 3, itemId: 'shotgun_01', slot: 'loadout' },
        { id: 4, itemId: 'pulse_rifle', slot: 'stash' },
        { id: 5, itemId: 'pulse_rifle', slot: 'loadout' },
      ])
    ).toEqual([3, 5]);
  });

  it('swaps out other loadout primaries when a new one is staged', () => {
    expect(
      getLoadoutPrimarySwapIds(
        [
          { id: 1, itemId: 'rifle_01', slot: 'loadout' },
          { id: 2, itemId: 'ammo_9mm', slot: 'loadout' },
          { id: 3, itemId: 'shotgun_01', slot: 'stash' },
        ],
        3
      )
    ).toEqual([1]);
  });
});
