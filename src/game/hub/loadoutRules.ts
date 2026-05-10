import type { StashItem } from '../persistence/SaveDB';
import { isPrimaryWeaponItemId } from '../weapons/weaponDefinitions';

type LoadoutItem = Pick<StashItem, 'id' | 'itemId' | 'slot'>;

/** Returns duplicate staged-primary ids so legacy loadouts keep only the first active primary. */
export function getExtraLoadoutPrimaryIds(items: ReadonlyArray<LoadoutItem>): number[] {
  let keptPrimaryId: number | null = null;
  const extraIds: number[] = [];

  for (const item of items) {
    if (item.slot !== 'loadout') continue;
    if (item.id === undefined) continue;
    if (!isPrimaryWeaponItemId(item.itemId)) continue;
    if (keptPrimaryId === null) {
      keptPrimaryId = item.id;
      continue;
    }
    extraIds.push(item.id);
  }

  return extraIds;
}

/** Returns currently staged primary ids that should be moved back to stash before staging `nextPrimaryId`. */
export function getLoadoutPrimarySwapIds(
  items: ReadonlyArray<LoadoutItem>,
  nextPrimaryId: number
): number[] {
  return items
    .filter(
      (item) =>
        item.slot === 'loadout' &&
        item.id !== undefined &&
        item.id !== nextPrimaryId &&
        isPrimaryWeaponItemId(item.itemId)
    )
    .map((item) => item.id!);
}
