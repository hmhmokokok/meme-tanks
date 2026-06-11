import { TankState } from '../types';

export const MOVE_STEP = 18;
export const MAX_MOVES_PER_MATCH = 3;
export const TANK_EDGE_PADDING = 40;

export function moveTank(
  tank: TankState,
  direction: 'forward' | 'back',
  terrainHeights: Float32Array,
  canvasWidth: number
): boolean {
  if (tank.movesRemaining <= 0) return false;

  const delta =
    direction === 'forward'
      ? tank.id === 'p1'
        ? MOVE_STEP
        : -MOVE_STEP
      : tank.id === 'p1'
        ? -MOVE_STEP
        : MOVE_STEP;

  const newX = Math.max(TANK_EDGE_PADDING, Math.min(canvasWidth - TANK_EDGE_PADDING, tank.x + delta));
  if (Math.round(newX) === Math.round(tank.x)) return false;

  tank.x = newX;
  tank.y = terrainHeights[Math.round(newX)];
  tank.movesRemaining -= 1;
  return true;
}
