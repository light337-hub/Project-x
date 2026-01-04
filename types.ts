export enum GameState {
  MENU,
  PLAYING,
  PAUSED,
  GAME_OVER
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  vx: number;
  vy: number;
  markedForDeletion: boolean;
}

export type GunType = 'blaster' | 'spread' | 'plasma' | 'vulcan';

export interface Player extends Entity {
  hp: number;
  maxHp: number;
  weaponLevel: number;
  score: number;
  credits: number;
  invulnerableUntil: number;
  rotation: number;
  gunType: GunType;
  moveSpeed: number;
}

export type EnemyType = 'scout' | 'fighter' | 'tank' | 'boss' | 'turret' | 'kamikaze' | 'bomber' | 'support' | 'swarm' | 'cloaked' | 'decoy';

export interface Enemy extends Entity {
  hp: number;
  maxHp: number;
  type: EnemyType;
  scoreValue: number;
  creditsValue: number;
  formationOffset?: Point;
}

export interface Projectile extends Entity {
  damage: number;
  isEnemy: boolean;
  piercing?: boolean;
  isMine?: boolean;
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  size: number;
}

export interface PowerUp extends Entity {
  type: 'weapon' | 'health';
  value: number;
}

export interface WaveConfig {
  enemies: {
    type: EnemyType;
    count: number;
    speed: number;
    hp: number;
    color: string;
    formation?: 'v' | 'line' | 'random';
  }[];
  flavorText: string;
}

export interface GameStats {
  score: number;
  level: number;
  enemiesDefeated: number;
}

export interface UpgradeOption {
  id: string;
  title: string;
  description: string;
  type: 'gun' | 'stat' | 'heal';
  cost: number;
  apply: (player: Player) => void;
  color: string;
}

export interface LeaderboardEntry {
  id: number;
  username: string;
  score: number;
  level: number;
  created_at: string;
}