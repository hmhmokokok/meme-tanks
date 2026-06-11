import { TankState } from '../types';

export interface Cloud {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  opacity: number;
}

export function createClouds(canvasWidth: number, canvasHeight: number): Cloud[] {
  const presets = [
    { x: 0.08, y: 0.08, w: 90, h: 28, speed: 0.06, opacity: 0.95 },
    { x: 0.28, y: 0.14, w: 110, h: 32, speed: 0.04, opacity: 0.88 },
    { x: 0.52, y: 0.06, w: 75, h: 24, speed: 0.07, opacity: 0.92 },
    { x: 0.72, y: 0.12, w: 100, h: 30, speed: 0.05, opacity: 0.9 },
    { x: 0.88, y: 0.05, w: 70, h: 22, speed: 0.08, opacity: 0.85 },
  ];
  return presets.map((p) => ({
    x: p.x * canvasWidth,
    y: p.y * canvasHeight,
    w: p.w,
    h: p.h,
    speed: p.speed,
    opacity: p.opacity,
  }));
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, opacity: number) {
  ctx.save();
  ctx.globalAlpha = opacity * 0.25;
  ctx.fillStyle = '#5A8FB8';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.35, y + h * 0.55, w * 0.38, h * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = opacity;

  ctx.fillStyle = '#FFFFFF';
  const puffs = [
    [0.12, 0.45, 0.26, 0.55],
    [0.28, 0.35, 0.32, 0.68],
    [0.5, 0.42, 0.28, 0.58],
    [0.68, 0.48, 0.24, 0.5],
  ];
  puffs.forEach(([px, py, rx, ry]) => {
    ctx.beginPath();
    ctx.ellipse(x + w * px, y + h * py, w * rx, h * ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

export function drawPocketTanksBackground(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  clouds: Cloud[]
) {
  ctx.imageSmoothingEnabled = true;

  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  skyGrad.addColorStop(0, '#A8E4FF');
  skyGrad.addColorStop(0.35, '#6EC4F5');
  skyGrad.addColorStop(0.65, '#4DA8E8');
  skyGrad.addColorStop(0.88, '#3B8FD4');
  skyGrad.addColorStop(1, '#2E7AB8');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Horizon haze band
  const hazeGrad = ctx.createLinearGradient(0, canvasHeight * 0.38, 0, canvasHeight * 0.62);
  hazeGrad.addColorStop(0, 'rgba(255,255,255,0)');
  hazeGrad.addColorStop(0.5, 'rgba(180,220,255,0.18)');
  hazeGrad.addColorStop(1, 'rgba(120,180,220,0.08)');
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(0, canvasHeight * 0.38, canvasWidth, canvasHeight * 0.24);

  // Distant mountain silhouettes (stay in upper sky — never overlap playable terrain)
  const drawMountains = (baseY: number, amp: number, freq: number, color: string, phase: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= canvasWidth; x += 2) {
      const y =
        baseY -
        Math.abs(Math.sin(x * freq + phase)) * amp -
        Math.abs(Math.cos(x * freq * 1.7 + phase * 0.6)) * (amp * 0.45);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(canvasWidth, baseY);
    ctx.closePath();
    ctx.fill();
  };

  drawMountains(canvasHeight * 0.52, 55, 0.003, 'rgba(90,140,100,0.35)', 0);
  drawMountains(canvasHeight * 0.48, 42, 0.0045, 'rgba(70,120,90,0.28)', 2.1);
  drawMountains(canvasHeight * 0.44, 30, 0.006, 'rgba(55,100,80,0.22)', 4.3);

  // Sun with glow
  const sunX = canvasWidth - 72;
  const sunY = 52;
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 55);
  glow.addColorStop(0, 'rgba(255,248,180,0.9)');
  glow.addColorStop(0.4, 'rgba(255,230,100,0.35)');
  glow.addColorStop(1, 'rgba(255,220,80,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 55, 0, Math.PI * 2);
  ctx.fill();

  const sunBody = ctx.createRadialGradient(sunX - 4, sunY - 4, 2, sunX, sunY, 20);
  sunBody.addColorStop(0, '#FFFDE7');
  sunBody.addColorStop(0.6, '#FFEB3B');
  sunBody.addColorStop(1, '#FBC02D');
  ctx.fillStyle = sunBody;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 20, 0, Math.PI * 2);
  ctx.fill();

  clouds.forEach((cloud) => {
    cloud.x += cloud.speed;
    if (cloud.x > canvasWidth + cloud.w) cloud.x = -cloud.w;
    drawCloud(ctx, cloud.x, cloud.y, cloud.w, cloud.h, cloud.opacity);
  });
}

export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  heights: Float32Array,
  types: Uint8Array,
  canvasWidth: number,
  canvasHeight: number
) {
  const grassDepth = 9;

  // Dirt body
  ctx.beginPath();
  ctx.moveTo(0, canvasHeight);
  for (let x = 0; x < canvasWidth; x++) {
    ctx.lineTo(x, heights[x] + grassDepth);
  }
  ctx.lineTo(canvasWidth, canvasHeight);
  ctx.closePath();

  const dirtGrad = ctx.createLinearGradient(0, canvasHeight * 0.3, 0, canvasHeight);
  dirtGrad.addColorStop(0, '#B8845A');
  dirtGrad.addColorStop(0.2, '#8B5E3C');
  dirtGrad.addColorStop(0.55, '#6B4423');
  dirtGrad.addColorStop(1, '#3E2714');
  ctx.fillStyle = dirtGrad;
  ctx.fill();

  // Dirt speckle texture
  for (let x = 0; x < canvasWidth; x += 7) {
    const surfaceY = heights[x] + grassDepth;
    const hash = ((x * 7919) ^ 104729) % 1000;
    if (hash % 3 !== 0) continue;
    const depth = 8 + (hash % 40);
    ctx.fillStyle = `rgba(30,18,8,${0.08 + (hash % 5) * 0.02})`;
    ctx.fillRect(x, surfaceY + depth, 2, 2);
  }

  // Grass band following terrain contour
  for (let x = 0; x < canvasWidth; x++) {
    const topY = heights[x];
    const type = types[x];

    if (type === 1) {
      ctx.fillStyle = '#4A4A4A';
      ctx.fillRect(x, topY, 1, grassDepth);
      if (x % 12 < 6) {
        ctx.fillStyle = '#FFD54F';
        ctx.fillRect(x, topY + 2, 1, 2);
      }
    } else {
      const t = (x % 5) / 5;
      const r = Math.round(90 + t * 20);
      const g = Math.round(160 + t * 25);
      const b = Math.round(55 + t * 10);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, topY, 1, grassDepth);
    }
  }

  // Bright grass surface line + tufts
  ctx.beginPath();
  ctx.moveTo(0, heights[0]);
  for (let x = 1; x < canvasWidth; x++) {
    ctx.lineTo(x, heights[x]);
  }
  ctx.strokeStyle = '#7BC96F';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(45,90,30,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();

  for (let x = 8; x < canvasWidth; x += 18) {
    if (types[x] === 1) continue;
    const ty = heights[x];
    ctx.strokeStyle = '#6AB04A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, ty);
    ctx.lineTo(x - 2, ty - 4);
    ctx.moveTo(x, ty);
    ctx.lineTo(x + 2, ty - 5);
    ctx.stroke();
  }
}

function parseHex(hex: string): [number, number, number] {
  const num = parseInt(hex.replace('#', ''), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function shadeHex(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return `rgb(${clamp(r + amount)},${clamp(g + amount)},${clamp(b + amount)})`;
}

export function drawPocketTank(
  ctx: CanvasRenderingContext2D,
  tank: TankState
) {
  const { x, y, angle, color } = tank;
  const groundY = y;

  const hullW = 34;
  const hullH = 12;
  const trackH = 7;
  const hullBottom = groundY - trackH;
  const hullTop = hullBottom - hullH;
  const turretY = hullTop + 2;
  const turretR = 8;

  ctx.save();
  ctx.imageSmoothingEnabled = true;

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, groundY + 2, hullW * 0.55, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- Tracks ---
  const trackY = groundY - trackH;
  ctx.fillStyle = '#1E1E1E';
  ctx.beginPath();
  ctx.roundRect(x - hullW / 2 - 2, trackY, hullW + 4, trackH, 2);
  ctx.fill();

  ctx.strokeStyle = '#0A0A0A';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Track wheels
  const wheelCount = 6;
  for (let i = 0; i < wheelCount; i++) {
    const wx = x - hullW / 2 + 4 + (i * (hullW - 2)) / (wheelCount - 1);
    const wy = trackY + trackH / 2 + 0.5;
    ctx.fillStyle = '#2A2A2A';
    ctx.beginPath();
    ctx.arc(wx, wy, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(wx, wy, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Hull body ---
  const hullGrad = ctx.createLinearGradient(x, hullTop, x, hullBottom);
  hullGrad.addColorStop(0, shadeHex(color, 55));
  hullGrad.addColorStop(0.35, color);
  hullGrad.addColorStop(1, shadeHex(color, -45));
  ctx.fillStyle = hullGrad;
  ctx.beginPath();
  ctx.roundRect(x - hullW / 2, hullTop, hullW, hullH, 4);
  ctx.fill();

  ctx.strokeStyle = shadeHex(color, -60);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x - hullW / 2 + 4, hullTop + 2, hullW - 8, 3);

  ctx.fillStyle = shadeHex(color, -30);
  ctx.fillRect(x - hullW / 2 + 2, hullBottom - 2, hullW - 4, 2);

  // --- Turret ---
  const turretGrad = ctx.createRadialGradient(x - 2, turretY - 4, 1, x, turretY - 2, turretR);
  turretGrad.addColorStop(0, shadeHex(color, 40));
  turretGrad.addColorStop(0.7, shadeHex(color, -10));
  turretGrad.addColorStop(1, shadeHex(color, -40));
  ctx.fillStyle = turretGrad;
  ctx.beginPath();
  ctx.arc(x, turretY - 2, turretR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shadeHex(color, -55);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(x - 2, turretY - 5, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = shadeHex(color, -35);
  ctx.fillRect(x - 3, turretY - 5, 6, 3);

  // --- Barrel (on top so turret stays visible) ---
  const angleRad = (angle * Math.PI) / 180;
  const barrelLen = 22;
  const pivotX = x;
  const pivotY = turretY - 1;
  const barrelEndX = pivotX + Math.cos(angleRad) * barrelLen;
  const barrelEndY = pivotY - Math.sin(angleRad) * barrelLen;

  ctx.strokeStyle = '#2C2C2C';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(barrelEndX, barrelEndY);
  ctx.stroke();

  const barrelGrad = ctx.createLinearGradient(pivotX, pivotY, barrelEndX, barrelEndY);
  barrelGrad.addColorStop(0, '#555');
  barrelGrad.addColorStop(0.5, '#777');
  barrelGrad.addColorStop(1, '#444');
  ctx.strokeStyle = barrelGrad;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(barrelEndX, barrelEndY);
  ctx.stroke();

  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(barrelEndX, barrelEndY, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawWindArrow(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  windSpeed: number
) {
  const boxW = 108;
  const boxH = 32;
  const boxX = canvasWidth - boxW - 10;
  const boxY = 10;

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 5);
  ctx.fill();
  ctx.stroke();

  const speedVal = Math.abs(Math.round(windSpeed * 120));
  const dir = windSpeed >= 0 ? 1 : -1;
  const cx = boxX + boxW / 2;

  ctx.fillStyle = '#444';
  ctx.font = 'bold 8px Tahoma, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WIND', cx, boxY + 11);

  const arrowY = boxY + 23;
  ctx.strokeStyle = '#1565C0';
  ctx.fillStyle = '#1565C0';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - dir * 22, arrowY);
  ctx.lineTo(cx + dir * 22, arrowY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + dir * 22, arrowY);
  ctx.lineTo(cx + dir * 14, arrowY - 4);
  ctx.lineTo(cx + dir * 14, arrowY + 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#333';
  ctx.font = 'bold 9px Tahoma, sans-serif';
  ctx.fillText(`${speedVal}`, cx, arrowY + 1);
}
