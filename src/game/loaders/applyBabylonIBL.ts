import { CubeTexture, ImageProcessingConfiguration, Scene } from '@babylonjs/core';

export interface ApplyIblOptions {
  /** Environment radiance strength (0–2 typical). */
  intensity?: number;
  /** Use ACES tonemapping for HDR-like grading. */
  acesToneMapping?: boolean;
  exposure?: number;
  contrast?: number;
}

/**
 * Adds Babylon CDN prefiltered IBL so PBR + imported glTF respond to consistent lighting.
 */
export function applyBabylonIBL(
  scene: Scene,
  envUrl: string = 'https://assets.babylonjs.com/environments/studio.env',
  opts: ApplyIblOptions = {}
): void {
  const {
    intensity = 0.72,
    acesToneMapping = true,
    exposure = 0.92,
    contrast = 1.04,
  } = opts;

  try {
    const cube = CubeTexture.CreateFromPrefilteredData(envUrl, scene);
    scene.environmentTexture = cube;
    scene.environmentIntensity = intensity;
  } catch (e) {
    console.warn('[applyBabylonIBL] Failed to load', envUrl, e);
    return;
  }

  const ipc = scene.imageProcessingConfiguration;
  ipc.exposure = exposure;
  ipc.contrast = contrast;
  if (acesToneMapping) {
    ipc.toneMappingEnabled = true;
    ipc.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  }
}
