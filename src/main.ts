import React from 'react';
import ReactDOM from 'react-dom/client';
import { Game } from './game/Game';
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

// Export game instance for global access (debugging)
(window as any).game = gameInstance;
