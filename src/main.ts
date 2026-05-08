import React from 'react';
import ReactDOM from 'react-dom/client';
import { Game } from './game/Game';
import { GameState } from './game/StateMachine';
import App from './App';

// Initialize Game Engine
const canvas = document.createElement('canvas');
canvas.id = 'renderCanvas';
document.body.appendChild(canvas);

const gameInstance = new Game(canvas);

// Initialize React UI
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    React.createElement(App, { game: gameInstance })
  );
}

// Export game instance for global access (debugging / automation hooks)
declare global {
  interface Window {
    game: Game;
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

window.game = gameInstance;

window.render_game_to_text = () =>
  JSON.stringify({
    state: GameState[gameInstance.stateMachine.getState()],
    raidCount: gameInstance.raidInventory.length,
    loadoutStagingApplied: gameInstance.loadoutStagingApplied,
    stationExtractPending: gameInstance.stationExtractPending,
    stationKills: gameInstance.enemiesKilledStation,
    health: gameInstance.player?.health ?? null,
    weaponReserve: gameInstance.player?.weapon?.reserveAmmo ?? null,
  });

/** Optional hook for headless/tests; deterministic stepping is limited without a dedicated tick API. */
window.advanceTime = () => {};
