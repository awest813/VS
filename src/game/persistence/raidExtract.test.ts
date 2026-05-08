import { describe, it, expect } from 'vitest';
import { mergeAmmoForShipExtract } from './raidExtract';

describe('mergeAmmoForShipExtract', () => {
  it('merges raid stacks with mag and reserve', () => {
    const out = mergeAmmoForShipExtract(
      [{ itemId: 'scrap_metal', quantity: 2 }, { itemId: 'ammo_9mm', quantity: 10 }],
      20,
      30
    );
    expect(out.find((i) => i.itemId === 'ammo_9mm')?.quantity).toBe(60);
    expect(out.find((i) => i.itemId === 'scrap_metal')?.quantity).toBe(2);
  });

  it('omits ammo row when everything is zero', () => {
    const out = mergeAmmoForShipExtract([], 0, 0);
    expect(out.some((i) => i.itemId === 'ammo_9mm')).toBe(false);
  });
});
