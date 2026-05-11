export interface EnemyMovementPoint {
  x: number;
  z: number;
}

export interface EnemyMovementMemory {
  patrolPauseUntil: number;
  patrolSeed: number;
  patrolTarget: EnemyMovementPoint | null;
  lastKnownPlayerPosition: EnemyMovementPoint | null;
  strafeDirection: 1 | -1;
  strafeUntil: number;
}

export interface EnemyMovementProfile {
  patrolRadius: number;
  leashRadius: number;
  patrolPauseMs: number;
  investigateArrivalRadius: number;
  patrolArrivalRadius: number;
  strafeDistance: number;
  strafeDurationMs: number;
  canStrafe: boolean;
}

export interface EnemyMovementPlanInput {
  now: number;
  home: EnemyMovementPoint;
  enemy: EnemyMovementPoint;
  player: EnemyMovementPoint;
  playerDetected: boolean;
  playerDistance: number;
  attackRange: number;
  profile: EnemyMovementProfile;
  memory: EnemyMovementMemory;
}

export interface EnemyMovementPlan {
  mode: 'idle' | 'patrol' | 'investigate' | 'chase' | 'strafe' | 'attack';
  destination: EnemyMovementPoint | null;
  nextMemory: EnemyMovementMemory;
}

export function createEnemyMovementProfile(
  behavior: 'standard' | 'rusher' | 'anchored',
  isRanged: boolean
): EnemyMovementProfile {
  const base: EnemyMovementProfile = {
    patrolRadius: 3.8,
    leashRadius: 11,
    patrolPauseMs: 1400,
    investigateArrivalRadius: 1.4,
    patrolArrivalRadius: 0.9,
    strafeDistance: 1.8,
    strafeDurationMs: 900,
    canStrafe: isRanged,
  };

  if (behavior === 'rusher') {
    return {
      ...base,
      patrolRadius: 5.4,
      leashRadius: 14,
      patrolPauseMs: 900,
      canStrafe: false,
    };
  }

  if (behavior === 'anchored') {
    return {
      ...base,
      patrolRadius: 0,
      leashRadius: 6.5,
      patrolPauseMs: 2200,
      strafeDistance: 1.1,
      canStrafe: false,
    };
  }

  return base;
}

export function planEnemyMovement(input: EnemyMovementPlanInput): EnemyMovementPlan {
  const nextMemory: EnemyMovementMemory = {
    patrolPauseUntil: input.memory.patrolPauseUntil,
    patrolSeed: input.memory.patrolSeed,
    patrolTarget: clonePoint(input.memory.patrolTarget),
    lastKnownPlayerPosition: clonePoint(input.memory.lastKnownPlayerPosition),
    strafeDirection: input.memory.strafeDirection,
    strafeUntil: input.memory.strafeUntil,
  };

  if (input.playerDetected) {
    nextMemory.lastKnownPlayerPosition = clonePoint(input.player);
    nextMemory.patrolTarget = null;

    if (input.playerDistance <= input.attackRange) {
      if (input.profile.canStrafe) {
        if (input.now >= nextMemory.strafeUntil) {
          nextMemory.strafeDirection = nextMemory.strafeDirection === 1 ? -1 : 1;
          nextMemory.strafeUntil = input.now + input.profile.strafeDurationMs;
        }
        return {
          mode: 'strafe',
          destination: clampToLeash(
            input.home,
            computeStrafeTarget(
              input.enemy,
              input.player,
              input.attackRange,
              input.profile.strafeDistance,
              nextMemory.strafeDirection
            ),
            input.profile.leashRadius
          ),
          nextMemory,
        };
      }

      return { mode: 'attack', destination: null, nextMemory };
    }

    return {
      mode: 'chase',
      destination: clampToLeash(input.home, input.player, input.profile.leashRadius),
      nextMemory,
    };
  }

  if (nextMemory.lastKnownPlayerPosition) {
    const investigateTarget = clampToLeash(
      input.home,
      nextMemory.lastKnownPlayerPosition,
      input.profile.leashRadius
    );
    if (
      distance2d(input.enemy, investigateTarget) > input.profile.investigateArrivalRadius
    ) {
      return {
        mode: 'investigate',
        destination: investigateTarget,
        nextMemory,
      };
    }
    nextMemory.lastKnownPlayerPosition = null;
    nextMemory.patrolPauseUntil = input.now + input.profile.patrolPauseMs;
    return { mode: 'idle', destination: null, nextMemory };
  }

  if (nextMemory.patrolTarget) {
    if (distance2d(input.enemy, nextMemory.patrolTarget) > input.profile.patrolArrivalRadius) {
      return { mode: 'patrol', destination: nextMemory.patrolTarget, nextMemory };
    }
    nextMemory.patrolTarget = null;
    nextMemory.patrolPauseUntil = input.now + input.profile.patrolPauseMs;
    return { mode: 'idle', destination: null, nextMemory };
  }

  if (input.profile.patrolRadius <= 0 || input.now < nextMemory.patrolPauseUntil) {
    return { mode: 'idle', destination: null, nextMemory };
  }

  nextMemory.patrolSeed += 1;
  nextMemory.patrolTarget = choosePatrolTarget(input.home, nextMemory.patrolSeed, input.profile.patrolRadius);
  return { mode: 'patrol', destination: nextMemory.patrolTarget, nextMemory };
}

function choosePatrolTarget(
  home: EnemyMovementPoint,
  patrolSeed: number,
  patrolRadius: number
): EnemyMovementPoint {
  const angle = patrolSeed * 2.399963229728653;
  const distanceScale = 0.45 + ((patrolSeed % 5) / 10);
  return {
    x: home.x + Math.cos(angle) * patrolRadius * distanceScale,
    z: home.z + Math.sin(angle) * patrolRadius * distanceScale,
  };
}

function clampToLeash(
  home: EnemyMovementPoint,
  target: EnemyMovementPoint,
  leashRadius: number
): EnemyMovementPoint {
  const dx = target.x - home.x;
  const dz = target.z - home.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= leashRadius || distance === 0) {
    return { x: target.x, z: target.z };
  }
  const scale = leashRadius / distance;
  return {
    x: home.x + dx * scale,
    z: home.z + dz * scale,
  };
}

function computeStrafeTarget(
  enemy: EnemyMovementPoint,
  player: EnemyMovementPoint,
  attackRange: number,
  strafeDistance: number,
  strafeDirection: 1 | -1
): EnemyMovementPoint {
  const away = normalize2d({
    x: enemy.x - player.x,
    z: enemy.z - player.z,
  });
  const lateral = {
    x: -away.z * strafeDirection,
    z: away.x * strafeDirection,
  };
  const orbitDistance = Math.max(attackRange * 0.78, 1.5);
  return {
    x: player.x + away.x * orbitDistance + lateral.x * strafeDistance,
    z: player.z + away.z * orbitDistance + lateral.z * strafeDistance,
  };
}

function normalize2d(point: EnemyMovementPoint): EnemyMovementPoint {
  const magnitude = Math.hypot(point.x, point.z);
  if (magnitude <= 0.0001) {
    return { x: 0, z: 1 };
  }
  return {
    x: point.x / magnitude,
    z: point.z / magnitude,
  };
}

function distance2d(a: EnemyMovementPoint, b: EnemyMovementPoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clonePoint(point: EnemyMovementPoint | null): EnemyMovementPoint | null {
  return point ? { x: point.x, z: point.z } : null;
}
