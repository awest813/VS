/**
 * URLs for audio files shipped with the Babylon.js playground (free to use with the engine).
 * @see https://github.com/BabylonJS/Babylon.js/tree/master/packages/tools/playground/public/sounds
 *
 * Long-form assets (`6sounds.mp3`, `cellolong.wav`, `violons*.wav`) are intentionally unused here
 * to avoid large downloads and sprite timing on cold load.
 */

export const BABYLON_PLAYGROUND_SOUNDS_ROOT =
  'https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/sounds';

export const BabylonPlaygroundSound = {
  gunshot: `${BABYLON_PLAYGROUND_SOUNDS_ROOT}/gunshot.wav`,
  bounce: `${BABYLON_PLAYGROUND_SOUNDS_ROOT}/bounce.wav`,
} as const;

/** Normalized levels — tune once; avoids clipping when stacking spatial sources. */
export const AudioMix = {
  /** Served from `public/sounds/` (Vite exposes `public/` at the site root). */
  reloadStartSrc: '/sounds/reload_start.wav',
  reloadChamberSrc: '/sounds/reload_chamber.wav',
  weaponFireVolume: 0.48,
  weaponFireRateMin: 1.12,
  weaponFireRateSpan: 0.22,
  reloadVolume: 0.34,
  reloadRateMin: 0.63,
  reloadRateSpan: 0.09,
  reloadChamberVolume: 0.28,
  reloadChamberRateMin: 0.94,
  reloadChamberRateSpan: 0.07,
  footstepVolume: 0.15,
  footstepVolumeMetal: 0.19,
  footstepRateMin: 0.34,
  footstepRateMetalBoost: 0.09,
  footstepRateJitter: 0.05,
  jumpVolume: 0.36,
  jumpRateMin: 0.76,
  jumpRateJitter: 0.06,
  uiBlipVolumeInteract: 0.26,
  uiBlipVolumeFlashlight: 0.11,
  uiBlipVolumeMedkit: 0.4,
  uiBlipVolumeGadget: 0.48,
  uiBlipRateInteract: 1.22,
  uiBlipRateFlashlight: 1.58,
  uiBlipRateMedkitMin: 0.93,
  uiBlipRateMedkitSpan: 0.06,
  uiBlipRateGadget: 0.41,
} as const;
