import { describe, expect, it } from 'vitest';
import {
  environmentalSurgeActiveAt,
  RAID_ENV_HAZARD_CYCLE_MS,
  RAID_ENV_SURGE_DURATION_MS,
} from './raidEnvironment';

describe('raidEnvironment', () => {
  it('surge is true only in the first portion of each cycle', () => {
    expect(environmentalSurgeActiveAt(0)).toBe(true);
    expect(environmentalSurgeActiveAt(RAID_ENV_SURGE_DURATION_MS - 1)).toBe(true);
    expect(environmentalSurgeActiveAt(RAID_ENV_SURGE_DURATION_MS)).toBe(false);
    expect(environmentalSurgeActiveAt(RAID_ENV_HAZARD_CYCLE_MS - 1)).toBe(false);
    expect(environmentalSurgeActiveAt(RAID_ENV_HAZARD_CYCLE_MS)).toBe(true);
  });
});
