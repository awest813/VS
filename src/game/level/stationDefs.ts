/**
 * Station raid entity placements — same pattern as `moonBaseDefs`.
 * Optional `behavior` tweaks AI pacing without new meshes (Marathon-style faction read).
 */

import type { EnemyBehavior } from '../ai/EnemyAI';

export interface StationEnemySpawnDef {
  x: number;
  z: number;
  y?: number;
  ranged: boolean;
  behavior?: EnemyBehavior;
}

/** Main corridor — mix rush lanes vs anchored shooters. */
export const STATION_ENEMY_SPAWNS: StationEnemySpawnDef[] = [
  { x: 3, z: 5, y: 1, ranged: false, behavior: 'standard' },
  { x: -3.5, z: 11, y: 1, ranged: true, behavior: 'anchored' },
  { x: -5.5, z: 4, y: 1, ranged: false, behavior: 'rusher' },
];

export interface StationCrateSpawnDef {
  meshId: string;
  x: number;
  z: number;
}

/** Salvage containers scattered through the transfer corridor — give players a reason to explore. */
export const STATION_CRATE_SPAWNS: StationCrateSpawnDef[] = [
  { meshId: 'stat_crate_1', x: 6.0, z: -8 },
  { meshId: 'stat_crate_2', x: -6.2, z: 0 },
  { meshId: 'stat_crate_3', x: 5.8, z: 14 },
  { meshId: 'stat_crate_4', x: -5.5, z: -14 },
];
