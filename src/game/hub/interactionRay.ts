/**
 * Babylon pick predicate: include only meshes with an interaction handler so decor/floors/walls/glass cannot block the hub console.
 */

export interface PickableInteractableLike {
  isPickable?: boolean;
  metadata?: {
    onInteract?: unknown;
  };
}

export function isInteractableTarget(mesh: PickableInteractableLike | null): mesh is PickableInteractableLike {
  return (
    !!mesh &&
    typeof mesh.metadata?.onInteract === 'function' &&
    mesh.isPickable !== false
  );
}
