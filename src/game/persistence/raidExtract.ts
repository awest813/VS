import { AMMO_ITEM_IDS, AmmoItemId } from '../weapons/weaponDefinitions';

/**
 * Combine loose ammo in raid with mag + reserve so extraction does not double-count or lose mag ammo.
 * This ensures that if a player extracts with a weapon using 'pulse_cell', those rounds are merged
 * into the 'pulse_cell' stacks in the ship stash.
 */
export function mergeAmmoForShipExtract(
  raid: { itemId: string; quantity: number; stats?: unknown }[],
  currentMag: number,
  reserve: number,
  activeAmmoType: AmmoItemId = 'ammo_9mm'
): { itemId: string; quantity: number; stats?: unknown }[] {
  // 1. Separate all known ammo from the raid backpack
  const knownAmmoIds = new Set<string>(AMMO_ITEM_IDS);
  const ammoMap = new Map<string, number>();

  // Extract existing ammo from raid inventory
  const nonAmmoItems = raid.filter((item) => {
    if (knownAmmoIds.has(item.itemId)) {
      const current = ammoMap.get(item.itemId) || 0;
      ammoMap.set(item.itemId, current + item.quantity);
      return false;
    }
    return true;
  });

  // 2. Add the active weapon's magazine and reserve to its specific ammo type
  const activeCount = ammoMap.get(activeAmmoType) || 0;
  ammoMap.set(activeAmmoType, activeCount + Math.max(0, currentMag) + Math.max(0, reserve));

  // 3. Reconstruct the raid inventory with merged ammo stacks
  const merged = [...nonAmmoItems];
  for (const [itemId, quantity] of ammoMap.entries()) {
    if (quantity > 0) {
      merged.push({ itemId, quantity });
    }
  }

  return merged;
}
