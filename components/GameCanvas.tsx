import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, Player, Enemy, Projectile, Particle, WaveConfig, PowerUp, UpgradeOption } from '../types';
import { generateWave, fallbackWave } from '../services/geminiService';
import { audioService } from '../services/audioService';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScore: (score: number) => void;
  setLives: (lives: number) => void;
  setLevel: (level: number) => void;
  setFlavorText: (text: string) => void;
  onGameOver: (finalScore: number) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  setGameState,
  setScore,
  setLives,
  setLevel,
  setFlavorText,
  onGameOver
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevGameStateRef = useRef<GameState>(gameState);
  
  const playerRef = useRef<Player>({
    id: 0, x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100,
    width: 34, height: 34, color: '#3b82f6',
    vx: 0, vy: 0, markedForDeletion: false,
    hp: 100, maxHp: 100, weaponLevel: 1, score: 0, credits: 0, invulnerableUntil: 0,
    rotation: -Math.PI / 2,
    gunType: 'blaster',
    moveSpeed: 300
  });
  
  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const isDyingRef = useRef(false);
  
  const mouseRef = useRef({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
  const mouseDownRef = useRef(false);

  const leftStick = useRef({ active: false, id: -1, originX: 0, originY: 0, currX: 0, currY: 0, valX: 0, valY: 0 });
  const rightStick = useRef({ active: false, id: -1, originX: 0, originY: 0, currX: 0, currY: 0, valX: 0, valY: 0 });
  
  const levelRef = useRef(1);
  const wavePendingRef = useRef(false);
  const nextWaveConfigRef = useRef<WaveConfig | null>(null);

  const [shopOpen, setShopOpen] = useState(false);
  const [shopItems, setShopItems] = useState<UpgradeOption[]>([]);
  const [currentCredits, setCurrentCredits] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (e.code === 'Escape' && gameState === GameState.PLAYING && !shopOpen) {
        setGameState(GameState.PAUSED);
      } else if (e.code === 'Escape' && gameState === GameState.PAUSED) {
        setGameState(GameState.PLAYING);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      mouseRef.current = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) mouseDownRef.current = true;
    };
    
    const handleMouseUp = () => {
      mouseDownRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameState, setGameState, shopOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    if (navigator.vibrate) {
        navigator.vibrate(15);
    }

    Array.from(e.changedTouches).forEach((touch: React.Touch) => {
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;
      
      if (x < CANVAS_WIDTH / 2) {
        if (!leftStick.current.active) {
            leftStick.current = { active: true, id: touch.identifier, originX: x, originY: y, currX: x, currY: y, valX: 0, valY: 0 };
        }
      } else {
        if (!rightStick.current.active) {
            rightStick.current = { active: true, id: touch.identifier, originX: x, originY: y, currX: x, currY: y, valX: 0, valY: 0 };
            mouseDownRef.current = true;
        }
      }
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    Array.from(e.changedTouches).forEach((touch: React.Touch) => {
       const x = (touch.clientX - rect.left) * scaleX;
       const y = (touch.clientY - rect.top) * scaleY;
       const maxDist = 75;

       if (leftStick.current.active && leftStick.current.id === touch.identifier) {
          leftStick.current.currX = x;
          leftStick.current.currY = y;
          let dx = x - leftStick.current.originX;
          let dy = y - leftStick.current.originY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > maxDist) {
             dx = (dx / dist) * maxDist;
             dy = (dy / dist) * maxDist;
             leftStick.current.currX = leftStick.current.originX + dx;
             leftStick.current.currY = leftStick.current.originY + dy;
          }
          leftStick.current.valX = dx / maxDist;
          leftStick.current.valY = dy / maxDist;
       }

       if (rightStick.current.active && rightStick.current.id === touch.identifier) {
          rightStick.current.currX = x;
          rightStick.current.currY = y;
          let dx = x - rightStick.current.originX;
          let dy = y - rightStick.current.originY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > maxDist) {
             dx = (dx / dist) * maxDist;
             dy = (dy / dist) * maxDist;
             rightStick.current.currX = rightStick.current.originX + dx;
             rightStick.current.currY = rightStick.current.originY + dy;
          }
          rightStick.current.valX = dx / maxDist;
          rightStick.current.valY = dy / maxDist;
       }
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    Array.from(e.changedTouches).forEach((touch: React.Touch) => {
       if (leftStick.current.active && leftStick.current.id === touch.identifier) {
          leftStick.current.active = false;
          leftStick.current.valX = 0;
          leftStick.current.valY = 0;
       }
       if (rightStick.current.active && rightStick.current.id === touch.identifier) {
          rightStick.current.active = false;
          mouseDownRef.current = false;
       }
    });
  };

  const generateShopItems = useCallback(() => {
    const player = playerRef.current;
    
    const allUpgrades: UpgradeOption[] = [
      {
        id: 'repair',
        title: 'HULL PATCH',
        description: 'Repair 50 HP',
        type: 'heal',
        cost: 100,
        color: '#4ade80',
        apply: (p) => { p.hp = Math.min(p.maxHp, p.hp + 50); setLives(p.hp); audioService.playPowerUp(); }
      },
      {
        id: 'maxhp',
        title: 'TITANIUM PLATING',
        description: '+50 Max HP',
        type: 'stat',
        cost: 300,
        color: '#10b981',
        apply: (p) => { p.maxHp += 50; p.hp += 50; setLives(p.hp); audioService.playPowerUp(); }
      },
      {
        id: 'speed',
        title: 'NITRO INJECTOR',
        description: '+10% Speed',
        type: 'stat',
        cost: 200,
        color: '#06b6d4',
        apply: (p) => { p.moveSpeed *= 1.1; audioService.playPowerUp(); }
      },
      {
        id: 'weapon_power',
        title: 'CORE OVERCLOCK',
        description: '+1 Weapon Level',
        type: 'stat',
        cost: 500 * player.weaponLevel,
        color: '#f59e0b',
        apply: (p) => { p.weaponLevel += 1; audioService.playPowerUp(); }
      }
    ];

    if (player.gunType !== 'blaster') {
      allUpgrades.push({
        id: 'gun_blaster',
        title: 'PULSE RIFLE',
        description: 'Balanced rapid fire.',
        type: 'gun',
        cost: 800,
        color: '#3b82f6',
        apply: (p) => { p.gunType = 'blaster'; audioService.playPowerUp(); }
      });
    }
    if (player.gunType !== 'spread') {
      allUpgrades.push({
        id: 'gun_spread',
        title: 'FLAK CANNON',
        description: 'Wide spread shot.',
        type: 'gun',
        cost: 1200,
        color: '#8b5cf6',
        apply: (p) => { p.gunType = 'spread'; audioService.playPowerUp(); }
      });
    }
    if (player.gunType !== 'plasma') {
      allUpgrades.push({
        id: 'gun_plasma',
        title: 'PLASMA CASTER',
        description: 'High damage bolts.',
        type: 'gun',
        cost: 1500,
        color: '#ef4444',
        apply: (p) => { p.gunType = 'plasma'; audioService.playPowerUp(); }
      });
    }
    if (player.gunType !== 'vulcan') {
      allUpgrades.push({
        id: 'gun_vulcan',
        title: 'VULCAN GATLING',
        description: 'Extreme rate of fire.',
        type: 'gun',
        cost: 1800,
        color: '#fbbf24',
        apply: (p) => { p.gunType = 'vulcan'; audioService.playPowerUp(); }
      });
    }

    const shuffled = allUpgrades.sort(() => 0.5 - Math.random());
    setShopItems(shuffled.slice(0, 4));
    setCurrentCredits(player.credits);
  }, [setLives]);

  const queueNextWave = useCallback(async () => {
    if (wavePendingRef.current) return;
    wavePendingRef.current = true;
    
    const nextLevel = levelRef.current + 1;
    const isBossLevel = nextLevel % 5 === 0;

    const healthPercent = Math.round((playerRef.current.hp / playerRef.current.maxHp) * 100);
    let context = `Player HP: ${healthPercent}%, Gun: ${playerRef.current.gunType}, Weapon Level: ${playerRef.current.weaponLevel}.`;
    
    if (isBossLevel) {
        context += " BOSS LEVEL ALERT! GENERATE A MASSIVE BOSS ENEMY.";
    }

    try {
      const wave = await generateWave(nextLevel, context);
      nextWaveConfigRef.current = wave;
    } catch (e) {
      nextWaveConfigRef.current = fallbackWave;
    } finally {
      wavePendingRef.current = false;
    }
  }, []);

  const spawnWave = useCallback((config: WaveConfig) => {
    setFlavorText(config.flavorText);
    const newEnemies: Enemy[] = [];
    let idCounter = Date.now();

    config.enemies.forEach((group) => {
      let centerStartX = Math.random() * (CANVAS_WIDTH - 200) + 100;
      
      for (let i = 0; i < group.count; i++) {
        let w = 40, h = 40;
        let x = centerStartX;
        let y = -Math.random() * 200 - 100;

        // Formation Logic
        if (group.formation === 'v') {
          const spacingX = 60;
          const spacingY = 50;
          const row = Math.floor((i + 1) / 2);
          const side = i % 2 === 0 ? 1 : -1;
          if (i === 0) {
            // Leader
          } else {
            x += side * spacingX * row;
            y -= spacingY * row;
          }
        } else if (group.formation === 'line') {
          x = (CANVAS_WIDTH / (group.count + 1)) * (i + 1);
          y = -100;
        } else {
          x = Math.random() * (CANVAS_WIDTH - 60) + 30;
        }

        if (group.type === 'boss') { w = 120; h = 120; }
        else if (group.type === 'tank' || group.type === 'turret') { w = 60; h = 60; }
        else if (group.type === 'kamikaze') { w = 25; h = 25; }
        else if (group.type === 'bomber') { w = 50; h = 40; }
        else if (group.type === 'support') { w = 40; h = 40; }
        else if (group.type === 'decoy') { 
          w = 30; h = 30; 
          audioService.playGlitch(); // Decoys spawn with a glitch sound
        }
        else if (group.type === 'swarm') {
            w = 20; h = 20;
            if (group.formation !== 'v') {
              x = centerStartX + (Math.random() - 0.5) * 150;
              y = -Math.random() * 100 - 50;
            }
        } 
        else if (group.type === 'cloaked') { w = 35; h = 35; }
        else if (group.type === 'fighter') { w = 45; h = 40; }

        const speed = Math.max(0.5, group.speed);

        newEnemies.push({
          id: idCounter++,
          x: x,
          y: y, 
          width: w,
          height: h,
          color: group.color,
          vx: (Math.random() - 0.5) * speed,
          vy: speed * 0.5,
          markedForDeletion: false,
          hp: group.hp,
          maxHp: group.hp,
          type: group.type,
          scoreValue: group.hp * 10,
          creditsValue: Math.max(10, Math.floor(group.hp * 1.5))
        });
      }
    });
    enemiesRef.current = [...enemiesRef.current, ...newEnemies];
  }, [setFlavorText]);

  const resetGame = useCallback(() => {
    playerRef.current = {
      id: 0, x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100,
      width: 34, height: 34, color: '#3b82f6',
      vx: 0, vy: 0, markedForDeletion: false,
      hp: 100, maxHp: 100, weaponLevel: 1, score: 0, credits: 0, invulnerableUntil: 0,
      rotation: -Math.PI / 2,
      gunType: 'blaster',
      moveSpeed: 300
    };
    enemiesRef.current = [];
    projectilesRef.current = [];
    particlesRef.current = [];
    powerUpsRef.current = [];
    levelRef.current = 1;
    isDyingRef.current = false;
    setScore(0);
    setLives(100);
    setLevel(1);
    setShopOpen(false);
    
    leftStick.current.active = false;
    rightStick.current.active = false;
    mouseDownRef.current = false;
    
    spawnWave(fallbackWave);
    queueNextWave();
  }, [setScore, setLives, setLevel, queueNextWave, spawnWave]);

  useEffect(() => {
    if (gameState === GameState.PLAYING && (prevGameStateRef.current === GameState.MENU || prevGameStateRef.current === GameState.GAME_OVER)) {
      resetGame();
    }
    prevGameStateRef.current = gameState;
  }, [gameState, resetGame]);

  const handleBuyItem = (item: UpgradeOption) => {
    if (playerRef.current.credits >= item.cost) {
        playerRef.current.credits -= item.cost;
        item.apply(playerRef.current);
        setCurrentCredits(playerRef.current.credits);
        
        if (item.type === 'gun') {
            setShopItems(prev => prev.filter(i => i.id !== item.id));
        }
    }
  };

  const handleNextWave = () => {
      setShopOpen(false);
      projectilesRef.current = [];
      powerUpsRef.current = [];

      levelRef.current++;
      setLevel(levelRef.current);

      if (nextWaveConfigRef.current) {
        spawnWave(nextWaveConfigRef.current);
        nextWaveConfigRef.current = null;
      } else {
        spawnWave(fallbackWave);
      }
      queueNextWave();
  };

  useEffect(() => {
    if (gameState !== GameState.PLAYING || shopOpen) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let fireCooldown = 0;

    const spawnParticle = (x: number, y: number, color: string, count: number = 5, speedMod: number = 10, customSize?: number) => {
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          id: Math.random(),
          x, y,
          width: 0, height: 0,
          vx: (Math.random() - 0.5) * speedMod,
          vy: (Math.random() - 0.5) * speedMod,
          color,
          life: 1.0,
          maxLife: 1.0,
          size: customSize ? (Math.random() * customSize + customSize/2) : (Math.random() * 4 + 2),
          markedForDeletion: false
        });
      }
    };

    const spawnPlayerExplosion = (x: number, y: number) => {
      spawnParticle(x, y, '#ffffff', 40, 25, 8);
      spawnParticle(x, y, '#fef08a', 60, 20, 6);
      spawnParticle(x, y, '#f97316', 80, 15, 5);
      spawnParticle(x, y, '#dc2626', 60, 10, 4);
      spawnParticle(x, y, '#4b5563', 40, 5, 10);
    };

    const spawnEnemyExplosion = (x: number, y: number, color: string) => {
      // Impact flash
      spawnParticle(x, y, '#ffffff', 8, 20, 6);
      spawnParticle(x, y, '#fef08a', 5, 15, 4);
      // Main burst in enemy color
      spawnParticle(x, y, color, 20, 12, 5);
      // Debris/Dark smoke
      spawnParticle(x, y, '#334155', 10, 5, 3);
    };

    const triggerGameOver = () => {
      if (isDyingRef.current) return;
      isDyingRef.current = true;
      const player = playerRef.current;
      spawnPlayerExplosion(player.x + player.width/2, player.y + player.height/2);
      audioService.playExplosion();
      player.hp = 0;
      setLives(0);
      setTimeout(() => {
        onGameOver(player.score);
      }, 1000);
    };

    const update = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      if (!canvas || !ctx) return;

      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const player = playerRef.current;
      const speed = player.moveSpeed;
      
      if (!isDyingRef.current) {
        let isMoving = false;
        if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) { player.x -= speed * dt; isMoving = true; }
        if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) { player.x += speed * dt; isMoving = true; }
        if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) { player.y -= speed * dt; isMoving = true; }
        if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) { player.y += speed * dt; isMoving = true; }
        
        if (leftStick.current.active) {
            player.x += leftStick.current.valX * speed * dt;
            player.y += leftStick.current.valY * speed * dt;
            isMoving = true;
        }

        // Engine Trails
        if (isMoving && Math.random() > 0.4) {
          const trailX = player.x + player.width/2 - Math.cos(player.rotation) * 15;
          const trailY = player.y + player.height/2 - Math.sin(player.rotation) * 15;
          spawnParticle(trailX, trailY, '#60a5fa', 1, 2, 2);
        }

        if (isNaN(player.x)) player.x = CANVAS_WIDTH / 2;
        if (isNaN(player.y)) player.y = CANVAS_HEIGHT - 100;

        player.x = Math.max(0, Math.min(CANVAS_WIDTH - player.width, player.x));
        player.y = Math.max(0, Math.min(CANVAS_HEIGHT - player.height, player.y));

        if (rightStick.current.active) {
            if (Math.abs(rightStick.current.valX) > 0.1 || Math.abs(rightStick.current.valY) > 0.1) {
                player.rotation = Math.atan2(rightStick.current.valY, rightStick.current.valX);
            }
        } else {
            const centerX = player.x + player.width / 2;
            const centerY = player.y + player.height / 2;
            const dx = mouseRef.current.x - centerX;
            const dy = mouseRef.current.y - centerY;
            player.rotation = Math.atan2(dy, dx);
        }

        const isFiring = mouseDownRef.current || keysRef.current['Space'];

        if (isFiring && fireCooldown <= 0) {
          const centerX = player.x + player.width / 2;
          const centerY = player.y + player.height / 2;
          const gunLength = 25;
          const spawnX = centerX + Math.cos(player.rotation) * gunLength;
          const spawnY = centerY + Math.sin(player.rotation) * gunLength;
          const damageMult = 1 + (player.weaponLevel * 0.2);
          
          audioService.playShoot();

          if (player.gunType === 'blaster') {
              const projSpeed = 800;
              const baseDamage = 15 * damageMult;
              const cooldown = Math.max(0.08, 0.2 - (player.weaponLevel * 0.02));
              
              projectilesRef.current.push({
                 id: Math.random(),
                 x: spawnX, y: spawnY, width: 6, height: 6,
                 color: '#60a5fa',
                 vx: Math.cos(player.rotation) * projSpeed,
                 vy: Math.sin(player.rotation) * projSpeed,
                 markedForDeletion: false,
                 damage: baseDamage, isEnemy: false
              });

              if (player.weaponLevel >= 3) {
                  projectilesRef.current.push({
                      id: Math.random(),
                      x: spawnX, y: spawnY, width: 6, height: 6,
                      color: '#60a5fa',
                      vx: Math.cos(player.rotation - 0.1) * projSpeed,
                      vy: Math.sin(player.rotation - 0.1) * projSpeed,
                      markedForDeletion: false,
                      damage: baseDamage, isEnemy: false
                   });
              }
              fireCooldown = cooldown;
          
          } else if (player.gunType === 'spread') {
              const projSpeed = 600;
              const baseDamage = 8 * damageMult;
              const shotCount = 3 + player.weaponLevel;
              const arc = 0.5;
              
              for (let i = 0; i < shotCount; i++) {
                  const angle = player.rotation - (arc/2) + (arc * i / (shotCount-1));
                  const jitter = (Math.random() - 0.5) * 0.1;
                  projectilesRef.current.push({
                      id: Math.random(),
                      x: spawnX, y: spawnY, width: 5, height: 5,
                      color: '#a78bfa',
                      vx: Math.cos(angle + jitter) * projSpeed,
                      vy: Math.sin(angle + jitter) * projSpeed,
                      markedForDeletion: false,
                      damage: baseDamage, isEnemy: false
                   });
              }
              fireCooldown = 0.4; 

          } else if (player.gunType === 'plasma') {
              const projSpeed = 400;
              const baseDamage = 50 * damageMult;
              
              projectilesRef.current.push({
                  id: Math.random(),
                  x: spawnX, y: spawnY, width: 20, height: 20,
                  color: '#ef4444',
                  vx: Math.cos(player.rotation) * projSpeed,
                  vy: Math.sin(player.rotation) * projSpeed,
                  markedForDeletion: false,
                  damage: baseDamage, isEnemy: false, piercing: true
               });
               fireCooldown = 0.6;
          } else if (player.gunType === 'vulcan') {
              const projSpeed = 900;
              const baseDamage = 6 * damageMult;
              const spread = 0.1;
              const cooldown = Math.max(0.04, 0.08 - (player.weaponLevel * 0.01));
              
              projectilesRef.current.push({
                  id: Math.random(),
                  x: spawnX, y: spawnY, width: 4, height: 4,
                  color: '#fbbf24',
                  vx: Math.cos(player.rotation + (Math.random()-0.5) * spread) * projSpeed,
                  vy: Math.sin(player.rotation + (Math.random()-0.5) * spread) * projSpeed,
                  markedForDeletion: false,
                  damage: baseDamage, isEnemy: false
              });
              fireCooldown = cooldown;
          }
        }
      }
      fireCooldown -= dt;

      projectilesRef.current.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -100 || p.x > CANVAS_WIDTH + 100 || p.y < -100 || p.y > CANVAS_HEIGHT + 100) {
          p.markedForDeletion = true;
        }
      });

      if (enemiesRef.current.length === 0 && !shopOpen && !isDyingRef.current) {
          setFlavorText("SECTOR SECURED. ACCESSING MARKET...");
          generateShopItems();
          setShopOpen(true);
      }

      enemiesRef.current.forEach(enemy => {
        if (enemy.x < -300 || enemy.x > CANVAS_WIDTH + 300 || 
            enemy.y < -500 || enemy.y > CANVAS_HEIGHT + 300) {
          enemy.markedForDeletion = true;
        }

        if (enemy.type === 'decoy') {
          const targetX = player.x;
          enemy.x += (targetX - enemy.x) * dt * 3;
          enemy.y += enemy.vy * 40 * dt;
          if (Math.random() > 0.98) audioService.playGlitch();
        } else if (enemy.type === 'kamikaze') {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            if (distance > 0) {
                const enemyBaseSpeed = Math.max(1, enemy.vy);
                enemy.vx = (dx / distance) * enemyBaseSpeed * 4;
                enemy.vy = (dy / distance) * enemyBaseSpeed * 4;
                enemy.x += enemy.vx * dt * 60;
                enemy.y += enemy.vy * dt * 60;
            }
        } else if (enemy.type === 'turret') {
            if (enemy.y < CANVAS_HEIGHT * 0.2) {
                enemy.y += enemy.vy * 30 * dt;
            } else {
                enemy.y += Math.sin(time / 1000 + enemy.id) * 0.2;
            }
            enemy.x += Math.cos(time / 1500 + enemy.id) * 0.2;
        } else if (enemy.type === 'bomber') {
            enemy.y += enemy.vy * 40 * dt;
            enemy.x += Math.sin(time / 2000 + enemy.id) * 0.5;
        } else if (enemy.type === 'support') {
            enemy.y += enemy.vy * 30 * dt;
            enemy.x += Math.cos(time / 1500 + enemy.id) * 0.8;
            const healRange = 200;
            const healRate = 30 * dt;
            enemiesRef.current.forEach(ally => {
                if (ally.id !== enemy.id && ally.hp < ally.maxHp) {
                    const dx = ally.x - enemy.x;
                    const dy = ally.y - enemy.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < healRange) {
                        ally.hp = Math.min(ally.maxHp, ally.hp + healRate);
                        ctx.strokeStyle = '#4ade80';
                        ctx.lineWidth = 2;
                        ctx.globalAlpha = 0.4;
                        ctx.beginPath();
                        ctx.moveTo(enemy.x + enemy.width/2, enemy.y + enemy.height/2);
                        ctx.lineTo(ally.x + ally.width/2, ally.y + ally.height/2);
                        ctx.stroke();
                        ctx.globalAlpha = 1.0;
                    }
                }
            });
        } else if (enemy.type === 'swarm') {
            enemy.y += enemy.vy * 60 * dt;
            enemy.x += Math.sin(time / 200 + enemy.id) * 2;
        } else if (enemy.type === 'fighter') {
            enemy.y += enemy.vy * 50 * dt;
            enemy.x += Math.sin(time / 400 + enemy.id) * 3;
        } else {
            enemy.y += enemy.vy * 60 * dt; 
            enemy.x += Math.sin(time / 500 + enemy.id) * 2; 
        }

        if (
            player.hp > 0 && !isDyingRef.current &&
            enemy.x < player.x + player.width &&
            enemy.x + enemy.width > player.x &&
            enemy.y < player.y + player.height &&
            enemy.y + enemy.height > player.y
        ) {
            if (Date.now() > player.invulnerableUntil) {
                 if (enemy.type === 'kamikaze') {
                     player.hp -= 40;
                     enemy.hp = 0;
                     spawnEnemyExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#ef4444');
                     audioService.playExplosion();
                 } else if (enemy.type === 'decoy') {
                     audioService.playGlitch();
                 } else {
                     player.hp -= 15;
                     enemy.hp -= 20;
                     audioService.playDamage();
                 }
                 setLives(player.hp);
                 player.invulnerableUntil = Date.now() + 500;
                 if (player.hp <= 0) triggerGameOver();
            }
        }

        if (enemy.y > CANVAS_HEIGHT + 100) {
          enemy.markedForDeletion = true;
          player.score = Math.max(0, player.score - 50); 
        }

        if (enemy.hp <= 0) {
             enemy.markedForDeletion = true;
             player.score += enemy.scoreValue;
             player.credits += enemy.creditsValue;
             spawnEnemyExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color);
             audioService.playExplosion();
             if (Math.random() < 0.05) {
                 powerUpsRef.current.push({
                     id: Math.random(),
                     x: enemy.x + enemy.width/2 - 10, y: enemy.y + enemy.height/2 - 10,
                     width: 20, height: 20, color: '#f43f5e',
                     vx: 0, vy: 60, markedForDeletion: false,
                     type: 'health', value: 1
                 });
             }
        }

        if (enemy.type !== 'kamikaze' && !enemy.markedForDeletion && enemy.type !== 'support') {
             let fireRate = 0.005;
             if (enemy.type === 'turret') fireRate = 0.025;
             if (enemy.type === 'boss') fireRate = 0.03;
             if (enemy.type === 'bomber') fireRate = 0.01;
             if (enemy.type === 'swarm') fireRate = 0.002;
             if (enemy.type === 'decoy') fireRate = 0.02;
             if (enemy.type === 'fighter') fireRate = 0.015;

             if (Math.random() < fireRate * (levelRef.current * 0.5)) {
               const ex = enemy.x + enemy.width/2;
               const ey = enemy.y + enemy.height;
               
               if (enemy.type !== 'decoy') audioService.playEnemyShoot();

               if (enemy.type === 'bomber') {
                   projectilesRef.current.push({
                        id: Math.random(), x: ex, y: ey, width: 14, height: 14,
                        color: '#f87171', vx: (Math.random() - 0.5) * 20, vy: 40,
                        markedForDeletion: false, damage: 40, isEnemy: true, isMine: true
                   });
               } else if (enemy.type === 'decoy') {
                   audioService.playGlitch();
                   projectilesRef.current.push({
                        id: Math.random(), x: ex, y: ey, width: 6, height: 6,
                        color: '#60a5fa', vx: 0, vy: 500,
                        markedForDeletion: false, damage: 0, isEnemy: true
                   });
               } else {
                   const angleToPlayer = Math.atan2(player.y - ey, player.x - ex);
                   let vx = 0; let vy = 300; const speed = 350;
                   if (enemy.type === 'turret' || enemy.type === 'boss' || enemy.type === 'fighter' || (levelRef.current > 2 && Math.random() > 0.5)) {
                       vx = Math.cos(angleToPlayer) * speed;
                       vy = Math.sin(angleToPlayer) * speed;
                   }
                   projectilesRef.current.push({
                        id: Math.random(), x: ex, y: ey, width: 6, height: 6,
                        color: enemy.type === 'turret' ? '#f59e0b' : '#ef4444',
                        vx: vx, vy: vy, markedForDeletion: false,
                        damage: enemy.type === 'turret' ? 15 : 10, isEnemy: true
                   });
               }
            }
        }
      });

      powerUpsRef.current.forEach(p => {
        p.y += p.vy * dt;
        if (
            !isDyingRef.current &&
            p.x < player.x + player.width &&
            p.x + p.width > player.x &&
            p.y < player.y + player.height &&
            p.y + p.height > player.y
        ) {
            p.markedForDeletion = true;
            spawnParticle(p.x + p.width/2, p.y + p.height/2, '#f43f5e', 10);
            audioService.playPowerUp();
            if (p.type === 'health') {
                player.hp = Math.min(player.maxHp, player.hp + 50);
                setLives(player.hp);
                setFlavorText("HULL REPAIRED");
            }
        }
        if (p.y > CANVAS_HEIGHT) p.markedForDeletion = true;
      });

      projectilesRef.current.forEach(proj => {
        if (proj.markedForDeletion) return;
        if (proj.isEnemy) {
            if (
                !isDyingRef.current &&
                proj.x < player.x + player.width &&
                proj.x + proj.width > player.x &&
                proj.y < player.y + player.height &&
                proj.y + proj.height > player.y
            ) {
                 if (proj.damage > 0 && Date.now() > player.invulnerableUntil) {
                     player.hp -= proj.damage;
                     proj.markedForDeletion = true;
                     spawnParticle(player.x + player.width/2, player.y + player.height/2, '#ef4444', 10);
                     audioService.playDamage();
                     if (player.hp <= 0) triggerGameOver();
                     setLives(player.hp);
                 } else if (proj.damage === 0) {
                     proj.markedForDeletion = true;
                     spawnParticle(proj.x, proj.y, '#60a5fa', 5, 5);
                     audioService.playGlitch();
                 }
            }
        } else {
            let hit = false;
            enemiesRef.current.forEach(enemy => {
                if (!enemy.markedForDeletion &&
                    proj.x < enemy.x + enemy.width &&
                    proj.x + proj.width > enemy.x &&
                    proj.y < enemy.y + enemy.height &&
                    proj.y + proj.height > enemy.y
                ) {
                    enemy.hp -= proj.damage;
                    hit = true;
                    spawnParticle(proj.x, proj.y, proj.color, 3);
                }
            });
            if (hit && !proj.piercing) proj.markedForDeletion = true;
        }
      });
      
      setScore(player.score);

      particlesRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        p.life -= dt * 1.5;
        if (p.life <= 0) p.markedForDeletion = true;
      });

      enemiesRef.current = enemiesRef.current.filter(e => !e.markedForDeletion);
      projectilesRef.current = projectilesRef.current.filter(p => !p.markedForDeletion);
      particlesRef.current = particlesRef.current.filter(p => !p.markedForDeletion);
      powerUpsRef.current = powerUpsRef.current.filter(p => !p.markedForDeletion);

      powerUpsRef.current.forEach(p => {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.width, p.height);
          ctx.fillStyle = 'white';
          ctx.font = 'bold 12px monospace';
          ctx.fillText("+", p.x + 6, p.y + 14);
      });

      if (player.hp > 0 && !isDyingRef.current) {
          ctx.save();
          const cx = player.x + player.width / 2;
          const cy = player.y + player.height / 2;
          ctx.translate(cx, cy);
          ctx.rotate(player.rotation);
          
          // Improved Player Starship Design
          const w = player.width;
          const h = player.height;
          
          // Wing Hull
          ctx.fillStyle = player.color;
          ctx.beginPath();
          ctx.moveTo(w/2, 0);       // Nose
          ctx.lineTo(-w/2, h/2);    // Left wing
          ctx.lineTo(-w/3, 0);      // Rear notch
          ctx.lineTo(-w/2, -h/2);   // Right wing
          ctx.closePath();
          ctx.fill();

          // Engine detail
          ctx.fillStyle = '#1e3a8a';
          ctx.fillRect(-w/3, -h/6, w/6, h/3);

          // Cockpit
          ctx.fillStyle = '#bfdbfe';
          ctx.beginPath();
          ctx.ellipse(0, 0, w/4, h/8, 0, 0, Math.PI * 2);
          ctx.fill();

          // Weapon Rendering
          if (player.gunType === 'blaster') {
            ctx.fillStyle = '#60a5fa';
            ctx.fillRect(w/4, -2, 10, 4); 
          } else if (player.gunType === 'spread') {
            ctx.fillStyle = '#a78bfa';
            ctx.fillRect(0, -h/2, 8, 4); 
            ctx.fillRect(0, h/2 - 4, 8, 4); 
          } else if (player.gunType === 'plasma') {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(w/2 - 2, 0, 6, 0, Math.PI * 2);
            ctx.fill();
          } else if (player.gunType === 'vulcan') {
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(w/4, -5, 12, 3);
            ctx.fillRect(w/4, 2, 12, 3);
          }

          ctx.restore();
      }

      enemiesRef.current.forEach(enemy => {
          ctx.fillStyle = enemy.color;
          if (enemy.type === 'decoy') {
              const flicker = Math.random() > 0.8 ? 0.3 : 0.7;
              const glitchOffset = Math.random() > 0.95 ? (Math.random() - 0.5) * 15 : 0;
              ctx.save();
              ctx.globalAlpha = flicker;
              ctx.translate(enemy.x + enemy.width/2 + glitchOffset, enemy.y + enemy.height/2);
              ctx.rotate(player.rotation);
              ctx.fillStyle = '#3b82f6';
              ctx.beginPath(); ctx.arc(0, 0, enemy.width/2, 0, Math.PI*2); ctx.fill();
              ctx.fillStyle = '#60a5fa'; ctx.fillRect(0, -4, 20, 8);
              ctx.restore();
          } else if (enemy.type === 'fighter') {
              const cx = enemy.x + enemy.width/2;
              const cy = enemy.y + enemy.height/2;
              ctx.save();
              ctx.translate(cx, cy);
              ctx.fillStyle = enemy.color;
              ctx.beginPath();
              ctx.moveTo(0, enemy.height/2);    
              ctx.lineTo(enemy.width/2, -enemy.height/2); 
              ctx.lineTo(enemy.width/4, -enemy.height/4); 
              ctx.lineTo(-enemy.width/4, -enemy.height/4); 
              ctx.lineTo(-enemy.width/2, -enemy.height/2); 
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = '#f97316';
              ctx.globalAlpha = 0.6 + Math.sin(time / 100) * 0.4;
              ctx.fillRect(-enemy.width/8, -enemy.height/2 - 5, enemy.width/4, 5);
              ctx.fillStyle = '#ef4444';
              const eyeSpacing = enemy.width / 5;
              const eyeY = enemy.height / 6;
              const eyePulse = 1 + Math.sin(time / 200) * 0.2;
              ctx.beginPath();
              ctx.arc(-eyeSpacing, eyeY, 3 * eyePulse, 0, Math.PI * 2);
              ctx.arc(eyeSpacing, eyeY, 3 * eyePulse, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
          } else if (enemy.type === 'kamikaze') {
              const angle = Math.atan2(enemy.vy, enemy.vx);
              ctx.save();
              ctx.translate(enemy.x + enemy.width/2, enemy.y + enemy.height/2);
              ctx.rotate(angle);
              ctx.beginPath();
              ctx.moveTo(10, 0); ctx.lineTo(-10, -8); ctx.lineTo(-6, 0); ctx.lineTo(-10, 8);
              ctx.closePath(); ctx.fill(); ctx.restore();
          } else if (enemy.type === 'turret') {
              ctx.beginPath();
              const r = enemy.width/2; const cx = enemy.x + r; const cy = enemy.y + r;
              for (let i = 0; i < 8; i++) {
                  const theta = (i * Math.PI * 2) / 8;
                  const px = cx + Math.cos(theta) * r; const py = cy + Math.sin(theta) * r;
                  if (i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
              }
              ctx.closePath(); ctx.fill();
              const angleToPlayer = Math.atan2(player.y - cy, player.x - cx);
              ctx.save(); ctx.translate(cx, cy); ctx.rotate(angleToPlayer);
              ctx.fillStyle = '#444'; ctx.fillRect(0, -5, 25, 10); ctx.restore();
          } else if (enemy.type === 'boss') {
              ctx.save();
              ctx.translate(enemy.x + enemy.width/2, enemy.y + enemy.height/2);
              const scale = 1 + Math.sin(time / 200) * 0.05;
              ctx.scale(scale, scale);
              ctx.fillStyle = enemy.color;
              ctx.beginPath();
              ctx.moveTo(0, -enemy.height/2); ctx.lineTo(enemy.width/2, 0);
              ctx.lineTo(0, enemy.height/2); ctx.lineTo(-enemy.width/2, 0);
              ctx.closePath(); ctx.fill();
              ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
              ctx.restore();
          } else if (enemy.type === 'bomber') {
              ctx.beginPath();
              ctx.moveTo(enemy.x, enemy.y + enemy.height);
              ctx.lineTo(enemy.x + enemy.width * 0.2, enemy.y);
              ctx.lineTo(enemy.x + enemy.width * 0.8, enemy.y);
              ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height);
              ctx.closePath(); ctx.fill();
          } else if (enemy.type === 'support') {
              const thickness = enemy.width / 3;
              ctx.fillRect(enemy.x + (enemy.width - thickness)/2, enemy.y, thickness, enemy.height);
              ctx.fillRect(enemy.x, enemy.y + (enemy.height - thickness)/2, enemy.width, thickness);
          } else if (enemy.type === 'swarm') {
              ctx.save(); ctx.translate(enemy.x + enemy.width/2, enemy.y + enemy.height/2);
              ctx.rotate(time / 200 + enemy.id);
              ctx.fillStyle = enemy.color;
              ctx.beginPath(); ctx.moveTo(0, -enemy.height/2); ctx.lineTo(enemy.width/2, enemy.height/2);
              ctx.lineTo(-enemy.width/2, enemy.height/2); ctx.closePath(); ctx.fill();
              ctx.restore();
          } else if (enemy.type === 'cloaked') {
              const opacity = (Math.sin(time / 500 + enemy.id) + 1.2) / 2.2;
              ctx.globalAlpha = opacity;
              ctx.fillStyle = enemy.color;
              ctx.beginPath(); ctx.moveTo(enemy.x + enemy.width/2, enemy.y);
              ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height);
              ctx.lineTo(enemy.x + enemy.width/2, enemy.y + enemy.height - 10);
              ctx.lineTo(enemy.x, enemy.y + enemy.height);
              ctx.closePath(); ctx.fill();
              ctx.globalAlpha = 1.0;
          } else {
              ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
          }
          if (enemy.maxHp > 20) {
              const hpPct = enemy.hp / enemy.maxHp;
              ctx.fillStyle = 'red'; ctx.fillRect(enemy.x, enemy.y - 10, enemy.width, 4);
              ctx.fillStyle = 'green'; ctx.fillRect(enemy.x, enemy.y - 10, enemy.width * hpPct, 4);
          }
      });

      projectilesRef.current.forEach(p => {
          ctx.fillStyle = p.color;
          if (p.isEnemy && p.damage === 0) {
            ctx.globalAlpha = Math.random() > 0.5 ? 0.3 : 0.8;
          }
          ctx.beginPath();
          if (p.isMine) {
              const pulse = Math.sin(time / 100) * 2;
              ctx.arc(p.x, p.y, (p.width/2) + pulse, 0, Math.PI * 2);
          } else {
              ctx.arc(p.x, p.y, p.width/2, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.globalAlpha = 1.0;
      });

      particlesRef.current.forEach(p => {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
          ctx.globalAlpha = 1.0;
      });

      const drawJoystick = (stick: typeof leftStick.current, color: string) => {
         if (!stick.active) return;
         ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = 0.3;
         ctx.arc(stick.originX, stick.originY, 75, 0, Math.PI * 2); ctx.stroke();
         ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 0.8;
         ctx.beginPath(); ctx.arc(stick.currX, stick.currY, 35, 0, Math.PI * 2); ctx.fill();
         ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(stick.currX, stick.currY, 25, 0, Math.PI * 2);
         ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.globalAlpha = 1.0;
      };

      drawJoystick(leftStick.current, '#3b82f6');
      drawJoystick(rightStick.current, '#ef4444');
      
      if (!rightStick.current.active && !leftStick.current.active && !isDyingRef.current) {
        ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(mouseRef.current.x, mouseRef.current.y, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(mouseRef.current.x - 12, mouseRef.current.y); ctx.lineTo(mouseRef.current.x + 12, mouseRef.current.y);
        ctx.moveTo(mouseRef.current.x, mouseRef.current.y - 12); ctx.lineTo(mouseRef.current.x, mouseRef.current.y + 12); ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, onGameOver, setLives, setScore, spawnWave, queueNextWave, setLevel, shopOpen]);

  return (
    <div 
        ref={containerRef}
        className={`relative rounded-lg overflow-hidden shadow-2xl border-2 border-slate-800 ${shopOpen ? 'cursor-default' : 'cursor-none'}`}
        style={{ touchAction: shopOpen ? 'pan-y' : 'none' }} 
        onTouchStart={shopOpen ? undefined : handleTouchStart}
        onTouchMove={shopOpen ? undefined : handleTouchMove}
        onTouchEnd={shopOpen ? undefined : handleTouchEnd}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="bg-black block w-full max-w-[800px] h-auto"
      />
      <div className="scanlines"></div>
      
      {enemiesRef.current.length === 0 && !shopOpen && gameState === GameState.PLAYING && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none">
           <div className="text-green-400 font-mono text-xl animate-pulse mb-2 uppercase">Scanning for Hostiles...</div>
        </div>
      )}

      {gameState === GameState.PLAYING && !shopOpen && (
          <button 
            onClick={(e) => { e.stopPropagation(); setGameState(GameState.PAUSED); }}
            className="absolute top-4 right-4 z-20 p-3 bg-slate-900/50 border border-slate-600 text-white rounded hover:bg-slate-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
          </button>
      )}

      {shopOpen && (
        <div 
            className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-30 animate-in fade-in cursor-default p-4 sm:p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-600 scrollbar-track-slate-900"
            style={{ touchAction: 'pan-y' }}
        >
           <div className="w-full max-w-4xl flex justify-between items-center mb-8 border-b-2 border-cyan-800 pb-4">
              <h2 className="text-2xl sm:text-4xl font-bold text-cyan-400 tracking-widest uppercase">Armory</h2>
              <div className="flex items-center gap-2">
                 <span className="text-slate-400 font-mono text-sm sm:text-base">CR:</span>
                 <span className="text-xl sm:text-3xl text-yellow-400 font-mono font-bold tracking-widest">{currentCredits}</span>
              </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full mb-8">
             {shopItems.map((item) => (
               <div
                 key={item.id}
                 className={`relative flex flex-col p-4 bg-slate-900 border border-slate-700 rounded-sm hover:border-cyan-500 transition-all group ${currentCredits < item.cost ? 'opacity-50 grayscale' : 'hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]'}`}
                 onTouchEnd={(e) => { e.stopPropagation(); handleBuyItem(item); }}
                 onClick={() => handleBuyItem(item)}
               >
                 <div className="absolute top-0 right-0 p-1 bg-slate-800 text-xs font-mono text-slate-400 border-l border-b border-slate-700">MK-{Math.floor(Math.random()*9)}</div>
                 <div className="h-24 w-full mb-4 bg-slate-950 flex items-center justify-center border border-slate-800 relative overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 opacity-20 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_25%,rgba(255,255,255,0.05)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.05)_75%,rgba(255,255,255,0.05)_100%)] bg-[length:10px_10px]" />
                    <div className="w-12 h-12 rounded-full shadow-[0_0_20px_currentColor]" style={{ backgroundColor: item.color, color: item.color }} />
                 </div>
                 <h3 className="text-lg font-bold text-white mb-1 font-mono truncate pointer-events-none">{item.title}</h3>
                 <p className="text-xs text-slate-400 font-mono mb-4 h-8 pointer-events-none">{item.description}</p>
                 <button
                    className="mt-auto py-2 bg-slate-800 hover:bg-cyan-700 disabled:hover:bg-slate-800 disabled:cursor-not-allowed text-white font-mono text-sm border border-slate-600 hover:border-cyan-400 transition-colors flex justify-between px-3 pointer-events-none"
                    disabled={currentCredits < item.cost}
                 >
                    <span>BUY</span>
                    <span className="text-yellow-400">{item.cost}</span>
                 </button>
               </div>
             ))}
           </div>
           <button 
             onClick={handleNextWave}
             className="w-full sm:w-auto px-12 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold tracking-widest text-xl border-2 border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all transform hover:scale-105"
           >
             LAUNCH MISSION
           </button>
        </div>
      )}
    </div>
  );
};