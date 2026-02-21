
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, Player, Mutant, Bullet, Particle, Trap, Scrap, WeaponType, Language } from './types';
import { 
  GAME_WIDTH, GAME_HEIGHT, PLAYER_SPEED, COLORS, 
  MUTANT_SPEED, MUTANT_HEALTH, MUTANT_SPAWN_RATE,
  TRAP_COST, TRAP_HEALTH, SCRAP_VALUE, WEAPONS,
  MEDKIT_COST, MEDKIT_HEAL_AMOUNT, SHIELD_RECHARGE_COST, SHIELD_RECHARGE_AMOUNT,
  TRANSLATIONS
} from './constants';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Zap, Target, Skull, Wind, ThermometerSnowflake, Hammer, Package, ShoppingCart, X, Crosshair } from 'lucide-react';

const INITIAL_STATE: GameState = {
  player: {
    id: 'player',
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
    radius: 15,
    health: 100,
    angle: 0,
    currentWeapon: 'shotgun',
    weapons: {
      shotgun: { ...WEAPONS.shotgun, unlocked: true },
      rifle: { ...WEAPONS.rifle, unlocked: false },
      flamethrower: { ...WEAPONS.flamethrower, unlocked: false },
      sniper: { ...WEAPONS.sniper, unlocked: false },
      cryobeam: { ...WEAPONS.cryobeam, unlocked: false },
      teslacannon: { ...WEAPONS.teslacannon, unlocked: false },
      voidlauncher: { ...WEAPONS.voidlauncher, unlocked: false },
    },
    isReloading: false,
    inventory: [],
    scrap: 100,
    shield: 100,
  },
  mutants: [],
  bullets: [],
  particles: [],
  traps: [],
  scraps: [],
  score: 0,
  isGameOver: false,
  isShopOpen: false,
  isPaused: false,
  weatherIntensity: 0.2,
  time: 0,
  wave: 0,
  enemiesToSpawn: 0,
  waveCooldown: 0,
  language: 'en',
  roomId: null,
  isHost: true,
  otherPlayers: {},
};

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [roomInput, setRoomInput] = useState('');
  const keysRef = useRef<Set<string>>(new Set());
  const mousePosRef = useRef({ x: 0, y: 0 });
  const [waveMessage, setWaveMessage] = useState<string | null>(null);
  const t = TRANSLATIONS[gameState.language];
  const lastFireTime = useRef(0);
  const lastTrapTime = useRef(0);

  // Socket initialization
  useEffect(() => {
    socketRef.current = io();

    socketRef.current.on('room-created', (roomId) => {
      setGameState(prev => ({ ...prev, roomId, isHost: true }));
    });

    socketRef.current.on('room-joined', (roomId) => {
      setGameState(prev => ({ ...prev, roomId, isHost: false }));
    });

    socketRef.current.on('player-joined', (playerId) => {
      setGameState(prev => ({
        ...prev,
        otherPlayers: { ...prev.otherPlayers, [playerId]: { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 } }
      }));
    });

    socketRef.current.on('player-updated', ({ playerId, playerData }) => {
      setGameState(prev => ({
        ...prev,
        otherPlayers: { ...prev.otherPlayers, [playerId]: playerData }
      }));
    });

    socketRef.current.on('game-state-synced', (syncedState) => {
      setGameState(prev => {
        if (prev.isHost) return prev;
        return {
          ...prev,
          mutants: syncedState.mutants,
          scraps: syncedState.scraps,
          traps: syncedState.traps,
          bullets: [...prev.bullets, ...syncedState.bullets.filter((b: any) => !prev.bullets.find(pb => pb.id === b.id))],
          score: syncedState.score,
          wave: syncedState.wave,
          enemiesToSpawn: syncedState.enemiesToSpawn,
          waveCooldown: syncedState.waveCooldown,
          time: syncedState.time
        };
      });
    });

    socketRef.current.on('remote-action', ({ playerId, action }) => {
      if (action.type === 'shoot') {
        setGameState(prev => ({
          ...prev,
          bullets: [...prev.bullets, ...action.bullets]
        }));
      } else if (action.type === 'place-trap') {
        setGameState(prev => ({
          ...prev,
          traps: [...prev.traps, action.trap]
        }));
      }
    });

    socketRef.current.on('player-left', (playerId) => {
      setGameState(prev => {
        const nextOtherPlayers = { ...prev.otherPlayers };
        delete nextOtherPlayers[playerId];
        return { ...prev, otherPlayers: nextOtherPlayers };
      });
    });

    socketRef.current.on('became-host', () => {
      setGameState(prev => ({ ...prev, isHost: true }));
    });

    socketRef.current.on('error', (msg) => alert(msg));

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const createRoom = () => {
    socketRef.current?.emit('create-room');
  };

  const joinRoom = () => {
    if (roomInput) {
      socketRef.current?.emit('join-room', roomInput.toUpperCase());
    }
  };

  // Wave Message Effect
  useEffect(() => {
    if (gameState.wave > 0 && gameState.waveCooldown === 0) {
      setWaveMessage(`WAVE ${gameState.wave}`);
      const timer = setTimeout(() => setWaveMessage(null), 3000);
      return () => clearTimeout(timer);
    } else if (gameState.waveCooldown > 0) {
      const seconds = Math.ceil(gameState.waveCooldown / 60);
      setWaveMessage(`${t.nextWave} ${seconds}...`);
    } else {
      setWaveMessage(null);
    }
  }, [gameState.wave, gameState.waveCooldown]);

  const shoot = useCallback(() => {
    const now = Date.now();
    const weapon = gameState.player.weapons[gameState.player.currentWeapon];
    
    if (gameState.isGameOver || gameState.isShopOpen || gameState.player.isReloading || weapon.ammo <= 0) return;
    if (now - lastFireTime.current < weapon.fireRate) return;

    lastFireTime.current = now;

    setGameState(prev => {
      const currentWeapon = prev.player.weapons[prev.player.currentWeapon];
      const angle = Math.atan2(mousePosRef.current.y - prev.player.y, mousePosRef.current.x - prev.player.x);
      const newBullets: Bullet[] = [];
      
      if (prev.player.currentWeapon === 'shotgun') {
        for (let i = -2; i <= 2; i++) {
          const spreadAngle = angle + (i * 0.1);
          newBullets.push({
            id: Math.random().toString(),
            x: prev.player.x + Math.cos(angle) * 20,
            y: prev.player.y + Math.sin(angle) * 20,
            vx: Math.cos(spreadAngle) * 10,
            vy: Math.sin(spreadAngle) * 10,
            damage: currentWeapon.damage,
          });
        }
      } else if (prev.player.currentWeapon === 'flamethrower') {
        for (let i = 0; i < 3; i++) {
          const spreadAngle = angle + (Math.random() - 0.5) * 0.4;
          newBullets.push({
            id: Math.random().toString(),
            x: prev.player.x + Math.cos(angle) * 20,
            y: prev.player.y + Math.sin(angle) * 20,
            vx: Math.cos(spreadAngle) * (5 + Math.random() * 3),
            vy: Math.sin(spreadAngle) * (5 + Math.random() * 3),
            damage: currentWeapon.damage,
          });
        }
      } else {
        newBullets.push({
          id: Math.random().toString(),
          x: prev.player.x + Math.cos(angle) * 20,
          y: prev.player.y + Math.sin(angle) * 20,
          vx: Math.cos(angle) * 15,
          vy: Math.sin(angle) * 15,
          damage: currentWeapon.damage,
        });
      }

      const updatedWeapons = { ...prev.player.weapons };
      updatedWeapons[prev.player.currentWeapon] = {
        ...currentWeapon,
        ammo: currentWeapon.ammo - 1
      };

      if (prev.roomId) {
        socketRef.current?.emit('player-action', {
          roomId: prev.roomId,
          action: { type: 'shoot', bullets: newBullets }
        });
      }

      return {
        ...prev,
        player: { ...prev.player, weapons: updatedWeapons },
        bullets: [...prev.bullets, ...newBullets],
      };
    });
  }, [gameState.isGameOver, gameState.isShopOpen, gameState.player.currentWeapon, gameState.player.weapons, gameState.player.isReloading]);

  const useAbility = useCallback(() => {
    const now = Date.now();
    const weapon = gameState.player.weapons[gameState.player.currentWeapon];
    if (!weapon.abilityName || !weapon.abilityCooldown) return;
    if (now - (weapon.lastAbilityTime || 0) < weapon.abilityCooldown) return;

    setGameState(prev => {
      const next = { ...prev };
      const currentWeapon = next.player.weapons[next.player.currentWeapon];
      currentWeapon.lastAbilityTime = now;

      if (next.player.currentWeapon === 'cryobeam') {
        // Freeze: Slow all mutants
        next.mutants = next.mutants.map(m => ({ ...m, speed: m.speed * 0.2 }));
        setTimeout(() => {
          setGameState(p => ({
            ...p,
            mutants: p.mutants.map(m => ({ ...m, speed: m.speed / 0.2 }))
          }));
        }, 5000);
      } else if (next.player.currentWeapon === 'teslacannon') {
        // Overload: Damage all mutants on screen
        next.mutants = next.mutants.map(m => ({ ...m, health: m.health - 50 }));
      } else if (next.player.currentWeapon === 'voidlauncher') {
        // Black Hole: Pull mutants to center
        next.mutants = next.mutants.map(m => ({
          ...m,
          x: GAME_WIDTH / 2 + (m.x - GAME_WIDTH / 2) * 0.5,
          y: GAME_HEIGHT / 2 + (m.y - GAME_HEIGHT / 2) * 0.5
        }));
      }

      return next;
    });
  }, [gameState.player.currentWeapon, gameState.player.weapons]);

  const placeTrap = useCallback(() => {
    const now = Date.now();
    if (gameState.isGameOver || gameState.isPaused || gameState.isShopOpen || gameState.player.scrap < TRAP_COST) return;
    if (now - lastTrapTime.current < 500) return;
    lastTrapTime.current = now;

    setGameState(prev => {
      const newTrap = {
        id: Math.random().toString(),
        x: prev.player.x,
        y: prev.player.y,
        radius: 20,
        health: TRAP_HEALTH,
        active: true
      };

      if (prev.roomId) {
        socketRef.current?.emit('player-action', {
          roomId: prev.roomId,
          action: { type: 'place-trap', trap: newTrap }
        });
      }

      return {
        ...prev,
        player: { ...prev.player, scrap: prev.player.scrap - TRAP_COST },
        traps: [...prev.traps, newTrap]
      };
    });
  }, [gameState.isGameOver, gameState.player.scrap]);

  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current.add(key);

      if (gameState.isGameOver) return;

      // One-shot actions
      if (key === 'b' && !gameState.isPaused) {
        setGameState(prev => ({ ...prev, isShopOpen: !prev.isShopOpen }));
      }
      if (key === 'escape') {
        setGameState(prev => ({ 
          ...prev, 
          isPaused: !prev.isPaused,
          isShopOpen: false 
        }));
      }
      if (key === 'e') placeTrap();
      if (key === ' ') useAbility();

      // Weapon switching
      if (!gameState.isPaused && !gameState.isShopOpen) {
        if (key === '1') setGameState(prev => ({ ...prev, player: { ...prev.player, currentWeapon: 'shotgun' } }));
        if (key === '2') setGameState(prev => prev.player.weapons.rifle.unlocked ? ({ ...prev, player: { ...prev.player, currentWeapon: 'rifle' } }) : prev);
        if (key === '3') setGameState(prev => prev.player.weapons.flamethrower.unlocked ? ({ ...prev, player: { ...prev.player, currentWeapon: 'flamethrower' } }) : prev);
        if (key === '4') setGameState(prev => prev.player.weapons.sniper.unlocked ? ({ ...prev, player: { ...prev.player, currentWeapon: 'sniper' } }) : prev);
        if (key === '5') setGameState(prev => prev.player.weapons.cryobeam.unlocked ? ({ ...prev, player: { ...prev.player, currentWeapon: 'cryobeam' } }) : prev);
        if (key === '6') setGameState(prev => prev.player.weapons.teslacannon.unlocked ? ({ ...prev, player: { ...prev.player, currentWeapon: 'teslacannon' } }) : prev);
        if (key === '7') setGameState(prev => prev.player.weapons.voidlauncher.unlocked ? ({ ...prev, player: { ...prev.player, currentWeapon: 'voidlauncher' } }) : prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      mousePosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [placeTrap, useAbility, gameState.isGameOver, gameState.isPaused, gameState.isShopOpen]);

  // Game Loop
  useEffect(() => {
    let animationFrameId: number;

    const update = () => {
      setGameState(prev => {
        if (prev.isGameOver || prev.isPaused || prev.isShopOpen) return prev;

        const next = { ...prev };
        
        // Update Player Position
        let moveX = 0;
        let moveY = 0;
        if (keysRef.current.has('w')) moveY -= 1;
        if (keysRef.current.has('s')) moveY += 1;
        if (keysRef.current.has('a')) moveX -= 1;
        if (keysRef.current.has('d')) moveX += 1;

        if (moveX !== 0 || moveY !== 0) {
          const length = Math.sqrt(moveX * moveX + moveY * moveY);
          next.player.x = Math.max(next.player.radius, Math.min(GAME_WIDTH - next.player.radius, next.player.x + (moveX / length) * PLAYER_SPEED));
          next.player.y = Math.max(next.player.radius, Math.min(GAME_HEIGHT - next.player.radius, next.player.y + (moveY / length) * PLAYER_SPEED));
        }
        
        next.player.angle = Math.atan2(mousePosRef.current.y - next.player.y, mousePosRef.current.x - next.player.x);

        // Emit player update
        if (next.roomId) {
          socketRef.current?.emit('update-player', {
            roomId: next.roomId,
            playerData: { x: next.player.x, y: next.player.y, angle: next.player.angle, health: next.player.health, shield: next.player.shield }
          });
        }

        // Only host handles mutants, waves, and scraps
        if (next.isHost) {
          // Scrap Magnetization and Collection
          next.scraps = next.scraps.map(s => {
            const dx = next.player.x - s.x;
            const dy = next.player.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 1) return s; // Already at player

            // Magnet effect: move towards player
            const magnetSpeed = 3;
            const vx = (dx / dist) * magnetSpeed;
            const vy = (dy / dist) * magnetSpeed;
            
            return {
              ...s,
              x: s.x + vx,
              y: s.y + vy
            };
          }).filter(s => {
            const dist = Math.sqrt((s.x - next.player.x) ** 2 + (s.y - next.player.y) ** 2);
            if (dist < next.player.radius + 10) {
              next.player.scrap += s.value;
              return false;
            }
            return true;
          });

          // Spawn Mutants (Wave Logic)
          if (next.enemiesToSpawn > 0 && Math.random() < MUTANT_SPAWN_RATE + (prev.wave * 0.001)) {
            const side = Math.floor(Math.random() * 4);
            let mx, my;
            if (side === 0) { mx = Math.random() * GAME_WIDTH; my = -20; }
            else if (side === 1) { mx = GAME_WIDTH + 20; my = Math.random() * GAME_HEIGHT; }
            else if (side === 2) { mx = Math.random() * GAME_WIDTH; my = GAME_HEIGHT + 20; }
            else { mx = -20; my = Math.random() * GAME_HEIGHT; }

            next.mutants.push({
              id: Math.random().toString(),
              x: mx,
              y: my,
              radius: 12,
              health: MUTANT_HEALTH + (prev.wave * 10),
              speed: MUTANT_SPEED + (Math.random() * 0.5) + (prev.wave * 0.1),
              type: Math.random() > 0.8 ? 'stalker' : 'wolf'
            });
            next.enemiesToSpawn -= 1;
          }

          // Check for Wave Completion
          if (next.enemiesToSpawn === 0 && next.mutants.length === 0 && !next.isGameOver && next.time > 0 && next.waveCooldown === 0) {
            next.waveCooldown = 180; // 3 seconds at 60fps
          }

          if (next.waveCooldown > 0) {
            next.waveCooldown -= 1;
            if (next.waveCooldown === 0) {
              const nextWave = next.wave + 1;
              const enemies = 5 + nextWave * 5;
              
              next.wave = nextWave;
              next.enemiesToSpawn = enemies;
            }
          }

          // Update Mutants
          next.mutants = next.mutants.map(m => {
            // Check traps
            let currentSpeed = m.type === 'stalker' ? m.speed * 1.5 : m.speed;
            next.traps.forEach(t => {
              const dist = Math.sqrt((m.x - t.x) ** 2 + (m.y - t.y) ** 2);
              if (dist < t.radius + m.radius) {
                currentSpeed *= 0.2;
                t.health -= 0.5;
              }
            });

            const angle = Math.atan2(next.player.y - m.y, next.player.x - m.x);
            return {
              ...m,
              x: m.x + Math.cos(angle) * currentSpeed,
              y: m.y + Math.sin(angle) * currentSpeed,
            };
          });

          // Sync state to clients
          if (next.roomId && next.time % 2 === 0) {
            socketRef.current?.emit('sync-game-state', {
              roomId: next.roomId,
              gameState: {
                mutants: next.mutants,
                scraps: next.scraps,
                traps: next.traps,
                bullets: next.bullets,
                score: next.score,
                wave: next.wave,
                enemiesToSpawn: next.enemiesToSpawn,
                waveCooldown: next.waveCooldown,
                time: next.time
              }
            });
          }
        }

        // Update Traps
        next.traps = next.traps.filter(t => t.health > 0);

        // Update Bullets
        next.bullets = next.bullets.map(b => ({
          ...b,
          x: b.x + b.vx,
          y: b.y + b.vy,
        })).filter(b => b.x > 0 && b.x < GAME_WIDTH && b.y > 0 && b.y < GAME_HEIGHT);

        // Collision: Bullets vs Mutants (Only host handles this to avoid double damage)
        if (next.isHost) {
          const hitMutants = new Set<string>();
          const hitBullets = new Set<string>();

          next.bullets.forEach(b => {
            next.mutants.forEach(m => {
              const dist = Math.sqrt((b.x - m.x) ** 2 + (b.y - m.y) ** 2);
              if (dist < m.radius + 2) {
                m.health -= b.damage;
                hitBullets.add(b.id);
                if (m.health <= 0) {
                  hitMutants.add(m.id);
                  // Drop scrap
                  if (Math.random() > 0.5) {
                    next.scraps.push({
                      id: Math.random().toString(),
                      x: m.x,
                      y: m.y,
                      value: SCRAP_VALUE
                    });
                  }
                }
                
                for (let i = 0; i < 5; i++) {
                  next.particles.push({
                    id: Math.random().toString(),
                    x: m.x,
                    y: m.y,
                    vx: (Math.random() - 0.5) * 4,
                    vy: (Math.random() - 0.5) * 4,
                    life: 1,
                    color: COLORS.BLOOD
                  });
                }
              }
            });
          });

          next.bullets = next.bullets.filter(b => !hitBullets.has(b.id));
          next.mutants = next.mutants.filter(m => !hitMutants.has(m.id));
          if (hitMutants.size > 0) next.score += hitMutants.size * 100;
        }

        // Reloading logic
        const currentWeapon = next.player.weapons[next.player.currentWeapon];
        if (currentWeapon.ammo === 0 && !next.player.isReloading) {
          next.player.isReloading = true;
          setTimeout(() => {
            setGameState(p => {
              const updatedWeapons = { ...p.player.weapons };
              const weaponToReload = updatedWeapons[p.player.currentWeapon];
              updatedWeapons[p.player.currentWeapon] = {
                ...weaponToReload,
                ammo: weaponToReload.maxAmmo
              };
              return {
                ...p,
                player: { ...p.player, weapons: updatedWeapons, isReloading: false }
              };
            });
          }, currentWeapon.reloadTime);
        }

        // Collision: Mutants vs Player
        next.mutants.forEach(m => {
          const dist = Math.sqrt((m.x - next.player.x) ** 2 + (m.y - next.player.y) ** 2);
          if (dist < m.radius + next.player.radius) {
            const damage = 0.5;
            if (next.player.shield > 0) {
              next.player.shield = Math.max(0, next.player.shield - damage);
            } else {
              next.player.health -= damage;
            }
            if (next.player.health <= 0) next.isGameOver = true;
          }
        });

        // Update Particles
        next.particles = next.particles.map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          life: p.life - 0.02
        })).filter(p => p.life > 0);

        // Weather and Time
        next.time += 1;
        next.weatherIntensity = 0.2 + Math.sin(next.time / 500) * 0.15;

        return next;
      });

      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.fillStyle = COLORS.NIGHT;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      ctx.fillStyle = COLORS.SNOW;
      ctx.globalAlpha = 0.1;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      ctx.globalAlpha = 1.0;

      // Draw Traps
      gameState.traps.forEach(t => {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(t.x - 10, t.y - 10);
        ctx.lineTo(t.x + 10, t.y + 10);
        ctx.moveTo(t.x + 10, t.y - 10);
        ctx.lineTo(t.x - 10, t.y + 10);
        ctx.stroke();
      });

      // Draw Scraps
      gameState.scraps.forEach(s => {
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.rect(s.x - 4, s.y - 4, 8, 8);
        ctx.fill();
        ctx.strokeStyle = '#f8fafc';
        ctx.stroke();
      });

      // Flashlight effect
      const gradient = ctx.createRadialGradient(
        gameState.player.x, gameState.player.y, 0,
        gameState.player.x, gameState.player.y, 300
      );
      gradient.addColorStop(0, 'rgba(254, 243, 199, 0.2)');
      gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
      
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(gameState.player.x, gameState.player.y);
      ctx.arc(gameState.player.x, gameState.player.y, 400, 
        gameState.player.angle - 0.5, gameState.player.angle + 0.5);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      ctx.restore();

      gameState.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      gameState.mutants.forEach(m => {
        ctx.fillStyle = m.type === 'stalker' ? '#7f1d1d' : COLORS.MUTANT;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ef4444';
        const angle = Math.atan2(gameState.player.y - m.y, gameState.player.x - m.x);
        ctx.beginPath();
        ctx.arc(m.x + Math.cos(angle + 0.5) * 5, m.y + Math.sin(angle + 0.5) * 5, 2, 0, Math.PI * 2);
        ctx.arc(m.x + Math.cos(angle - 0.5) * 5, m.y + Math.sin(angle - 0.5) * 5, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      gameState.bullets.forEach(b => {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Other Players
      Object.entries(gameState.otherPlayers).forEach(([id, p]) => {
        if (!p.x || !p.y) return;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        
        ctx.fillStyle = '#334155'; // Different color for other players
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(10, -2, 15, 4);
        ctx.restore();

        // Health bar for other players
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(p.x - 15, p.y - 25, 30, 4);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(p.x - 15, p.y - 25, 30 * ((p.health || 0) / 100), 4);
      });

      ctx.save();
      ctx.translate(gameState.player.x, gameState.player.y);
      ctx.rotate(gameState.player.angle);
      ctx.fillStyle = COLORS.PLAYER;
      ctx.beginPath();
      ctx.arc(0, 0, gameState.player.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Gun visuals based on weapon
      const weaponType = gameState.player.currentWeapon;
      if (weaponType === 'shotgun') {
        ctx.fillStyle = '#475569';
        ctx.fillRect(10, -3, 20, 6);
      } else if (weaponType === 'rifle') {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(10, -2, 25, 4);
      } else if (weaponType === 'flamethrower') {
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(10, -4, 18, 8);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(28, -2, 5, 4);
      } else if (weaponType === 'sniper') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(10, -1.5, 35, 3);
        ctx.fillStyle = '#475569';
        ctx.fillRect(15, -3, 8, 2); // Scope
      }
      ctx.restore();

      ctx.fillStyle = 'white';
      ctx.globalAlpha = gameState.weatherIntensity;
      for (let i = 0; i < 100; i++) {
        const x = (Math.sin(gameState.time / 100 + i) * GAME_WIDTH + i * 20) % GAME_WIDTH;
        const y = (gameState.time * 2 + i * 30) % GAME_HEIGHT;
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    };

    render();
  }, [gameState]);

  const buyWeapon = (type: WeaponType) => {
    const weapon = gameState.player.weapons[type];
    if (gameState.player.scrap >= weapon.cost && !weapon.unlocked) {
      setGameState(prev => {
        const updatedWeapons = { ...prev.player.weapons };
        updatedWeapons[type] = { 
          ...updatedWeapons[type], 
          unlocked: true,
          lastAbilityTime: 0 
        };
        return {
          ...prev,
          player: { 
            ...prev.player, 
            scrap: prev.player.scrap - weapon.cost,
            weapons: updatedWeapons, 
            currentWeapon: type 
          }
        };
      });
    }
  };

  const buyMedkit = () => {
    if (gameState.player.scrap >= MEDKIT_COST && gameState.player.health < 100) {
      setGameState(prev => ({
        ...prev,
        player: { 
          ...prev.player, 
          scrap: prev.player.scrap - MEDKIT_COST,
          health: Math.min(100, prev.player.health + MEDKIT_HEAL_AMOUNT)
        }
      }));
    }
  };

  const buyShield = () => {
    if (gameState.player.scrap >= SHIELD_RECHARGE_COST && gameState.player.shield < 100) {
      setGameState(prev => ({
        ...prev,
        player: { 
          ...prev.player, 
          scrap: prev.player.scrap - SHIELD_RECHARGE_COST,
          shield: Math.min(100, prev.player.shield + SHIELD_RECHARGE_AMOUNT)
        }
      }));
    }
  };

  const resetGame = () => {
    setGameState(INITIAL_STATE);
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden font-sans">
      <div className="relative shadow-2xl border-4 border-slate-800 rounded-lg overflow-hidden" 
           style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}>
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          onMouseDown={shoot}
          className="cursor-crosshair"
        />

        {/* HUD */}
        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
          <div className="space-y-4">
            <div className="flex flex-col gap-2 bg-slate-900/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-700">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-blue-400" />
                <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-blue-500"
                    initial={{ width: '100%' }}
                    animate={{ width: `${gameState.player.shield}%` }}
                  />
                </div>
                <span className="text-blue-400 font-mono text-[9px] font-bold">{Math.ceil(gameState.player.shield)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <Crosshair className="w-4 h-4 text-rose-500" />
                <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-rose-500"
                    initial={{ width: '100%' }}
                    animate={{ width: `${gameState.player.health}%` }}
                  />
                </div>
                <span className="text-rose-500 font-mono text-[9px] font-bold">{Math.ceil(gameState.player.health)}%</span>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700">
              <Zap className="w-5 h-5 text-amber-400" />
              <div className="flex gap-1">
                {Array.from({ length: Math.min(gameState.player.weapons[gameState.player.currentWeapon].maxAmmo, 10) }).map((_, i) => (
                  <motion.div
                    key={`${gameState.player.currentWeapon}-ammo-${i}`}
                    className={`w-2 h-6 rounded-sm ${i < gameState.player.weapons[gameState.player.currentWeapon].ammo ? 'bg-amber-500' : 'bg-slate-800'}`}
                    animate={{ scale: i < gameState.player.weapons[gameState.player.currentWeapon].ammo ? 1 : 0.8, opacity: i < gameState.player.weapons[gameState.player.currentWeapon].ammo ? 1 : 0.3 }}
                  />
                ))}
                {gameState.player.weapons[gameState.player.currentWeapon].maxAmmo > 10 && (
                  <span className="text-white font-mono text-sm ml-2">
                    {gameState.player.weapons[gameState.player.currentWeapon].ammo} / {gameState.player.weapons[gameState.player.currentWeapon].maxAmmo}
                  </span>
                )}
              </div>
              {gameState.player.isReloading && (
                <span className="text-[10px] uppercase tracking-widest font-bold text-amber-500 animate-pulse ml-2">
                  {t.reloading}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700">
              <Package className="w-5 h-5 text-slate-400" />
              <span className="text-white font-mono font-bold">{gameState.player.scrap}</span>
              <span className="text-slate-500 text-[10px] uppercase font-bold ml-2">{t.scrap}</span>
            </div>

            <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700">
              <Skull className="w-5 h-5 text-slate-400" />
              <div className="flex flex-col">
                <span className="text-white font-mono text-[10px] font-bold uppercase tracking-widest">{t.wave} {gameState.wave}</span>
                <span className="text-slate-500 font-mono text-[8px] uppercase">{t.enemies}: {gameState.mutants.length + gameState.enemiesToSpawn}</span>
              </div>
            </div>
          </div>

          <div className="text-right space-y-2">
            <div className="text-slate-400 text-xs uppercase tracking-[0.2em] font-bold">Frost Hollow Ranger</div>
            <div className="text-white text-3xl font-black tracking-tighter font-mono">
              {gameState.score.toLocaleString()}
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center justify-end gap-2 text-slate-500 text-[10px] font-bold uppercase">
                <Hammer className="w-3 h-3" />
                <span>[E] {t.e} ({TRAP_COST})</span>
              </div>
              <div className="flex items-center justify-end gap-2 text-rose-500 text-[10px] font-bold uppercase">
                <ShoppingCart className="w-3 h-3" />
                <span>[B] {t.b}</span>
              </div>
              <div className="text-slate-600 text-[9px] font-bold uppercase mt-1">
                [1-7] {t.oneFour}
              </div>
              <div className="text-amber-500 text-[9px] font-bold uppercase">
                [SPACE] {t.space}
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {waveMessage && (
            <motion.div
              key={gameState.waveCooldown > 0 ? 'countdown' : 'wave-start'}
              initial={{ opacity: 0, y: -50, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 1.5 }}
              className="absolute top-1/4 left-1/2 -translate-x-1/2 pointer-events-none z-[100] text-center"
            >
              <h2 className={`${gameState.waveCooldown > 0 ? 'text-4xl' : 'text-8xl'} font-black text-white tracking-tighter uppercase italic drop-shadow-[0_0_30px_rgba(225,29,72,0.5)]`}>
                {waveMessage}
              </h2>
            </motion.div>
          )}

          {gameState.isPaused && (
            <motion.div 
              key="pause-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-12 text-center z-[70]"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="space-y-8"
              >
                <h2 className="text-6xl font-black text-white tracking-tighter uppercase italic">{t.paused}</h2>
                
                <div className="flex flex-col gap-4 w-64 mx-auto pointer-events-auto">
                  <button 
                    onClick={() => setGameState(prev => ({ ...prev, isPaused: false }))}
                    className="w-full py-4 bg-white text-slate-950 font-black uppercase tracking-widest rounded-xl hover:bg-emerald-500 hover:text-white transition-all transform hover:scale-105 active:scale-95"
                  >
                    {t.resume}
                  </button>

                  {/* Multiplayer Section */}
                  <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 space-y-4">
                    <div className="text-rose-500 font-bold text-[10px] uppercase tracking-widest">{t.multiplayer}</div>
                    
                    {!gameState.roomId ? (
                      <div className="space-y-3">
                        <button 
                          onClick={createRoom}
                          className="w-full py-2 bg-rose-600 text-white font-bold uppercase text-xs rounded-lg hover:bg-rose-500 transition-all"
                        >
                          {t.createRoom}
                        </button>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder={t.enterCode}
                            value={roomInput}
                            onChange={(e) => setRoomInput(e.target.value)}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono uppercase focus:outline-none focus:border-rose-500"
                          />
                          <button 
                            onClick={joinRoom}
                            className="bg-white text-slate-950 px-4 py-2 rounded-lg font-bold uppercase text-xs hover:bg-emerald-500 hover:text-white transition-all"
                          >
                            {t.joinRoom}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center bg-slate-800 p-2 rounded-lg">
                          <span className="text-slate-500 text-[9px] uppercase font-bold">{t.roomCode}</span>
                          <span className="text-white font-mono font-bold tracking-widest">{gameState.roomId}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 uppercase font-bold">
                          {gameState.isHost ? t.host : t.client} • {Object.keys(gameState.otherPlayers).length + 1} Players
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <span className="text-slate-500 text-[10px] uppercase font-bold">{t.language}</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setGameState(prev => ({ ...prev, language: 'en' }))}
                        className={`flex-1 py-2 rounded-lg font-bold uppercase text-xs transition-all ${gameState.language === 'en' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                      >
                        EN
                      </button>
                      <button 
                        onClick={() => setGameState(prev => ({ ...prev, language: 'ru' }))}
                        className={`flex-1 py-2 rounded-lg font-bold uppercase text-xs transition-all ${gameState.language === 'ru' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                      >
                        RU
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={() => setGameState(INITIAL_STATE)}
                    className="w-full py-4 bg-slate-900 text-slate-400 border border-slate-800 font-black uppercase tracking-widest rounded-xl hover:bg-rose-600 hover:text-white transition-all transform hover:scale-105 active:scale-95"
                  >
                    {t.quit}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {gameState.isShopOpen && (
            <motion.div 
              key="shop-overlay"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="absolute top-0 right-0 h-full w-80 bg-slate-950/95 border-l border-slate-800 backdrop-blur-xl p-8 z-50 overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-white font-black uppercase italic tracking-widest text-xl">{t.arsenal}</h3>
                <button 
                  onClick={() => setGameState(prev => ({ ...prev, isShopOpen: false }))}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors pointer-events-auto"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Medkit & Shield Purchase */}
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-4 rounded-xl border bg-slate-900/50 border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                      <div className="uppercase font-black text-emerald-500 tracking-tighter italic flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        {t.medkit}
                      </div>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full font-bold uppercase">{MEDKIT_COST} {t.scrap}</span>
                    </div>
                    <button 
                      onClick={buyMedkit}
                      disabled={gameState.player.scrap < MEDKIT_COST || gameState.player.health >= 100}
                      className={`w-full py-2 rounded-lg font-black uppercase tracking-widest text-xs transition-all pointer-events-auto ${gameState.player.scrap >= MEDKIT_COST && gameState.player.health < 100 ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                    >
                      {gameState.player.health >= 100 ? t.full : t.heal}
                    </button>
                  </div>

                  <div className="p-4 rounded-xl border bg-slate-900/50 border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                      <div className="uppercase font-black text-blue-500 tracking-tighter italic flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        {t.shield}
                      </div>
                      <span className="text-[10px] bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded-full font-bold uppercase">{SHIELD_RECHARGE_COST} {t.scrap}</span>
                    </div>
                    <button 
                      onClick={buyShield}
                      disabled={gameState.player.scrap < SHIELD_RECHARGE_COST || gameState.player.shield >= 100}
                      className={`w-full py-2 rounded-lg font-black uppercase tracking-widest text-xs transition-all pointer-events-auto ${gameState.player.scrap >= SHIELD_RECHARGE_COST && gameState.player.shield < 100 ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                    >
                      {gameState.player.shield >= 100 ? t.full : t.recharge}
                    </button>
                  </div>
                </div>

                <div className="h-px bg-slate-800 my-4" />

                {(Object.keys(gameState.player.weapons) as WeaponType[]).map(type => {
                  const weapon = gameState.player.weapons[type];
                  return (
                    <div 
                      key={type}
                      className={`p-4 rounded-xl border transition-all ${gameState.player.currentWeapon === type ? 'border-rose-500 bg-rose-500/10' : weapon.unlocked ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-900 border-slate-800'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="uppercase font-black text-white tracking-tighter italic">{type}</div>
                        {gameState.player.currentWeapon === type ? (
                          <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold uppercase">{t.equipped}</span>
                        ) : weapon.unlocked ? (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full font-bold uppercase">{t.unlocked}</span>
                        ) : (
                          <span className="text-[10px] bg-rose-500/20 text-rose-500 px-2 py-0.5 rounded-full font-bold uppercase">{weapon.cost} {t.scrap}</span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mb-2 text-[10px] text-slate-500 uppercase font-bold">
                        <div>Damage: <span className="text-slate-300">{weapon.damage}</span></div>
                        <div>Rate: <span className="text-slate-300">{weapon.fireRate}ms</span></div>
                        <div>Ammo: <span className="text-slate-300">{weapon.maxAmmo}</span></div>
                      </div>

                      {weapon.abilityName && (
                        <div className="mb-4 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] text-amber-500 uppercase font-bold">
                          Ability: {weapon.abilityName} [SPACE]
                        </div>
                      )}

                      {!weapon.unlocked ? (
                        <button 
                          onClick={() => buyWeapon(type)}
                          disabled={gameState.player.scrap < weapon.cost}
                          className={`w-full py-2 rounded-lg font-black uppercase tracking-widest text-xs transition-all pointer-events-auto ${gameState.player.scrap >= weapon.cost ? 'bg-white text-slate-950 hover:bg-rose-500 hover:text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                        >
                          {t.purchase}
                        </button>
                      ) : (
                        <button 
                          onClick={() => setGameState(prev => ({ ...prev, player: { ...prev.player, currentWeapon: type }, isShopOpen: false }))}
                          className="w-full py-2 bg-slate-800 text-slate-400 rounded-lg font-black uppercase tracking-widest text-xs hover:bg-slate-700 hover:text-white transition-all pointer-events-auto"
                        >
                          {t.equip}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-8 border-t border-slate-800">
                <div className="text-slate-500 text-[10px] uppercase font-bold mb-1">{t.scrap}</div>
                <div className="text-2xl font-mono font-bold text-white">{gameState.player.scrap.toLocaleString()}</div>
              </div>
            </motion.div>
          )}

          {gameState.isGameOver && (
            <motion.div 
              key="game-over-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl flex flex-center flex-col items-center justify-center p-12 text-center z-[60]"
            >
              <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <Skull className="w-16 h-16 text-rose-600 mx-auto mb-4" />
                  <h2 className="text-6xl font-black text-white tracking-tighter uppercase italic">{t.gameOver}</h2>
                  <p className="text-slate-400 max-w-md mx-auto">
                    {t.gameOverDesc}
                  </p>
                </div>
                
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 inline-block">
                  <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Final Score</div>
                  <div className="text-4xl font-mono font-bold text-white">{gameState.score.toLocaleString()}</div>
                </div>

                <button 
                  onClick={resetGame}
                  className="block w-full py-4 bg-white text-slate-950 font-black uppercase tracking-widest rounded-xl hover:bg-rose-500 hover:text-white transition-all transform hover:scale-105 active:scale-95"
                >
                  {t.tryAgain}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {gameState.time === 0 && !gameState.isGameOver && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-12 text-center">
             <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h1 className="text-8xl font-black text-white tracking-tighter uppercase italic leading-none">{t.title.split(' ')[0]}<br/>{t.title.split(' ')[1] || ''}</h1>
                <div className="h-1 w-24 bg-rose-600 mx-auto my-4" />
                <p className="text-slate-400 max-w-md mx-auto uppercase tracking-widest text-xs font-bold">
                  {t.subtitle}
                </p>
                <p className="text-slate-500 text-[10px] max-w-xs mx-auto mt-4 leading-relaxed italic">
                  "The research facility went dark three days ago. Now, the wolves aren't just hungry—they're changed. You're the last ranger. Don't let the fire go out."
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                  <div className="text-rose-500 font-bold text-xs uppercase mb-2">{t.controls}</div>
                  <div className="text-white text-sm space-y-1">
                    <p><span className="text-slate-500">WASD</span> {t.wasd}</p>
                    <p><span className="text-slate-500">MOUSE</span> {t.mouse}</p>
                    <p><span className="text-slate-500">E</span> {t.e}</p>
                    <p><span className="text-slate-500">B</span> {t.b}</p>
                    <p><span className="text-slate-500">ESC</span> {t.esc}</p>
                    <p><span className="text-slate-500">1-7</span> {t.oneFour}</p>
                    <p><span className="text-slate-500">SPACE</span> {t.space}</p>
                  </div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                  <div className="text-rose-500 font-bold text-xs uppercase mb-2">Mission</div>
                  <p className="text-white text-sm leading-tight">
                    {t.mission}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setGameState(p => ({ ...p, time: 1 }))}
                className="group relative px-12 py-4 bg-rose-600 text-white font-black uppercase tracking-[0.3em] rounded-full overflow-hidden transition-all hover:bg-rose-500"
              >
                <span className="relative z-10">{t.begin}</span>
                <motion.div 
                  className="absolute inset-0 bg-white/20"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '100%' }}
                  transition={{ duration: 0.5 }}
                />
              </button>
            </motion.div>
          </div>
        )}
      </div>

      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_rgba(30,41,59,1)_0%,_rgba(15,23,42,1)_100%)]" />
        <div className="absolute top-0 left-0 w-full h-full mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/asfalt-dark.png')]" />
      </div>
    </div>
  );
};
