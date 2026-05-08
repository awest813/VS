/**
 * Combine loose 9mm in raid with mag + reserve so extraction does not double-count or lose mag ammo.
 */
export function mergeAmmoForShipExtract(
  raid: { itemId: string; quantity: number; stats?: unknown }[],
  currentMag: number,
  reserve: number
): { itemId: string; quantity: number; stats?: unknown }[] {
  const ammoInRaid = raid
    .filter((i) => i.itemId === 'ammo_9mm')
    .reduce((sum, i) => sum + i.quantity, 0);
  const rest = raid.filter((i) => i.itemId !== 'ammo_9mm');
  const total = ammoInRaid + Math.max(0, currentMag) + Math.max(0, reserve);
  if (total > 0) {
    rest.push({ itemId: 'ammo_9mm', quantity: total });
  }
  return rest;
}
