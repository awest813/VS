export enum GameState {
  START_MENU,
  SHIP,
  STATION,
  MOON_BASE,
  RESULTS,
  DEATH
}

export type StateChangeCallback = (newState: GameState, oldState?: GameState) => void;

export class StateMachine {
  private currentState: GameState = GameState.START_MENU;
  private listeners: StateChangeCallback[] = [];

  constructor(initialState: GameState = GameState.START_MENU) {
    this.currentState = initialState;
  }

  public getState(): GameState {
    return this.currentState;
  }

  public setState(newState: GameState): void {
    if (this.currentState === newState) return;
    
    const oldState = this.currentState;
    this.currentState = newState;
    
    this.listeners.forEach(callback => callback(newState, oldState));
  }

  public onStateChange(callback: StateChangeCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }
}
