/**
 * Canonical contract titles and pure payout / UI helpers shared by Dexie seeds,
 * station extraction, and the React HUD.
 */

export const SURVEY_DRIVE_CONTRACT_TITLE = 'Recover Survey Drive';

export const STATION_DEBRIS_CONTRACT_TITLE = 'Clear Station Debris';

export const PLANET_BEACON_CONTRACT_TITLE = 'Recover Beacon Core';

export const SALVAGER_SWEEP_CONTRACT_TITLE = 'Sweep Salvager Boarding Party';

export const BLACK_SITE_BEACON_CONTRACT_TITLE = 'Recover Black Site Beacon';

export const STATION_DEBRIS_KILLS_REQUIRED = 2;

export const SALVAGER_SWEEP_KILLS_REQUIRED = 4;

export type RaidItem = { itemId: string; quantity: number };

export type ContractRaidZone = 'station' | 'moon' | 'planet';

type ContractDefinition = {
  title: string;
  description: string;
  reward: number;
  deployZone: 'station_chain' | 'planet';
  unlockAfterCompleted: number;
  objective:
    | {
        kind: 'inventory';
        itemId: 'survey_drive' | 'beacon_core';
        itemLabel: string;
      }
    | {
        kind: 'station_kills';
        requiredKills: number;
      }
    | {
        kind: 'terminal_hack';
        requiredHacks: number;
      }
    | {
        kind: 'data_retrieval';
        recoveredId: string;
      };
};

const CONTRACT_DEFINITIONS: readonly ContractDefinition[] = [
  {
    title: SURVEY_DRIVE_CONTRACT_TITLE,
    description:
      'Frontier contract: board the declining stack, bring the transit lift online, descend to the lunar spine, and recover the survey drive from deep ops. Chain green extracts so loot and payout eligibility ride home to the ship.',
    reward: 750,
    deployZone: 'station_chain',
    unlockAfterCompleted: 0,
    objective: {
      kind: 'inventory',
      itemId: 'survey_drive',
      itemLabel: 'survey drive',
    },
  },
  {
    title: STATION_DEBRIS_CONTRACT_TITLE,
    description: `Dock-authority hygiene ticket — eliminate at least ${STATION_DEBRIS_KILLS_REQUIRED} hostiles in the abandoned transfer corridor. Green beacon aft banks your haul; credits finalize when you extract aboard ship.`,
    reward: 300,
    deployZone: 'station_chain',
    unlockAfterCompleted: 1,
    objective: {
      kind: 'station_kills',
      requiredKills: STATION_DEBRIS_KILLS_REQUIRED,
    },
  },
  {
    title: PLANET_BEACON_CONTRACT_TITLE,
    description:
      'MTA salvage order: deploy to the abandoned Venusian outpost, push through the pressurized labs, and retrieve the beacon core from deep storage before the atmosphere finishes the job the last crew started. Extract green to bank your haul.',
    reward: 600,
    deployZone: 'planet',
    unlockAfterCompleted: 2,
    objective: {
      kind: 'inventory',
      itemId: 'beacon_core',
      itemLabel: 'beacon core',
    },
  },
  {
    title: SALVAGER_SWEEP_CONTRACT_TITLE,
    description: `Quartermaster escalation — sweep the relay transfer corridors and put down at least ${SALVAGER_SWEEP_KILLS_REQUIRED} Thornfield boarders before they compromise the ship approach. Extract green, then settle back aboard the freighter.`,
    reward: 950,
    deployZone: 'station_chain',
    unlockAfterCompleted: 3,
    objective: {
      kind: 'station_kills',
      requiredKills: SALVAGER_SWEEP_KILLS_REQUIRED,
    },
  },
  {
    title: BLACK_SITE_BEACON_CONTRACT_TITLE,
    description:
      'Unsanctioned warrant — return to the outpost, breach the black-site vault, and drag its beacon core back through a clean extract before the scavengers or the weather finish you off.',
    reward: 1400,
    deployZone: 'planet',
    unlockAfterCompleted: 4,
    objective: {
      kind: 'inventory',
      itemId: 'beacon_core',
      itemLabel: 'beacon core',
    },
  },
  {
    title: 'System Override',
    description: 'Bypass the station’s security relay in the transfer corridor to disrupt local patrols. Extract clean to finalize the payment.',
    reward: 450,
    deployZone: 'station_chain',
    unlockAfterCompleted: 1,
    objective: {
      kind: 'terminal_hack',
      requiredHacks: 1,
    },
  },
  {
    title: 'Deep Ops Intel',
    description: 'Infiltrate the moonbase deep storage and retrieve the encrypted personnel logs from the secure console. Data is worth more than scrap — extract green.',
    reward: 850,
    deployZone: 'station_chain',
    unlockAfterCompleted: 3,
    objective: {
      kind: 'data_retrieval',
      recoveredId: 'moon_intel_01',
    },
  },
] as const;

const CONTRACT_DEFINITION_BY_TITLE = new Map(
  CONTRACT_DEFINITIONS.map((definition) => [definition.title, definition] as const)
);

/** Single source for Dexie seed copy — keep UI, hints, and DB aligned. */
export const CANONICAL_CONTRACT_SEEDS: ReadonlyArray<{
  title: string;
  description: string;
  reward: number;
}> = CONTRACT_DEFINITIONS.map(({ title, description, reward }) => ({
  title,
  description,
  reward,
}));

function getContractDefinition(title: string): ContractDefinition | null {
  return CONTRACT_DEFINITION_BY_TITLE.get(title) ?? null;
}

export function hasSurveyDrive(inv: RaidItem[]): boolean {
  return inv.some((i) => i.itemId === 'survey_drive' && i.quantity > 0);
}

export function hasBeaconCore(inv: RaidItem[]): boolean {
  return inv.some((i) => i.itemId === 'beacon_core' && i.quantity > 0);
}

function hasObjectiveItem(inv: RaidItem[], itemId: 'survey_drive' | 'beacon_core'): boolean {
  return inv.some((i) => i.itemId === itemId && i.quantity > 0);
}

export function contractPayoutEligible(
  active: Pick<{ title: string }, 'title'> | null | undefined,
  inv: RaidItem[],
  stationKillsSinceDock: number,
  game?: { terminalsHacked?: number; dataRecoveredIds?: string[] }
): boolean {
  const definition = active?.title ? getContractDefinition(active.title) : null;
  if (!definition) return false;

  if (definition.objective.kind === 'inventory') {
    return hasObjectiveItem(inv, definition.objective.itemId);
  }

  if (definition.objective.kind === 'terminal_hack') {
    return (game?.terminalsHacked ?? 0) >= definition.objective.requiredHacks;
  }

  if (definition.objective.kind === 'data_retrieval') {
    return game?.dataRecoveredIds?.includes(definition.objective.recoveredId) ?? false;
  }

  // station_kills
  return stationKillsSinceDock >= (definition.objective as { requiredKills: number }).requiredKills;
}

/** Returns which deployment zone a contract belongs to. */
export function getContractDeployZone(title: string): 'station_chain' | 'planet' | null {
  return getContractDefinition(title)?.deployZone ?? null;
}

export function getContractUnlockRequirement(title: string): number {
  return getContractDefinition(title)?.unlockAfterCompleted ?? 0;
}

export function isContractUnlocked(title: string, completedContractCount: number): boolean {
  return completedContractCount >= getContractUnlockRequirement(title);
}

/** Short onboarding copy for raid HUD panels. */
export function getContractRaidHint(title: string, zone: ContractRaidZone): string {
  const definition = getContractDefinition(title);
  if (!definition) {
    return 'Match contract goals on-site, then use green extract volumes to preserve loot and payouts.';
  }

  if (definition.objective.kind === 'station_kills') {
    return zone === 'station'
      ? `Eliminate at least ${definition.objective.requiredKills} corridor hostiles here, then walk into the green return volume aft to merge inventory and finalize the contract payout aboard ship.`
      : 'Kill quotas are tracked on the station. When you shuttle moon-side, station clears reset — earn the kills there, then extract via green -> ship.';
  }

  if (definition.deployZone === 'station_chain') {
    return zone === 'station'
      ? "Use the orange lift aft to descend to the moonbase. Recover the survey drive in deep ops storage, green extract east, then the station's green beacon returns loot and contract progress to the ship."
      : 'Survey drive sits in the far north wing (gold loot target). Exit through the green volume east to reach the station again.';
  }

  return zone === 'planet'
    ? 'Push through the outpost labs to the deep storage room (gold crate). Secure the beacon core, then walk into the green extract volume to return to the freighter and cash out.'
    : 'Match contract goals on-site, then use green extract volumes to preserve loot and payouts.';
}

export function contractProgressSummary(
  title: string,
  inventory: RaidItem[],
  stationKills: number,
  game?: { terminalsHacked?: number; dataRecoveredIds?: string[] }
): string | null {
  const definition = getContractDefinition(title);
  if (!definition) return null;

  if (definition.objective.kind === 'inventory') {
    return hasObjectiveItem(inventory, definition.objective.itemId)
      ? `${definition.objective.itemLabel} in pack — extract to the freighter to cash out.`
      : `Locate and secure the ${definition.objective.itemLabel} before banking via green extract.`;
  }

  if (definition.objective.kind === 'terminal_hack') {
    const current = game?.terminalsHacked ?? 0;
    const required = definition.objective.requiredHacks;
    return `Terminal hacks: ${current} / ${required}${current >= required ? ' — ready for extraction.' : ''}`;
  }

  if (definition.objective.kind === 'data_retrieval') {
    const hasData = game?.dataRecoveredIds?.includes(definition.objective.recoveredId);
    return hasData
      ? 'Intel secured in buffer — extract to ship to finalize.'
      : 'Locate secure console and download intelligence data.';
  }

  const requiredKills = definition.objective.requiredKills;
  return `Station hostile clears: ${Math.min(stationKills, requiredKills)} / ${requiredKills}${stationKills >= requiredKills ? ' — ready once you extract to the ship.' : ''}`;
}

export function hubDockingAllowed(
  contracts: ReadonlyArray<{ isCompleted: boolean }>,
  activeContractId: number | null
): boolean {
  if (activeContractId !== null) return true;
  return contracts.every((c) => c.isCompleted);
}
