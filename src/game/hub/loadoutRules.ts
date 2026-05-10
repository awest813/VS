import type { StashItem } from '../persistence/SaveDB';
import { isPrimaryWeaponItemId } from '../weapons/weaponDefinitions';

type LoadoutItem = Pick<StashItem, 'id' | 'itemId' | 'slot'>;

export function getExtraLoadoutPrimaryIds(items: ReadonlyArray<LoadoutItem>): number[] {
  let keptPrimaryId: number | null = null;
  const extraIds: number[] = [];

  for (const item of items) {
    if (item.slot !== 'loadout' || item.id === undefined || !isPrimaryWeaponItemId(item.itemId)) continue;
    if (keptPrimaryId === null) {
      keptPrimaryId = item.id;
      continue;
    }
    extraIds.push(item.id);
  }

  return extraIds;
}

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
