import React, { useState, useEffect } from 'react';
import { Game } from './game/Game';
import { GameState } from './game/StateMachine';
import { db, StashItem, Contract } from './game/persistence/SaveDB';

interface AppProps {
  game: Game;
}

const App: React.FC<AppProps> = ({ game }) => {
  const [gameState, setGameState] = useState<GameState>(game.stateMachine.getState());
  const [ammo, setAmmo] = useState({ current: 30, reserve: 90 });
  const [stash, setStash] = useState<StashItem[]>([]);
  const [loadout, setLoadout] = useState<StashItem[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [activeContractId, setActiveContractId] = useState<number | null>(null);
  const [inventory, setInventory] = useState<{itemId: string, quantity: number}[]>([]);
  const [hoveredTarget, setHoveredTarget] = useState<string | null>(null);
  const [isShipUIOpen, setIsShipUIOpen] = useState<boolean>(false);
  const [money, setMoney] = useState<number>(0);

  useEffect(() => {
    const loadStash = async () => {
      const items = await db.stashItems.toArray();
      setStash(items.filter(i => i.slot === 'stash'));
      setLoadout(items.filter(i => i.slot === 'loadout'));
      const allContracts = await db.contracts.toArray();
      setContracts(allContracts);
      const active = allContracts.find(c => c.isActive);
      if (active && active.id) setActiveContractId(active.id);
      
      const profile = await db.playerProfile.toCollection().first();
      if (profile) setMoney(profile.money);
    };

    loadStash();

    const cleanup = game.stateMachine.onStateChange((newState) => {
      setGameState(newState);
    });

    const interval = setInterval(() => {
      if (game.player) {
        if (game.player.weapon) {
          setAmmo({
            current: game.player.weapon.currentAmmo,
            reserve: game.player.weapon.reserveAmmo
          });
        }
        if (game.player.inventory) {
          setInventory([...game.player.inventory]);
        }
        setHoveredTarget(game.player.hoveredInteractable || null);
      }
    }, 100);

    const toggleUI = () => {
      setIsShipUIOpen(prev => !prev);
    };
    window.addEventListener('toggleShipUI', toggleUI);

    return () => {
      cleanup();
      clearInterval(interval);
      window.removeEventListener('toggleShipUI', toggleUI);
    };
  }, [game]);

  const sellJunk = async () => {
    const junkTypes = { 'scrap_metal': 10, 'copper_wire': 25 };
    let totalEarned = 0;
    
    await db.transaction('rw', db.stashItems, db.playerProfile, async () => {
      const items = await db.stashItems.toArray();
      const profile = await db.playerProfile.toCollection().first();
      if (!profile) return;

      for (const item of items) {
        if (item.slot === 'stash' && Object.keys(junkTypes).includes(item.itemId)) {
          totalEarned += junkTypes[item.itemId as keyof typeof junkTypes] * item.quantity;
          await db.stashItems.delete(item.id!);
        }
      }

      if (totalEarned > 0) {
        await db.playerProfile.update(profile.id!, { money: profile.money + totalEarned });
      }
    });

    if (totalEarned > 0) {
      const items = await db.stashItems.toArray();
      setStash(items.filter(i => i.slot === 'stash'));
      const newProfile = await db.playerProfile.toCollection().first();
      if (newProfile) setMoney(newProfile.money);
    }
  };

  const buyItem = async (itemId: string, cost: number, quantity: number = 1) => {
    let success = false;
    await db.transaction('rw', db.stashItems, db.playerProfile, async () => {
      const profile = await db.playerProfile.toCollection().first();
      if (!profile || profile.money < cost) return;

      // deduct money
      await db.playerProfile.update(profile.id!, { money: profile.money - cost });
      
      // add item
      const existing = await db.stashItems.where('itemId').equals(itemId).first();
      if (existing && existing.slot === 'stash') {
          await db.stashItems.update(existing.id!, { quantity: existing.quantity + quantity });
      } else {
          await db.stashItems.add({ itemId, quantity, slot: 'stash' });
      }
      success = true;
    });

    if (success) {
        const items = await db.stashItems.toArray();
        setStash(items.filter(i => i.slot === 'stash'));
        const newProfile = await db.playerProfile.toCollection().first();
        if (newProfile) setMoney(newProfile.money);
    }
  };

  return (
    <div className="ui-overlay" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      color: 'white',
      fontFamily: 'sans-serif'
    }}>
      {/* Crosshair */}
      {(gameState === GameState.SHIP || gameState === GameState.STATION || gameState === GameState.MOON_BASE) && !isShipUIOpen && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '4px',
            height: '4px',
            background: 'white',
            borderRadius: '50%',
            boxShadow: '0 0 5px rgba(0,0,0,0.5)'
          }} />
          {hoveredTarget && (
            <div style={{ background: 'rgba(0,0,0,0.7)', padding: '5px 10px', borderRadius: '4px', fontSize: '14px', border: '1px solid #555' }}>
              [E] INTERACT
            </div>
          )}
        </div>
      )}

      {/* HUD Layer */}
      {(gameState === GameState.STATION || gameState === GameState.MOON_BASE) && (
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', pointerEvents: 'auto' }}>
          <div style={{ background: 'rgba(0,0,0,0.5)', padding: '10px', border: '1px solid #444', marginBottom: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '14px', color: '#aaa' }}>BACKPACK</h2>
            {inventory.length === 0 ? <p style={{ margin: 0, color: '#666' }}>Empty</p> : (
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#fff' }}>
                {inventory.map(item => <li key={item.itemId}>{item.itemId} x{item.quantity}</li>)}
              </ul>
            )}
          </div>
          <div style={{ background: 'rgba(0,0,0,0.5)', padding: '10px', border: '1px solid #444' }}>
            <h2 style={{ margin: 0, fontSize: '14px', color: '#aaa' }}>HEALTH: 100</h2>
            <h1 style={{ margin: 0, fontSize: '32px' }}>{ammo.current} / {ammo.reserve}</h1>
          </div>
        </div>
      )}

      {/* Ship UI Layer */}
      {gameState === GameState.SHIP && isShipUIOpen && (
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'auto',
          background: 'rgba(0,0,0,0.8)',
          padding: '40px',
          border: '1px solid #444',
          textAlign: 'center'
        }}>
          <h1>SHIP OPERATIONS CENTER</h1>
          <h2 style={{ color: 'gold', margin: '0 0 20px 0', fontSize: '24px' }}>FUNDS: ¤{money}</h2>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
            <button 
              onClick={() => {
                setIsShipUIOpen(false);
                game.stateMachine.setState(GameState.STATION);
              }}
              disabled={!activeContractId}
              style={{
                padding: '15px 30px',
                fontSize: '20px',
                cursor: activeContractId ? 'pointer' : 'not-allowed',
                background: activeContractId ? '#800' : '#444',
                color: activeContractId ? 'white' : '#888',
                border: 'none',
                marginTop: '20px',
                fontWeight: 'bold',
                letterSpacing: '2px'
              }}
            >
              {activeContractId ? 'DOCK WITH STATION' : 'SELECT A CONTRACT'}
            </button>
            <button
              onClick={() => setIsShipUIOpen(false)}
              style={{
                padding: '15px 30px',
                fontSize: '20px',
                cursor: 'pointer',
                background: '#444',
                color: 'white',
                border: 'none',
                marginTop: '20px',
                fontWeight: 'bold',
                letterSpacing: '2px'
              }}
            >
              CLOSE TERMINAL
            </button>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginTop: '40px', textAlign: 'left' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #444', paddingBottom: '10px', marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>STASH</h3>
                <button 
                  onClick={sellJunk}
                  style={{ background: 'gold', color: 'black', border: 'none', padding: '5px 10px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  SELL JUNK
                </button>
              </div>
              <p style={{ fontSize: '12px', color: '#888', marginTop: '-5px' }}>(Click to Equip)</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {stash.map(item => (
                  <div 
                    key={item.id} 
                    onClick={async () => {
                      await db.stashItems.update(item.id!, { slot: 'loadout' });
                      const items = await db.stashItems.toArray();
                      setStash(items.filter(i => i.slot === 'stash'));
                      setLoadout(items.filter(i => i.slot === 'loadout'));
                    }}
                    style={{ background: '#222', padding: '10px', border: '1px solid #333', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: '12px', color: '#888' }}>{item.itemId}</div>
                    <div style={{ fontSize: '18px' }}>x{item.quantity}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '10px', color: '#4a9eff' }}>LOADOUT (Click to Unequip)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {loadout.map(item => (
                  <div 
                    key={item.id} 
                    onClick={async () => {
                      await db.stashItems.update(item.id!, { slot: 'stash' });
                      const items = await db.stashItems.toArray();
                      setStash(items.filter(i => i.slot === 'stash'));
                      setLoadout(items.filter(i => i.slot === 'loadout'));
                    }}
                    style={{ background: '#1a2a3a', padding: '10px', border: '1px solid #4a9eff', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: '12px', color: '#88aadd' }}>{item.itemId}</div>
                    <div style={{ fontSize: '18px' }}>x{item.quantity}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: 1.5 }}>
              <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '10px' }}>AVAILABLE CONTRACTS</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {contracts.filter(c => !c.isCompleted).map(contract => (
                  <div 
                    key={contract.id} 
                    onClick={async () => {
                        // Deselect all
                        await db.contracts.toCollection().modify({ isActive: false });
                        // Select this one
                        await db.contracts.update(contract.id!, { isActive: true });
                        const updated = await db.contracts.toArray();
                        setContracts(updated);
                        setActiveContractId(contract.id!);
                    }}
                    style={{ 
                        background: activeContractId === contract.id ? '#422' : '#222', 
                        padding: '10px', 
                        border: `1px solid ${activeContractId === contract.id ? '#f00' : '#333'}`,
                        cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{contract.title}</div>
                    <div style={{ fontSize: '12px', color: '#aaa', margin: '5px 0' }}>{contract.description}</div>
                    <div style={{ fontSize: '14px', color: 'gold' }}>Reward: ¤{contract.reward}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '10px', color: '#ffb347' }}>ARMORY (BUY)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '5px' }}>
                {[
                    { id: 'shotgun_01', name: 'Shotgun', cost: 100 },
                    { id: 'pulse_rifle', name: 'Pulse Rifle', cost: 200 },
                    { id: 'ammo_9mm', name: 'Ammo (x30)', cost: 20, qty: 30 },
                    { id: 'medkit', name: 'Medkit', cost: 50 }
                ].map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => buyItem(item.id, item.cost, item.qty || 1)}
                    style={{ 
                        background: '#322', 
                        padding: '10px', 
                        border: '1px solid #ffb347', 
                        cursor: money >= item.cost ? 'pointer' : 'not-allowed', 
                        opacity: money >= item.cost ? 1 : 0.5 
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{item.name}</div>
                    <div style={{ fontSize: '12px', color: 'gold' }}>¤{item.cost}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
