/**
 * Gadget and consumable definitions for Void Sovereigns.
 */

export type GadgetItemId = 'flare_chem' | 'shield_deploy' | 'sensor_sweep';

export interface GadgetArchetype {
  id: GadgetItemId;
  displayName: string;
  description: string;
  cooldownMs: number;
  /** Visual effect duration or deployment lifetime */
  durationMs: number;
}

export const GADGET_ARCHETYPES: Record<GadgetItemId, GadgetArchetype> = {
  flare_chem: {
    id: 'flare_chem',
    displayName: 'Chemical Flare',
    description: 'Deploys a high-intensity chemical light source that illuminates a large area.',
    cooldownMs: 5000,
    durationMs: 30000,
  },
  shield_deploy: {
    id: 'shield_deploy',
    displayName: 'Portable Shield',
    description: 'Deploys a temporary energy barrier that blocks incoming fire.',
    cooldownMs: 25000,
    durationMs: 8000,
  },
  sensor_sweep: {
    id: 'sensor_sweep',
    displayName: 'Sensor Sweep',
    description: 'Pings the local area to reveal enemy positions through walls.',
    cooldownMs: 15000,
    durationMs: 3000,
  },
};

export function getGadgetArchetype(id: string): GadgetArchetype | null {
  return GADGET_ARCHETYPES[id as GadgetItemId] || null;
}
