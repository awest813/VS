import { Engine, Scene, Color4, Vector3, HavokPlugin, RecastJSPlugin } from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import Recast from 'recast-detour';
import { StateMachine, GameState } from './StateMachine';
import { db } from './persistence/SaveDB';

/** Vitals and weapon ammo carried across station ↔ moon (and ship → first drop). Hub load clears this. */
export interface PreservedPlayerState {
  health: number;
  maxHealth: number;
  battery: number;
  maxBattery: number;
  flashlightOn: boolean;
  currentAmmo: number;
  reserveAmmo: number;
}

export class Game {
  public engine: Engine;
  public canvas: HTMLCanvasElement;
  public stateMachine: StateMachine;
  public activeScene: Scene | null = null;
  public havokPlugin: HavokPlugin | null = null;
  public navigationPlugin: RecastJSPlugin | null = null;
  public player: any = null; // Using any to avoid circular dependency for now
  
  public raidInventory: { itemId: string, quantity: number, stats?: any }[] = [];
  /** False after leaving the ship until first loadout staging runs for this run. */
  public loadoutStagingApplied = false;
  public preservedPlayerState: PreservedPlayerState | null = null;
  /** Prevents overlapping station→ship async extract + state changes. */
  public stationExtractPending = false;
  /** Hostiles killed while in the station (for “Clear Station Debris”); reset when docking from the ship. */
  public enemiesKilledStation = 0;

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

    this.stateMachine.onStateChange((newState, oldState) => {
      void this.handleStateChange(newState, oldState);
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

  private capturePlayerState() {
    const p = this.player;
    if (!p) return;
    this.preservedPlayerState = {
      health: p.health,
      maxHealth: p.maxHealth,
      battery: p.battery,
      maxBattery: p.maxBattery,
      flashlightOn: p.flashlightOn,
      currentAmmo: p.weapon?.currentAmmo ?? 0,
      reserveAmmo: p.weapon?.reserveAmmo ?? 0,
    };
  }

  private async handleStateChange(state: GameState, previous?: GameState) {
    console.log(`Game State Changed to: ${GameState[state]}`);

    if (state === GameState.STATION && previous === GameState.SHIP) {
      this.enemiesKilledStation = 0;
    }
    if (state === GameState.STATION && previous === GameState.MOON_BASE) {
      this.enemiesKilledStation = 0;
    }

    if (this.activeScene) {
      if (this.player) this.capturePlayerState();
      this.activeScene.dispose();
      this.activeScene = null;
    }

    if (state === GameState.SHIP) {
      this.raidInventory = [];
      this.loadoutStagingApplied = false;
      this.preservedPlayerState = null;
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
