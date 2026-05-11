import { describe, expect, it } from 'vitest';
import {
  BLACK_SITE_BEACON_CONTRACT_TITLE,
  CANONICAL_CONTRACT_SEEDS,
  PLANET_BEACON_CONTRACT_TITLE,
  SALVAGER_SWEEP_CONTRACT_TITLE,
  SALVAGER_SWEEP_KILLS_REQUIRED,
  STATION_DEBRIS_KILLS_REQUIRED,
  SURVEY_DRIVE_CONTRACT_TITLE,
  STATION_DEBRIS_CONTRACT_TITLE,
  contractPayoutEligible,
  hasBeaconCore,
  hasSurveyDrive,
  getContractRaidHint,
  contractProgressSummary,
  getContractUnlockRequirement,
  hubDockingAllowed,
  getContractDeployZone,
  isContractUnlocked,
} from './contractRules';

describe('contractRules', () => {
  it('canonical seeds stay aligned with payout titles', () => {
    expect(CANONICAL_CONTRACT_SEEDS).toHaveLength(5);
    expect(CANONICAL_CONTRACT_SEEDS.map((c) => c.title)).toEqual([
      SURVEY_DRIVE_CONTRACT_TITLE,
      STATION_DEBRIS_CONTRACT_TITLE,
      PLANET_BEACON_CONTRACT_TITLE,
      SALVAGER_SWEEP_CONTRACT_TITLE,
      BLACK_SITE_BEACON_CONTRACT_TITLE,
    ]);
    expect(CANONICAL_CONTRACT_SEEDS[1].description).toContain(String(STATION_DEBRIS_KILLS_REQUIRED));
    expect(CANONICAL_CONTRACT_SEEDS[3].description).toContain(String(SALVAGER_SWEEP_KILLS_REQUIRED));
  });

  it('hasSurveyDrive', () => {
    expect(hasSurveyDrive([])).toBe(false);
    expect(hasSurveyDrive([{ itemId: 'survey_drive', quantity: 0 }])).toBe(false);
    expect(hasSurveyDrive([{ itemId: 'survey_drive', quantity: 1 }])).toBe(true);
  });

  it('hasBeaconCore', () => {
    expect(hasBeaconCore([])).toBe(false);
    expect(hasBeaconCore([{ itemId: 'beacon_core', quantity: 0 }])).toBe(false);
    expect(hasBeaconCore([{ itemId: 'beacon_core', quantity: 1 }])).toBe(true);
  });

  it('contractPayoutEligible supports inventory objectives', () => {
    const survey = { title: SURVEY_DRIVE_CONTRACT_TITLE };
    const beacon = { title: PLANET_BEACON_CONTRACT_TITLE };
    expect(contractPayoutEligible(survey, [], 0)).toBe(false);
    expect(contractPayoutEligible(survey, [{ itemId: 'survey_drive', quantity: 1 }], 0)).toBe(true);
    expect(contractPayoutEligible(beacon, [{ itemId: 'beacon_core', quantity: 1 }], 0)).toBe(true);
  });

  it('contractPayoutEligible supports escalating station kill objectives', () => {
    expect(
      contractPayoutEligible(
        { title: STATION_DEBRIS_CONTRACT_TITLE },
        [],
        STATION_DEBRIS_KILLS_REQUIRED - 1
      )
    ).toBe(false);
    expect(
      contractPayoutEligible({ title: STATION_DEBRIS_CONTRACT_TITLE }, [], STATION_DEBRIS_KILLS_REQUIRED)
    ).toBe(true);
    expect(
      contractPayoutEligible(
        { title: SALVAGER_SWEEP_CONTRACT_TITLE },
        [],
        SALVAGER_SWEEP_KILLS_REQUIRED - 1
      )
    ).toBe(false);
    expect(
      contractPayoutEligible({ title: SALVAGER_SWEEP_CONTRACT_TITLE }, [], SALVAGER_SWEEP_KILLS_REQUIRED)
    ).toBe(true);
  });

  it('hints and progress exist for known titles', () => {
    expect(getContractRaidHint(SURVEY_DRIVE_CONTRACT_TITLE, 'moon')).toContain('Survey drive');
    expect(getContractRaidHint(STATION_DEBRIS_CONTRACT_TITLE, 'station')).toContain(
      String(STATION_DEBRIS_KILLS_REQUIRED)
    );
    expect(getContractRaidHint(PLANET_BEACON_CONTRACT_TITLE, 'planet')).toContain('beacon core');
    expect(contractProgressSummary(SURVEY_DRIVE_CONTRACT_TITLE, [], 0)).toContain('survey drive');
    expect(contractProgressSummary(STATION_DEBRIS_CONTRACT_TITLE, [], 1)).toContain('1 /');
    expect(contractProgressSummary(PLANET_BEACON_CONTRACT_TITLE, [], 0)).toContain('beacon core');
    expect(contractProgressSummary(BLACK_SITE_BEACON_CONTRACT_TITLE, [{ itemId: 'beacon_core', quantity: 1 }], 0)).toContain('in pack');
  });

  it('deploy zones and unlock requirements stay consistent', () => {
    expect(getContractDeployZone(SURVEY_DRIVE_CONTRACT_TITLE)).toBe('station_chain');
    expect(getContractDeployZone(STATION_DEBRIS_CONTRACT_TITLE)).toBe('station_chain');
    expect(getContractDeployZone(PLANET_BEACON_CONTRACT_TITLE)).toBe('planet');
    expect(getContractDeployZone('Unknown Contract')).toBeNull();
    expect(getContractUnlockRequirement(SURVEY_DRIVE_CONTRACT_TITLE)).toBe(0);
    expect(getContractUnlockRequirement(PLANET_BEACON_CONTRACT_TITLE)).toBe(2);
    expect(isContractUnlocked(BLACK_SITE_BEACON_CONTRACT_TITLE, 3)).toBe(false);
    expect(isContractUnlocked(BLACK_SITE_BEACON_CONTRACT_TITLE, 4)).toBe(true);
  });

  it('hubDockingAllowed requires active contract unless all are completed', () => {
    expect(
      hubDockingAllowed(
        [
          { isCompleted: false },
          { isCompleted: true },
        ],
        null
      )
    ).toBe(false);
    expect(hubDockingAllowed([{ isCompleted: true }], null)).toBe(true);
    expect(
      hubDockingAllowed(
        [
          { isCompleted: false },
          { isCompleted: true },
        ],
        1
      )
    ).toBe(true);
  });
});
