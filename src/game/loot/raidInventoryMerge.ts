import { getLootDefinition } from './lootDatabase';
import type { RaidLootGrant } from './lootTypes';

export type RaidInventoryRow = { itemId: string; quantity: number; stats?: any };

/**
 * Applies a loot grant into the live raid array (respects stackable/maxStack when known).
 */
export function mergeRaidLootGrant(inv: RaidInventoryRow[], grant: RaidLootGrant): void {
  const def = getLootDefinition(grant.itemId);

  if (!def?.stackable) {
    inv.push({
      itemId: grant.itemId,
      quantity: grant.quantity,
      stats: grant.stats,
    });
    return;
  }

  const maxStack = def.maxStack ?? 99;
  let remaining = grant.quantity;

  const tryStack = (): void => {
    const candidate = inv.find((r) => r.itemId === grant.itemId && !r.stats);
    if (candidate && candidate.quantity < maxStack) {
      const room = maxStack - candidate.quantity;
      const add = Math.min(room, remaining);
      candidate.quantity += add;
      remaining -= add;
    }
  };

  while (remaining > 0) {
    tryStack();
    if (remaining <= 0) break;
    inv.push({
      itemId: grant.itemId,
      quantity: Math.min(maxStack, remaining),
    });
    remaining -= Math.min(maxStack, remaining);
  }
}

export function mergeRaidLootGrants(inv: RaidInventoryRow[], grants: RaidLootGrant[]): void {
  for (const g of grants) mergeRaidLootGrant(inv, g);
}
