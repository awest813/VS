import { Engine, Scene, Color4, Vector3, HavokPlugin, RecastJSPlugin } from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import Recast from 'recast-detour';
import { StateMachine, GameState } from './StateMachine';
import { db } from './persistence/SaveDB';

export class Game {
  public engine: Engine;
  public canvas: HTMLCanvasElement;
  public stateMachine: StateMachine;
  public activeScene: Scene | null = null;
  public havokPlugin: HavokPlugin | null = null;
  public navigationPlugin: RecastJSPlugin | null = null;
  public player: any = null; // Using any to avoid circular dependency for now
  
  public raidInventory: { itemId: string, quantity: number, stats?: any }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });
    this.stateMachine = new StateMachine(GameState.START_MENU);

    this.init();
  }

  private async init() {
    // Initialize DB
    await db.initializeDefault();

    // Initialize Havok
    const havokInstance = await HavokPhysics({
      locateFile: () => '/HavokPhysics.wasm'
    });
    this.havokPlugin = new HavokPlugin(true, havokInstance);

    // Initialize Recast Navigation
    const recast = await Recast();
    this.navigationPlugin = new RecastJSPlugin(recast);

    // Setup state listeners
    this.stateMachine.onStateChange((newState) => {
      this.handleStateChange(newState);
    });

    // Start with Ship
    this.stateMachine.setState(GameState.SHIP);

    // Run render loop
    this.engine.runRenderLoop(() => {
      if (this.activeScene) {
        this.activeScene.render();
      }
    });

    // Resize listener
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

  private async handleStateChange(state: GameState) {
    console.log(`Game State Changed to: ${GameState[state]}`);
    
    // Dispose old scene
    if (this.activeScene) {
      this.activeScene.dispose();
      this.activeScene = null;
    }

    // Clear raid inventory if going back to ship (handled in extraction, but safety clear here)
    if (state === GameState.SHIP) {
      this.raidInventory = [];
    }

    switch (state) {
      case GameState.SHIP:
        await this.loadShipScene();
        break;
      case GameState.STATION:
        await this.loadStationScene();
        break;
      case GameState.MOON_BASE:
        await this.loadMoonBaseScene();
        break;
      default:
        // Generic fallback scene
        this.activeScene = new Scene(this.engine);
        this.activeScene.clearColor = new Color4(0, 0, 0, 1);
        break;
    }
  }

  private async loadShipScene() {
    const { ShipScene } = await import('./scenes/ShipScene');
    const ship = new ShipScene(this);
    this.activeScene = await ship.create();
  }

  private async loadStationScene() {
    const { StationScene } = await import('./scenes/StationScene');
    const station = new StationScene(this);
    this.activeScene = await station.create();
  }

  private async loadMoonBaseScene() {
    const { MoonBaseScene } = await import('./scenes/MoonBaseScene');
    const base = new MoonBaseScene(this);
    this.activeScene = await base.create();
  }
}
