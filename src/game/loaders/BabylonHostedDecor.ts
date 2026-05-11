import { Scene, SceneLoader, Vector3 } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { BABYLON_MODELS, BABYLON_MESHES } from './BabylonAssetUrls';

/** Alias for meshes CDN — kept for callers that imported the old name */
export const BABYLON_MODELS_ROOT = BABYLON_MODELS;

export interface PlaceBabylonModelOptions {
  position: Vector3;
  scale?: number;
  rotationY?: number;
  useMeshesRoot?: boolean;
}

/**
 * Imports a decorative mesh from Babylon.js CDNs. Visual-only — no physics.
 */
export async function placeBabylonModel(
  scene: Scene,
  fileName: string,
  opts: PlaceBabylonModelOptions,
  subFolder?: string
): Promise<void> {
  let rootUrl = opts.useMeshesRoot ? BABYLON_MESHES : BABYLON_MODELS;
  if (subFolder) {
    rootUrl = `${rootUrl}${subFolder.replace(/^\/+|\/+$/g, '')}/`;
  }

  try {
    const result = await SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene);
    const root = result.meshes[0];
    if (!root) return;

    root.position.copyFrom(opts.position);
    const s = opts.scale ?? 1;
    root.scaling.setAll(s);
    if (opts.rotationY !== undefined) {
      root.rotation.y = opts.rotationY;
    }

    for (const mesh of result.meshes) {
      mesh.isPickable = false;
    }
  } catch (e) {
    console.warn(`[BabylonHostedDecor] Could not load ${rootUrl}${fileName}`, e);
  }
}