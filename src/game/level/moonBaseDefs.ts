/**
 * Declared placements (entity-style) separated from Babylon scene orchestration —
 * mirrors how idTech games keep spawn data in defs/maps instead of scattering literals.
 *
 * Combat pacing: alternate melee choke (`ranged: false` near corridors) vs ranged lanes (`ranged: true`)
 * so players swap distance and reads — few enemy variants, roles from placement + tint in `EnemyAI`.
 */

import type { EnemyBehavior } from '../ai/EnemyAI';

export interface MoonEnemySpawnDef {
  x: number;
  z: number;
  /** True = projectile behavior branch in EnemyAI */
  ranged: boolean;
  /** Placement-driven pacing — see `EnemySpawnOptions` */
  behavior?: EnemyBehavior;
}

export const MOONBASE_ENEMY_SPAWNS: MoonEnemySpawnDef[] = [
  { x: 0, z: 5, ranged: false, behavior: 'rusher' },
  { x: -5, z: 20, ranged: true, behavior: 'anchored' },
  { x: 5, z: 20, ranged: false },
  { x: -20, z: 20, ranged: true },
  { x: 0, z: 40, ranged: true, behavior: 'standard' },
  { x: 0, z: 50, ranged: false, behavior: 'rusher' },
];

export interface MoonCrateSpawnDef {
  meshId: string;
  x: number;
  z: number;
  /** Gold objective crate (survey chain) */
  objective?: boolean;
}

export const MOONBASE_CRATE_SPAWNS: MoonCrateSpawnDef[] = [
  { meshId: 'crate_1', x: -18, z: 22 },
  { meshId: 'crate_2', x: -22, z: 18 },
  { meshId: 'crate_3', x: -25, z: 22 },
  { meshId: 'crate_4', x: 0, z: 58, objective: true },
];
