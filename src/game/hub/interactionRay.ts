/**
 * Babylon pick predicate: include only meshes with an interaction handler so decor/floors/walls/glass cannot block the hub console.
 */

export interface PickableInteractableLike {
  isPickable?: boolean;
  parent?: PickableInteractableLike | null;
  metadata?: {
    hudLabel?: unknown;
    onInteract?: unknown;
  };
  name?: string;
}

function hasInteractHandler(mesh: PickableInteractableLike | null): boolean {
  return !!mesh && typeof mesh.metadata?.onInteract === 'function' && mesh.isPickable !== false;
}

export function resolveInteractableTarget(mesh: PickableInteractableLike | null): PickableInteractableLike | null {
  let current: PickableInteractableLike | null = mesh;
  while (current) {
    if (hasInteractHandler(current)) return current;
    current = current.parent ?? null;
  }
  return null;
}

export function isInteractableTarget(mesh: PickableInteractableLike | null): mesh is PickableInteractableLike {
  return resolveInteractableTarget(mesh) !== null;
}
