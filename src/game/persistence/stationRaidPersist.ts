import { contractPayoutEligible } from '../contracts/contractRules';
import { db, type Contract, type StashItem } from './SaveDB';

export type RaidPersistItem = { itemId: string; quantity: number; stats?: unknown };

export interface StationRaidExtractResult {
  /** Title of the contract that just paid out, if any. */
  paidContractTitle: string | null;
  /** Credits added to the profile from the payout, 0 when nothing settled. */
  paidContractReward: number;
}

/**
 * Persists raid inventory into stash, settles active contract payouts, demotes loadout→stash — same semantics as stepping into the station green extract.
 * Returns a payout summary so callers (raid scene → HUD) can surface a toast.
 */
export async function persistStationRaidExtract(options: {
  inventory: RaidPersistItem[];
  stationKillsSinceDock: number;
}): Promise<StationRaidExtractResult> {
  const { inventory, stationKillsSinceDock } = options;
  let paidContractTitle: string | null = null;
  let paidContractReward = 0;

  await db.transaction('rw', db.stashItems, db.contracts, db.playerProfile, async () => {
    for (const item of inventory) {
      if (item.stats) {
        await db.stashItems.add({
          itemId: item.itemId,
          quantity: item.quantity,
          slot: 'stash',
          stats: item.stats as StashItem['stats'],
        });
      } else {
        const existing = await db.stashItems
          .where('itemId')
          .equals(item.itemId)
          .filter((row) => row.slot === 'stash' && !row.stats)
          .first();
        if (existing) {
          await db.stashItems.update(existing.id!, {
            quantity: existing.quantity + item.quantity,
          });
        } else {
          await db.stashItems.add({
            itemId: item.itemId,
            quantity: item.quantity,
            slot: 'stash',
          });
        }
      }
    }

    const activeContract = (await db.contracts.toArray()).find((c) => c.isActive);

    const payContract = async (contract: Contract) => {
      if (contract.id === undefined) return;
      await db.contracts.update(contract.id, {
        isCompleted: true,
        isActive: false,
      });
      const profile = await db.playerProfile.toCollection().first();
      if (profile) {
        await db.playerProfile.update(profile.id!, {
          money: profile.money + contract.reward,
        });
      }
    };

    if (activeContract && contractPayoutEligible(activeContract, inventory, stationKillsSinceDock)) {
      await payContract(activeContract);
      paidContractTitle = activeContract.title;
      paidContractReward = activeContract.reward;
      console.log('Contract Completed!');
    }

    const loadoutItems = await db.stashItems.where('slot').equals('loadout').toArray();
    for (const item of loadoutItems) {
      await db.stashItems.update(item.id!, { slot: 'stash' });
    }
  });

  return { paidContractTitle, paidContractReward };
}
