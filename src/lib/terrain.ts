export interface TerrainData {
  heights: Float32Array;
  types: Uint8Array;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Procedurally generates a smooth 2D rolling hills heightmap.
 * Optional seed keeps terrain identical across online clients.
 */
export function generateTerrain(width: number, height: number, seed?: number): TerrainData {
  const heights = new Float32Array(width);
  const types = new Uint8Array(width);
  const rand = seed != null ? mulberry32(seed) : Math.random;

  const baseline = height * 0.65;
  const wave1Amp = 60 + rand() * 40;
  const wave1Freq = 0.002 + rand() * 0.0015;
  const wave2Amp = 20 + rand() * 20;
  const wave2Freq = 0.008 + rand() * 0.004;
  const wave3Amp = 5 + rand() * 8;
  const wave3Freq = 0.025 + rand() * 0.015;
  const phaseOffset = rand() * 1000;

  for (let x = 0; x < width; x++) {
    const rx = x + phaseOffset;
    const h =
      baseline +
      Math.sin(rx * wave1Freq) * wave1Amp +
      Math.cos(rx * wave2Freq) * wave2Amp +
      Math.sin(rx * wave3Freq) * wave3Amp;

    heights[x] = Math.min(Math.max(h, height * 0.35), height - 15);
    types[x] = 0;
  }

  return { heights, types };
}

export function carveCrater(
  terrain: TerrainData,
  centerX: number,
  centerY: number,
  radius: number,
  canvasHeight: number
): { cellsModified: number } {
  const width = terrain.heights.length;
  let cellsModified = 0;
  const startX = Math.max(0, Math.floor(centerX - radius));
  const endX = Math.min(width - 1, Math.ceil(centerX + radius));

  for (let x = startX; x <= endX; x++) {
    if (terrain.types[x] === 1) continue;
    const dx = x - centerX;
    const dySquared = radius * radius - dx * dx;
    if (dySquared >= 0) {
      const dy = Math.sqrt(dySquared);
      const craterTop = centerY - dy;
      const craterBottom = centerY + dy;
      if (terrain.heights[x] < craterBottom) {
        if (terrain.heights[x] >= craterTop) {
          terrain.heights[x] = craterBottom;
        } else if (craterTop < terrain.heights[x]) {
          terrain.heights[x] = craterBottom;
        } else if (terrain.heights[x] < craterTop) {
          terrain.heights[x] = Math.max(terrain.heights[x], craterBottom);
        }
        cellsModified++;
      }
    }
  }

  for (let x = 0; x < width; x++) {
    if (terrain.heights[x] > canvasHeight - 2) {
      terrain.heights[x] = canvasHeight - 2;
    }
  }
  return { cellsModified };
}

export function buildHighway(
  terrain: TerrainData,
  startX: number,
  endX: number,
  targetY: number
): void {
  const width = terrain.heights.length;
  const left = Math.max(0, Math.min(startX, endX));
  const right = Math.min(width - 1, Math.max(startX, endX));
  for (let x = left; x <= right; x++) {
    terrain.heights[x] = targetY;
    terrain.types[x] = 1;
  }
}

export function carveBottomlessVoid(
  terrain: TerrainData,
  centerX: number,
  radius: number,
  canvasHeight: number
): void {
  const width = terrain.heights.length;
  const startX = Math.max(0, Math.floor(centerX - radius));
  const endX = Math.min(width - 1, Math.ceil(centerX + radius));
  for (let x = startX; x <= endX; x++) {
    terrain.heights[x] = canvasHeight - 2;
    terrain.types[x] = 0;
  }
}
