import { describe, it, expect } from 'vitest';
import { isInteractableTarget } from './interactionRay';

describe('isInteractableTarget', () => {
  it('returns true only for pickable meshes with function onInteract', () => {
    expect(isInteractableTarget(null)).toBe(false);
    expect(isInteractableTarget({})).toBe(false);
    expect(isInteractableTarget({ metadata: {} })).toBe(false);
    expect(isInteractableTarget({ metadata: { onInteract: 'nope' } })).toBe(false);
    expect(
      isInteractableTarget({
        metadata: { onInteract: () => {} },
      })
    ).toBe(true);
    expect(
      isInteractableTarget({
        isPickable: false,
        metadata: { onInteract: () => {} },
      })
    ).toBe(false);
  });
});
