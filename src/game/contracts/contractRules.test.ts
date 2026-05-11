import { describe, expect, it } from 'vitest';
import {
  CANONICAL_CONTRACT_SEEDS,
  STATION_DEBRIS_KILLS_REQUIRED,
  SURVEY_DRIVE_CONTRACT_TITLE,
  STATION_DEBRIS_CONTRACT_TITLE,
  PLANET_BEACON_CONTRACT_TITLE,
  contractPayoutEligible,
  hasSurveyDrive,
  hasBeaconCore,
  getContractRaidHint,
  contractProgressSummary,
  hubDockingAllowed,
  getContractDeployZone,
} from './contractRules';

describe('contractRules', () => {
  it('canonical seeds stay aligned with payout titles', () => {
    expect(CANONICAL_CONTRACT_SEEDS).toHaveLength(3);
    expect(CANONICAL_CONTRACT_SEEDS.map((c) => c.title)).toEqual([
      SURVEY_DRIVE_CONTRACT_TITLE,
      STATION_DEBRIS_CONTRACT_TITLE,
      PLANET_BEACON_CONTRACT_TITLE,
    ]);
    expect(CANONICAL_CONTRACT_SEEDS[1].description).toContain(String(STATION_DEBRIS_KILLS_REQUIRED));
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

  it('contractPayoutEligible survey', () => {
    const c = { title: SURVEY_DRIVE_CONTRACT_TITLE };
    expect(contractPayoutEligible(c, [], 0)).toBe(false);
    expect(contractPayoutEligible(c, [{ itemId: 'survey_drive', quantity: 1 }], 0)).toBe(true);
  });

  it('contractPayoutEligible debris', () => {
    const c = { title: STATION_DEBRIS_CONTRACT_TITLE };
    expect(contractPayoutEligible(c, [], STATION_DEBRIS_KILLS_REQUIRED - 1)).toBe(false);
    expect(contractPayoutEligible(c, [], STATION_DEBRIS_KILLS_REQUIRED)).toBe(true);
  });

  it('contractPayoutEligible planet beacon', () => {
    const c = { title: PLANET_BEACON_CONTRACT_TITLE };
    expect(contractPayoutEligible(c, [], 0)).toBe(false);
    expect(contractPayoutEligible(c, [{ itemId: 'beacon_core', quantity: 1 }], 0)).toBe(true);
  });

  it('hints and progress exist for known titles', () => {
    expect(getContractRaidHint(SURVEY_DRIVE_CONTRACT_TITLE, 'moon').length).toBeGreaterThan(10);
    expect(getContractRaidHint(STATION_DEBRIS_CONTRACT_TITLE, 'station')).toContain(
      String(STATION_DEBRIS_KILLS_REQUIRED)
    );
    expect(getContractRaidHint(PLANET_BEACON_CONTRACT_TITLE, 'planet')).toContain('beacon core');
    expect(contractProgressSummary(SURVEY_DRIVE_CONTRACT_TITLE, [], 0)).toContain('survey drive');
    expect(contractProgressSummary(STATION_DEBRIS_CONTRACT_TITLE, [], 1)).toContain('1 /');
    expect(contractProgressSummary(PLANET_BEACON_CONTRACT_TITLE, [], 0)).toContain('beacon core');
  });

  it('getContractDeployZone maps titles to correct zones', () => {
    expect(getContractDeployZone(SURVEY_DRIVE_CONTRACT_TITLE)).toBe('station_chain');
    expect(getContractDeployZone(STATION_DEBRIS_CONTRACT_TITLE)).toBe('station_chain');
    expect(getContractDeployZone(PLANET_BEACON_CONTRACT_TITLE)).toBe('planet');
    expect(getContractDeployZone('Unknown Contract')).toBeNull();
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
