/**
 * Planet outpost entity placements — abandoned Venus-like mini outpost.
 * Dense atmosphere, hostile fauna adapted to pressure, corroded infrastructure.
 */

import type { EnemyBehavior } from '../ai/EnemyAI';

export interface PlanetEnemySpawnDef {
  x: number;
  z: number;
  ranged: boolean;
  behavior?: EnemyBehavior;
}

export const PLANET_ENEMY_SPAWNS: PlanetEnemySpawnDef[] = [
  { x: 0, z: 10, ranged: false, behavior: 'rusher' },
  { x: -6, z: 22, ranged: true, behavior: 'anchored' },
  { x: 6, z: 22, ranged: false, behavior: 'standard' },
  { x: 0, z: 38, ranged: true, behavior: 'anchored' },
  { x: -4, z: 48, ranged: false, behavior: 'rusher' },
];

export interface PlanetCrateSpawnDef {
  meshId: string;
  x: number;
  z: number;
  /** Gold objective crate (beacon core chain). */
  objective?: boolean;
}

export const PLANET_CRATE_SPAWNS: PlanetCrateSpawnDef[] = [
  { meshId: 'planet_crate_1', x: -10, z: 20 },
  { meshId: 'planet_crate_2', x: 10, z: 20 },
  { meshId: 'planet_crate_3', x: 0, z: 35 },
  { meshId: 'planet_crate_obj', x: 0, z: 52, objective: true },
];
