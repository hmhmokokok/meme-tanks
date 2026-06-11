import { WEAPONS } from '../data';
import { TankState } from '../types';
import { generateTerrain, TerrainData } from './terrain';
import { TANK_SPAWN_OFFSET } from './constants';
import { MAX_MOVES_PER_MATCH } from './movement';

export function createDefaultAmmo(): { [id: string]: number } {
  const ammo: { [id: string]: number } = {};
  WEAPONS.forEach((w) => {
    ammo[w.id] = 1;
  });
  return ammo;
}

export interface MatchInitOptions {
  canvasWidth: number;
  canvasHeight: number;
  p1Name: string;
  p2Name: string;
  p1Color: string;
  p2Color: string;
  terrainSeed?: number;
}

export function buildInitialTanks(terr: TerrainData, opts: MatchInitOptions): TankState[] {
  const p1X = TANK_SPAWN_OFFSET;
  const p2X = opts.canvasWidth - TANK_SPAWN_OFFSET;
  const defaultAmmo = createDefaultAmmo();

  const initP1: TankState = {
    id: 'p1',
    name: opts.p1Name.trim() || 'Player 1',
    x: p1X,
    y: terr.heights[p1X],
    angle: 45,
    power: 60,
    health: 100,
    color: opts.p1Color,
    weapons: { ...defaultAmmo },
    movesRemaining: MAX_MOVES_PER_MATCH,
    status: { melodyConfused: false, checkmateLocked: false, spyBlindedTurns: 0 },
  };

  const initP2: TankState = {
    id: 'p2',
    name: opts.p2Name.trim() || 'Player 2',
    x: p2X,
    y: terr.heights[p2X],
    angle: 135,
    power: 60,
    health: 100,
    color: opts.p2Color,
    weapons: { ...defaultAmmo },
    movesRemaining: MAX_MOVES_PER_MATCH,
    status: { melodyConfused: false, checkmateLocked: false, spyBlindedTurns: 0 },
  };

  return [initP1, initP2];
}

export function createMatchTerrain(width: number, height: number, seed?: number) {
  return generateTerrain(width, height, seed);
}
