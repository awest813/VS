import { describe, expect, it } from 'vitest';
import { humanizeHudTarget } from './uiTokens';

describe('uiTokens', () => {
  it('humanizeHudTarget title-cases underscore slugs', () => {
    expect(humanizeHudTarget('cargo_crate')).toBe('Cargo Crate');
  });

  it('humanizeHudTarget trims and collapses delimiter noise for HUD readability', () => {
    expect(humanizeHudTarget('__airlock___alpha__')).toBe('Airlock Alpha');
    expect(humanizeHudTarget('  survey___drive  ')).toBe('Survey Drive');
  });

  it('humanizeHudTarget returns empty for delimiter-only slugs', () => {
    expect(humanizeHudTarget('___')).toBe('');
  });
});
