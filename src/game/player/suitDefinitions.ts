/**
 * Suit class definitions for Void Sovereigns.
 * Each class has distinct base stats and movement modifiers.
 */

export type SuitClassId = 'pathfinder' | 'bulwark' | 'tech_specialist';

export interface SuitArchetype {
  id: SuitClassId;
  displayName: string;
  description: string;
  baseHealth: number;
  baseStamina: number;
  baseBattery: number;
  speedMultiplier: number;
  jumpMultiplier: number;
  staminaRegenMultiplier: number;
  batteryRechargeMultiplier: number;
}

export const SUIT_ARCHETYPES: Record<SuitClassId, SuitArchetype> = {
  pathfinder: {
    id: 'pathfinder',
    displayName: 'Pathfinder',
    description: 'Lightweight agility suit for rapid scouting and repositioning.',
    baseHealth: 80,
    baseStamina: 130,
    baseBattery: 100,
    speedMultiplier: 1.15,
    jumpMultiplier: 1.2,
    staminaRegenMultiplier: 1.25,
    batteryRechargeMultiplier: 1.0,
  },
  bulwark: {
    id: 'bulwark',
    displayName: 'Bulwark',
    description: 'Heavy armor plating and reinforced servos for sustained combat.',
    baseHealth: 160,
    baseStamina: 70,
    baseBattery: 90,
    speedMultiplier: 0.85,
    jumpMultiplier: 0.8,
    staminaRegenMultiplier: 0.75,
    batteryRechargeMultiplier: 0.8,
  },
  tech_specialist: {
    id: 'tech_specialist',
    displayName: 'Tech Specialist',
    description: 'High-efficiency power systems and integrated sensor arrays.',
    baseHealth: 100,
    baseStamina: 100,
    baseBattery: 150,
    speedMultiplier: 1.0,
    jumpMultiplier: 1.0,
    staminaRegenMultiplier: 1.0,
    batteryRechargeMultiplier: 1.5,
  },
};

export function getSuitArchetype(id: SuitClassId): SuitArchetype {
  return SUIT_ARCHETYPES[id] || SUIT_ARCHETYPES.pathfinder;
}
