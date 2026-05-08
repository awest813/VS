import { describe, it, expect } from 'vitest';
import { GameState, StateMachine } from './StateMachine';

describe('StateMachine', () => {
  it('does not notify listeners when setting the same state', () => {
    const sm = new StateMachine(GameState.SHIP);
    let fires = 0;
    sm.onStateChange(() => {
      fires++;
    });
    sm.setState(GameState.SHIP);
    expect(fires).toBe(0);
  });

  it('fires on valid transitions', () => {
    const sm = new StateMachine(GameState.SHIP);
    const seen: GameState[] = [];
    sm.onStateChange((s) => {
      seen.push(s);
    });
    sm.setState(GameState.STATION);
    sm.setState(GameState.MOON_BASE);
    expect(seen).toEqual([GameState.STATION, GameState.MOON_BASE]);
  });
});
