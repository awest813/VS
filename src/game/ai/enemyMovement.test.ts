import { describe, expect, it } from 'vitest';
import { createEnemyMovementProfile, planEnemyMovement } from './enemyMovement';

describe('enemyMovement planner', () => {
  it('sends enemies to the last seen player position after contact breaks', () => {
    const profile = createEnemyMovementProfile('standard', false);
    const plan = planEnemyMovement({
      now: 5_000,
      home: { x: 0, z: 0 },
      enemy: { x: 0, z: 0 },
      player: { x: 6, z: 2 },
      playerDetected: false,
      playerDistance: 20,
      attackRange: 2,
      profile,
      memory: {
        patrolPauseUntil: 0,
        patrolSeed: 0,
        patrolTarget: null,
        lastKnownPlayerPosition: { x: 6, z: 2 },
        strafeDirection: 1,
        strafeUntil: 0,
      },
    });

    expect(plan.mode).toBe('investigate');
    expect(plan.destination).toEqual({ x: 6, z: 2 });
  });

  it('clears investigation memory after reaching the last known position', () => {
    const profile = createEnemyMovementProfile('standard', false);
    const plan = planEnemyMovement({
      now: 5_000,
      home: { x: 0, z: 0 },
      enemy: { x: 6.2, z: 2.1 },
      player: { x: 20, z: 20 },
      playerDetected: false,
      playerDistance: 20,
      attackRange: 2,
      profile,
      memory: {
        patrolPauseUntil: 0,
        patrolSeed: 0,
        patrolTarget: null,
        lastKnownPlayerPosition: { x: 6, z: 2 },
        strafeDirection: 1,
        strafeUntil: 0,
      },
    });

    expect(plan.mode).toBe('idle');
    expect(plan.nextMemory.lastKnownPlayerPosition).toBeNull();
    expect(plan.nextMemory.patrolPauseUntil).toBe(5_000 + profile.patrolPauseMs);
  });

  it('starts patrol movement once idle pause expires', () => {
    const profile = createEnemyMovementProfile('standard', false);
    const plan = planEnemyMovement({
      now: 5_000,
      home: { x: 10, z: -4 },
      enemy: { x: 10, z: -4 },
      player: { x: 40, z: 40 },
      playerDetected: false,
      playerDistance: 40,
      attackRange: 2,
      profile,
      memory: {
        patrolPauseUntil: 4_000,
        patrolSeed: 0,
        patrolTarget: null,
        lastKnownPlayerPosition: null,
        strafeDirection: 1,
        strafeUntil: 0,
      },
    });

    expect(plan.mode).toBe('patrol');
    expect(plan.destination).not.toBeNull();
    expect(plan.nextMemory.patrolSeed).toBe(1);
    const dx = (plan.destination?.x ?? 10) - 10;
    const dz = (plan.destination?.z ?? -4) + 4;
    expect(Math.hypot(dx, dz)).toBeLessThanOrEqual(profile.patrolRadius + 0.0001);
  });

  it('gives ranged enemies a strafe destination while attacking', () => {
    const profile = createEnemyMovementProfile('standard', true);
    const plan = planEnemyMovement({
      now: 5_000,
      home: { x: 0, z: 0 },
      enemy: { x: 6, z: 0 },
      player: { x: 0, z: 0 },
      playerDetected: true,
      playerDistance: 6,
      attackRange: 8,
      profile,
      memory: {
        patrolPauseUntil: 0,
        patrolSeed: 0,
        patrolTarget: null,
        lastKnownPlayerPosition: null,
        strafeDirection: 1,
        strafeUntil: 0,
      },
    });

    expect(plan.mode).toBe('strafe');
    expect(plan.destination).not.toBeNull();
    expect(plan.nextMemory.strafeUntil).toBeGreaterThan(5_000);
    expect(plan.destination?.z).not.toBe(0);
  });

  it('keeps anchored enemies idle when they have no target', () => {
    const profile = createEnemyMovementProfile('anchored', true);
    const plan = planEnemyMovement({
      now: 5_000,
      home: { x: 0, z: 0 },
      enemy: { x: 0, z: 0 },
      player: { x: 12, z: 0 },
      playerDetected: false,
      playerDistance: 12,
      attackRange: 8,
      profile,
      memory: {
        patrolPauseUntil: 0,
        patrolSeed: 0,
        patrolTarget: null,
        lastKnownPlayerPosition: null,
        strafeDirection: 1,
        strafeUntil: 0,
      },
    });

    expect(plan.mode).toBe('idle');
    expect(plan.destination).toBeNull();
  });

  it('keeps melee enemies pushing while in attack range', () => {
    const profile = createEnemyMovementProfile('standard', false);
    const plan = planEnemyMovement({
      now: 5_000,
      home: { x: 0, z: 0 },
      enemy: { x: 1.9, z: 0 },
      player: { x: 0, z: 0 },
      playerDetected: true,
      playerDistance: 1.9,
      attackRange: 2.2,
      profile,
      memory: {
        patrolPauseUntil: 0,
        patrolSeed: 0,
        patrolTarget: null,
        lastKnownPlayerPosition: null,
        strafeDirection: 1,
        strafeUntil: 0,
      },
    });

    expect(plan.mode).toBe('attack');
    expect(plan.destination).toEqual({ x: 0, z: 0 });
  });
});
