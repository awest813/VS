/**
 * Shared environmental pressure timing — scenes drive `Game.raidEnvironmentalSurge`
 * each frame so AI + lights stay in sync (Arc-style world beats).
 */

export const RAID_ENV_HAZARD_CYCLE_MS = 42_000;
/** Within each cycle, lights dip and AI becomes more aggressive. */
export const RAID_ENV_SURGE_DURATION_MS = 14_000;

export function environmentalSurgeActiveAt(nowMs: number): boolean {
  const phase = nowMs % RAID_ENV_HAZARD_CYCLE_MS;
  return phase < RAID_ENV_SURGE_DURATION_MS;
}
