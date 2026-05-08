import type { LootRarity } from './lootTypes';
import { getLootDefinition } from './lootDatabase';

/** Muted text accents for HUD lists (readable on dark UI). */
export function lootRarityTextColorCss(rarity: LootRarity | undefined): string {
  switch (rarity) {
    case 'common':
      return 'rgba(195, 200, 210, 0.92)';
    case 'uncommon':
      return 'rgba(110, 220, 150, 0.95)';
    case 'rare':
      return 'rgba(140, 190, 255, 0.98)';
    case 'epic':
      return 'rgba(210, 160, 255, 0.98)';
    case 'legendary':
      return 'rgba(255, 200, 120, 0.98)';
    default:
      return 'rgba(200, 210, 225, 0.88)';
  }
}

export function lootColorForItemId(itemId: string): string {
  return lootRarityTextColorCss(getLootDefinition(itemId)?.rarity);
}
