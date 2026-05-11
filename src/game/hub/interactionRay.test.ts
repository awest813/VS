import { describe, it, expect } from 'vitest';
import { isInteractableTarget, resolveInteractableTarget } from './interactionRay';

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

  it('resolves interactable parent meshes for nested model parts', () => {
    const parent = {
      name: 'NPC root',
      metadata: { hudLabel: 'Quartermaster', onInteract: () => {} },
    };
    const child = {
      name: 'NPC mesh part',
      parent,
    };

    expect(isInteractableTarget(child)).toBe(true);
    expect(resolveInteractableTarget(child)).toBe(parent);
  });
});
