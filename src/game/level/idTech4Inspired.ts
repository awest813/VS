/**
 * Ideas borrowed from Doom 3 / id Tech 4’s open-described design philosophy (not a port):
 * - **Very low ambient** so authored point lights read; player-held light anchors exploration.
 * - **Data-declared placements** analogous to `.map`/entity spawning (see `moonBaseDefs.ts`).
 * - **Surface hooks** on static brushes for gameplay/audio (closest public analogue to texture/sound shaders).
 *
 * We do **not** implement stencil shadow volumes or their renderer—Babylon uses standard lights/shadowmaps.
 */

/** Moon raid: Doom-like dark fill; compensate with flashlight + authored points. */
export const doom3RaidMoonIBL = {
  intensity: 0.34,
  exposure: 0.82,
  contrast: 1.06,
  hemisphereIntensity: 0.075,
  fogDensity: 0.034,
} as const;

/** Handheld “shoulder lamp” analogue (narrow range = less fill, reads closer to Tech 4 mood). */
export const doom3HandLight = {
  /** Max intensity multiplier when flashlight is enabled and battery is full */
  intensityAtFullBattery: 2.35,
  range: 28,
  /** Base intensity multiplier on ship (recharging, friendlier hubs) */
  shipIntensityMultiplier: 0.92,
} as const;

/** Station: still low-ish fill versus older “flat ambient” shooters, brighter than lunar raid */
export const doom3FacilityAmbient = {
  hemisphereIntensity: 0.21,
} as const;

/** Single source for flashlight brightness (preserve / ship hub / raid). */
export function flashlightOutputIntensity(opts: {
  flashlightOn: boolean;
  battery: number;
  maxBattery: number;
  shipHub: boolean;
}): number {
  const { flashlightOn, battery, maxBattery, shipHub } = opts;
  if (!flashlightOn || battery <= 0 || maxBattery <= 0) return 0;
  const frac = Math.max(0, Math.min(1, battery / maxBattery));
  let v = frac * doom3HandLight.intensityAtFullBattery;
  if (shipHub) v *= doom3HandLight.shipIntensityMultiplier;
  return v;
}
