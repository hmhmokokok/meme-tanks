export interface Weapon {
  id: string;
  name: string;
  slogan: string;
  description: string;
  trajectoryDesc: string;
  tintColor: string;
  craterRadius: number;
  damage: number;
}

export interface TankStatus {
  melodyConfused: boolean;       // ±15 deg random fluctuation
  checkmateLocked: boolean;      // Power locked at exactly 50%
  spyBlindedTurns: number;       // Blinds HUD for 1 turn when active
}

export interface TankState {
  id: 'p1' | 'p2';
  name: string;
  x: number;
  y: number;
  angle: number;                 // 0 to 180 deg
  power: number;                 // 0 to 100%
  health: number;                // 0 to 100
  color: string;
  weapons: { [weaponId: string]: number }; // weaponId -> stock (1 use each)
  movesRemaining: number;        // Forward/back moves left this match (max 3)
  status: TankStatus;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  weaponId: string;
  ownerId: 'p1' | 'p2';
  customGravity?: number;        // Optional low/high gravity modifier
  time: number;                  // Simulation step tracker
  startX: number;
  startY: number;
  isCustomMovement?: boolean;    // Flag for non-ballistic orbits (e.g. soundwaves, roller)
  subType?: string;              // Specific subclasses
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  type: 'fire' | 'dirt' | 'spark' | 'smoke' | 'cockroach' | 'soundwave' | 'laser' | 'void' | 'highway';
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface GameSettings {
  windSpeed: number;             // Horizontal acceleration applied per frame (-0.05 to 0.05)
  gravity: number;               // Standard downward acceleration (approx 0.15)
  terrainWidth: number;          // Typically matches screen size, e.g. 1000
  terrainHeight: number;         // Max canvas height, e.g. 500
}

export type GamePhase = 'START_SCREEN' | 'ONLINE_LOBBY' | 'PLAYING' | 'GAME_OVER';
export type PlayMode = 'offline' | 'online';
export type LocalPlayerRole = 'p1' | 'p2' | 'both';
