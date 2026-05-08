import { describe, expect, it } from 'vitest';
import {
  doom3HandLight,
  flashlightOutputIntensity,
} from './idTech4Inspired';

describe('idTech4Inspired flash helper', () => {
  it('returns 0 when flashlight off or depleted', () => {
    expect(
      flashlightOutputIntensity({
        flashlightOn: false,
        battery: 50,
        maxBattery: 100,
        shipHub: false,
      })
    ).toBe(0);
    expect(
      flashlightOutputIntensity({
        flashlightOn: true,
        battery: 0,
        maxBattery: 100,
        shipHub: false,
      })
    ).toBe(0);
  });

  it('applies ship hub dimmer at full battery', () => {
    const raid = flashlightOutputIntensity({
      flashlightOn: true,
      battery: 100,
      maxBattery: 100,
      shipHub: false,
    });
    const ship = flashlightOutputIntensity({
      flashlightOn: true,
      battery: 100,
      maxBattery: 100,
      shipHub: true,
    });
    expect(raid).toBeCloseTo(doom3HandLight.intensityAtFullBattery, 5);
    expect(ship).toBeCloseTo(doom3HandLight.intensityAtFullBattery * doom3HandLight.shipIntensityMultiplier, 5);
    expect(ship).toBeLessThan(raid);
  });
});
