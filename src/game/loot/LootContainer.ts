import { grantsFromLootTable } from './lootRoller';
import type { RaidLootGrant, WeightedRaidLootTable } from './lootTypes';

/**
 * Rolled-once stash attached to world interactables. Loot exists as data first;
 * the mesh calls `takeNext()` (or `takeAll()`) on interact.
 */
export class LootContainer {
  readonly lootTableId: string | undefined;

  private constructor(
    /** Remaining queued grants — front is next pickup */
    private queue: RaidLootGrant[],
    lootTableId?: string
  ) {
    this.lootTableId = lootTableId;
  }

  /** Roll once at spawn from a weighted raid table (`rolls` = how many queued grants). */
  static fromTable(table: WeightedRaidLootTable, rnd?: () => number): LootContainer {
    const grants = grantsFromLootTable(table, rnd);
    return new LootContainer(grants, table.id);
  }

  /** Scripted contents (survey objectives, scripted rewards). */
  static fromGrants(grants: readonly RaidLootGrant[]): LootContainer {
    return new LootContainer([...grants]);
  }

  get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /** Next stack to receive; clears that slot only. */
  takeNext(): RaidLootGrant | null {
    return this.queue.shift() ?? null;
  }

  /** Useful for debugging or atomic “grab everything” UX. */
  takeAll(): RaidLootGrant[] {
    const out = [...this.queue];
    this.queue.length = 0;
    return out;
  }

  /** Read-only preview (e.g. future UI panel). Returns a shallow copy. */
  snapshot(): RaidLootGrant[] {
    return [...this.queue];
  }
}
