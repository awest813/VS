/**
 * Canonical contract titles and pure payout / UI helpers shared by Dexie seeds,
 * station extraction, and the React HUD.
 */
export const SURVEY_DRIVE_CONTRACT_TITLE = 'Recover Survey Drive';

export const STATION_DEBRIS_CONTRACT_TITLE = 'Clear Station Debris';

export const PLANET_BEACON_CONTRACT_TITLE = 'Recover Beacon Core';

export const STATION_DEBRIS_KILLS_REQUIRED = 2;

/** Single source for Dexie seed copy — keep UI, hints, and DB aligned. */
export const CANONICAL_CONTRACT_SEEDS: ReadonlyArray<{
  title: string;
  description: string;
  reward: number;
}> = [
  {
    title: SURVEY_DRIVE_CONTRACT_TITLE,
    description:
      'Frontier contract: board the declining stack, bring the transit lift online, descend to the lunar spine, and recover the survey drive from deep ops. Chain green extracts so loot and payout eligibility ride home to the ship.',
    reward: 750,
  },
  {
    title: STATION_DEBRIS_CONTRACT_TITLE,
    description: `Dock-authority hygiene ticket — eliminate at least ${STATION_DEBRIS_KILLS_REQUIRED} hostiles in the abandoned transfer corridor. Green beacon aft banks your haul; credits finalize when you extract aboard ship.`,
    reward: 300,
  },
  {
    title: PLANET_BEACON_CONTRACT_TITLE,
    description:
      'MTA salvage order: deploy to the abandoned Venusian outpost, push through the pressurized labs, and retrieve the beacon core from deep storage before the atmosphere finishes the job the last crew started. Extract green to bank your haul.',
    reward: 600,
  },
];

export type RaidItem = { itemId: string; quantity: number };

export function hasSurveyDrive(inv: RaidItem[]): boolean {
  return inv.some((i) => i.itemId === 'survey_drive' && i.quantity > 0);
}

export function hasBeaconCore(inv: RaidItem[]): boolean {
  return inv.some((i) => i.itemId === 'beacon_core' && i.quantity > 0);
}

export function contractPayoutEligible(
  active: Pick<{ title: string }, 'title'> | null | undefined,
  inv: RaidItem[],
  stationKillsSinceDock: number
): boolean {
  if (!active?.title) return false;
  switch (active.title) {
    case SURVEY_DRIVE_CONTRACT_TITLE:
      return hasSurveyDrive(inv);
    case STATION_DEBRIS_CONTRACT_TITLE:
      return stationKillsSinceDock >= STATION_DEBRIS_KILLS_REQUIRED;
    case PLANET_BEACON_CONTRACT_TITLE:
      return hasBeaconCore(inv);
    default:
      return false;
  }
}

export type ContractRaidZone = 'station' | 'moon' | 'planet';

/** Returns which deployment zone a contract belongs to. */
export function getContractDeployZone(title: string): 'station_chain' | 'planet' | null {
  switch (title) {
    case SURVEY_DRIVE_CONTRACT_TITLE:
    case STATION_DEBRIS_CONTRACT_TITLE:
      return 'station_chain';
    case PLANET_BEACON_CONTRACT_TITLE:
      return 'planet';
    default:
      return null;
  }
}

/** Short onboarding copy for raid HUD panels. */
export function getContractRaidHint(title: string, zone: ContractRaidZone): string {
  switch (title) {
    case SURVEY_DRIVE_CONTRACT_TITLE:
      return zone === 'station'
        ? "Use the orange lift aft to descend to the moonbase. Recover the survey drive in deep ops storage, green extract east, then the station's green beacon returns loot and contract progress to the ship."
        : 'Survey drive sits in the far north wing (gold loot target). Exit through the green volume east to reach the station again.';
    case STATION_DEBRIS_CONTRACT_TITLE:
      return zone === 'station'
        ? `Eliminate at least ${STATION_DEBRIS_KILLS_REQUIRED} corridor hostiles here, then walk into the green return volume aft to merge inventory and finalize the contract payout aboard ship.`
        : 'Kill quota is tracked on the station. When you shuttle moon-side, station clears reset — earn fresh kills there, then extract via green -> ship.';
    case PLANET_BEACON_CONTRACT_TITLE:
      return zone === 'planet'
        ? 'Push through the outpost labs to the deep storage room (gold crate). Secure the beacon core, then walk into the green extract volume to return to the freighter and cash out.'
        : 'Match contract goals on-site, then use green extract volumes to preserve loot and payouts.';
    default:
      return 'Match contract goals on-site, then use green extract volumes to preserve loot and payouts.';
  }
}

export function contractProgressSummary(
  title: string,
  inventory: RaidItem[],
  stationKills: number
): string | null {
  switch (title) {
    case SURVEY_DRIVE_CONTRACT_TITLE:
      return hasSurveyDrive(inventory)
        ? 'Survey drive in pack — extract chain to ship to cash out.'
        : 'Locate and pick up the survey drive before banking via green extract.';
    case STATION_DEBRIS_CONTRACT_TITLE:
      return `Station hostile clears: ${Math.min(stationKills, STATION_DEBRIS_KILLS_REQUIRED)} / ${STATION_DEBRIS_KILLS_REQUIRED}${stationKills >= STATION_DEBRIS_KILLS_REQUIRED ? ' — ready once you extract to the ship.' : ''}`;
    case PLANET_BEACON_CONTRACT_TITLE:
      return hasBeaconCore(inventory)
        ? 'Beacon core in pack — reach the green extract to return to the freighter.'
        : 'Locate the beacon core in the deep lab (gold crate) before extracting.';
    default:
      return null;
  }
}

export function hubDockingAllowed(
  contracts: ReadonlyArray<{ isCompleted: boolean }>,
  activeContractId: number | null
): boolean {
  if (activeContractId !== null) return true;
  return contracts.every((c) => c.isCompleted);
}
