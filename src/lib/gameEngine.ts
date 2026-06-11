import { WEAPONS } from '../data';
import { Projectile, TankState, Particle, FloatingText } from '../types';
import { carveCrater, buildHighway, carveBottomlessVoid, TerrainData } from './terrain';

/**
 * Normalizes an angle to 0 - 360
 */
function normalizeAngle(angle: number): number {
  return (angle % 360 + 360) % 360;
}

/**
 * Spawns explosion particles at (x, y) with a custom color
 */
export function spawnExplosionParticles(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  count: number = 30
): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      size: 2 + Math.random() * 4,
      life: 0,
      maxLife: 20 + Math.random() * 25,
      type: 'fire',
    });
  }

  // Add some secondary dirt particles
  for (let i = 0; i < count / 2; i++) {
    const angle = -Math.PI * Math.random(); // upwards
    const speed = 0.5 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: '#78350f', // brown dirt
      size: 1.5 + Math.random() * 3,
      life: 0,
      maxLife: 30 + Math.random() * 20,
      type: 'dirt',
    });
  }
}

/**
 * Spawns sparkles (e.g. for Indian Spy, Chess dart)
 */
export function spawnSparkles(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  count: number = 10
): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 2.5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      size: 1.5 + Math.random() * 2,
      life: 0,
      maxLife: 15 + Math.random() * 15,
      type: 'spark',
    });
  }
}

/**
 * Spawns physical particles for custom animations
 */
export function spawnCockroachSparks(
  particles: Particle[],
  x: number,
  y: number,
  count: number = 5
): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: '#451a03', // dark cockroach brown
      size: 2.5,
      life: 0,
      maxLife: 15 + Math.random() * 10,
      type: 'cockroach',
    });
  }
}

/**
 * Spawns a floating feedback word on screen
 */
export function addFloatingText(
  floatingTexts: FloatingText[],
  text: string,
  x: number,
  y: number,
  color: string
): void {
  floatingTexts.push({
    id: 'txt_' + Math.random().toString(36).substring(2, 9),
    text,
    x,
    y: y - 10,
    color,
    life: 0,
    maxLife: 45,
  });
}

/**
 * Helper to apply damage to any tanks inside blast radius
 */
export function applyBlastDamage(
  x: number,
  y: number,
  radius: number,
  maxDamage: number,
  tanks: TankState[],
  floatingTexts: FloatingText[]
): void {
  tanks.forEach((tank) => {
    // Distance from blast
    const dx = tank.x - x;
    const dy = tank.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= radius) {
      // Linear falloff for damage
      const factor = 1 - dist / radius;
      const finalDamage = Math.max(1, Math.round(maxDamage * factor));
      tank.health = Math.max(0, tank.health - finalDamage);

      // Flash feedback
      addFloatingText(
        floatingTexts,
        `-${finalDamage} HP`,
        tank.x,
        tank.y - 12,
        '#ef4444'
      );
    }
  });
}

/**
 * Handles one full tick update of the physics engine loop.
 * Updates projectiles, gravity, winds, particle states, status lifetimes.
 */
export function updatePhysicsTick(
  projectiles: Projectile[],
  particles: Particle[],
  floatingTexts: FloatingText[],
  tanks: TankState[],
  terrain: TerrainData,
  windSpeed: number,
  gravity: number,
  canvasWidth: number,
  canvasHeight: number,
  onTurnComplete: () => void,
  activePlayerId: 'p1' | 'p2'
): { shouldCheckFalls: boolean } {
  let shouldCheckFalls = false;
  const nextProjectiles: Projectile[] = [];

  // 1. Update projectiles
  for (let p of projectiles) {
    p.time++;

    // Let's copy state to perform standard integration unless overridden
    let nx = p.x;
    let ny = p.y;
    let nvx = p.vx;
    let nvy = p.vy;

    // Apply wind (unless weapon is Samay's Checkmate, which resists wind entirely!)
    if (p.weaponId !== 'samay_checkmate' && p.weaponId !== 'dhruv_rathee') {
      nvx += windSpeed * 0.1; // modest wind force accumulation
    }

    // Apply gravity (unless specifically low gravity or custom crawling projectile)
    const effectiveGravity = p.customGravity !== undefined ? p.customGravity : gravity;
    if (p.weaponId !== 'modi_melody' && p.weaponId !== 'gadkari_highway') {
      nvy += effectiveGravity;
    }

    // Custom Tracing & Actions
    if (p.weaponId === 'physics_wallah') {
      // Looping sine-wave: x is standard bullet baseX, but y oscillates
      // We store the true ballistic coordinates inside p.startX and p.startY, incremented by base velocities
      // To keep it simple, let's treat (startX, startY) as current ballistic center
      p.startX += p.vx;
      p.startY += p.vy;
      // Accumulate gravity on vertical component of the true center
      p.vy += gravity;

      nx = p.startX;
      // Sine offset based on x
      ny = p.startY + Math.sin(p.startX * 0.08) * 38;
      nvx = p.vx;
      nvy = p.vy;
    } else if (p.weaponId === 'modi_melody') {
      // Crawling musical wave
      nx += p.vx;
      const roundedX = Math.round(nx);
      if (roundedX >= 0 && roundedX < canvasWidth) {
        // Rides 10px above the ground contour
        ny = terrain.heights[roundedX] - 10;
      } else {
        ny += p.vy; // fall offscreen
      }

      // Spawn concentric sound waves
      if (p.time % 2 === 0) {
        particles.push({
          x: nx,
          y: ny,
          vx: 0,
          vy: -0.2,
          color: '#ec4899',
          size: 4 + Math.random() * 4,
          life: 0,
          maxLife: 15,
          type: 'soundwave',
        });
      }
    } else if (p.weaponId === 'gadkari_highway') {
      // Road Roller: moves along terrain and flattens it
      nx += p.vx;
      const roundedX = Math.round(nx);
      if (roundedX >= 0 && roundedX < canvasWidth) {
        ny = terrain.heights[roundedX] - 3;
        
        // Pave asphalt! Convert terrain between previous coordinate and current to flat
        const prevRoundedX = Math.round(p.x);
        // Gadkari flattens terrain to the current roller level
        buildHighway(terrain, prevRoundedX, roundedX, ny + 3);
        shouldCheckFalls = true;

        // Spawn grey highway dust paving sparks
        if (p.time % 2 === 0) {
          particles.push({
            x: nx,
            y: ny + 4,
            vx: -p.vx * 0.5 + (Math.random() - 0.5),
            vy: -1 - Math.random() * 2,
            color: '#6b7280', // asphalt gray
            size: 3 + Math.random() * 3,
            life: 0,
            maxLife: 20,
            type: 'highway',
          });
        }
      } else {
        ny += 5; // roll offscreen
      }
    } else {
      // Standard ballistic movement
      nx += nvx;
      ny += nvy;
    }

    p.x = nx;
    p.y = ny;
    p.vx = nvx;
    p.vy = nvy;

    // Check pre-peak split for Cockroach Janta Party (CJP) cargo capsule
    if (p.weaponId === 'cjp_swarm' && p.subType !== 'cockroach') {
      // Peak detected when vertical velocity transitions from negative (climbing) to positive (falling)
      // Or if it starts heading downward. Let's trigger split when vy >= 0
      if (p.vy >= 0 && p.time > 8) {
        // Split! Destroy this capsule, spawn 8 homing cockroach mini-projectiles
        // We throw them in a radial fan
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4 + (Math.random() - 0.5) * 0.2;
          const speed = 2.5 + Math.random() * 1.5;
          nextProjectiles.push({
            id: 'cjp_bug_' + Math.random().toString(36).substring(2, 7),
            x: p.x,
            y: p.y - 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            weaponId: 'cjp_swarm',
            subType: 'cockroach',
            ownerId: p.ownerId,
            time: 0,
            startX: p.x,
            startY: p.y,
            customGravity: gravity * 0.15, // floatier falling swarm!
          });
        }

        // Spawn dust/shell crack particles
        spawnExplosionParticles(particles, p.x, p.y, '#38bdf8', 15);
        floatingTexts.push({
          id: 'cjp_txt',
          text: 'SWARM SPLIT!',
          x: p.x,
          y: p.y - 15,
          color: '#38bdf8',
          life: 0,
          maxLife: 35,
        });

        // Skip adding the parent capsule itself
        continue;
      }
    }

    // Swarm Cockroaches Homing Steer Logic
    if (p.weaponId === 'cjp_swarm' && p.subType === 'cockroach') {
      // Find the enemy tank
      const opponentId = p.ownerId === 'p1' ? 'p2' : 'p1';
      const enemyTank = tanks.find((t) => t.id === opponentId);
      
      if (enemyTank) {
        // Steer vector towards the enemy tank's cabin
        const dx = enemyTank.x - p.x;
        const dy = (enemyTank.y - 8) - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
          const force = 0.22;
          const targetVx = (dx / dist) * 4.2;
          const targetVy = (dy / dist) * 4.2;

          // Steer interpolation
          p.vx = p.vx * (1 - force) + targetVx * force;
          p.vy = p.vy * (1 - force) + targetVy * force;
        }
      }

      // Add a crawling smoke/sparkle trace
      if (p.time % 2 === 0) {
        particles.push({
          x: p.x,
          y: p.y,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          color: '#b45309', // shiny amber bug color
          size: 2,
          life: 0,
          maxLife: 10,
          type: 'cockroach',
        });
      }
    }

    // Spawn flight trails
    if (p.time % 3 === 0) {
      let tColor = '#ffffff';
      const masterWeapon = WEAPONS.find((w) => w.id === p.weaponId || (p.weaponId === 'cjp_swarm' && w.id === 'cjp_swarm'));
      if (masterWeapon) {
        tColor = masterWeapon.tintColor;
      }

      particles.push({
        x: p.x,
        y: p.y,
        vx: -p.vx * 0.2,
        vy: -p.vy * 0.2,
        color: tColor,
        size: p.subType === 'cockroach' ? 1.5 : 2.5,
        life: 0,
        maxLife: p.subType === 'cockroach' ? 8 : 18,
        type: 'smoke',
      });
    }

    // CHECK COLLISIONS
    let isCollision = false;
    let hitX = p.x;
    let hitY = p.y;

    // A: Check Screen floor or terrain height intersection
    const roundedX = Math.round(p.x);
    if (roundedX >= 0 && roundedX < canvasWidth) {
      const terrainY = terrain.heights[roundedX];
      if (p.y >= terrainY) {
        isCollision = true;
        hitX = p.x;
        hitY = terrainY;
      }
    } else {
      // Offscreen sides cleanup: remove projectles if they wander too far left/right
      if (p.x < -100 || p.x > canvasWidth + 100 || p.y > canvasHeight + 100) {
        continue; // drop
      }
    }

    // B: Check direct collision with any tank capsule
    for (let tank of tanks) {
      const dx = p.x - tank.x;
      const dy = p.y - (tank.y - 8); // center height of tank
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 15) { // tank width circle overlap
        isCollision = true;
        hitX = p.x;
        hitY = p.y;
        break;
      }
    }

    // C: Check road roller expiration
    if (p.weaponId === 'gadkari_highway') {
      const distanceRolled = Math.abs(p.x - p.startX);
      if (distanceRolled > canvasWidth * 0.396 || p.x < 5 || p.x > canvasWidth - 5) {
        isCollision = true;
        hitX = p.x;
        hitY = p.y;
      }
    }

    if (isCollision) {
      // EXPLODE! Trigger crater damage and unique weapon effects
      const weaponDef = WEAPONS.find((w) => w.id === p.weaponId);
      if (weaponDef) {
        const rad = weaponDef.craterRadius;
        const dmg = weaponDef.damage;
        const color = weaponDef.tintColor;

        if (p.weaponId === 'bmc_metro') {
          // Explodes normally first
          carveCrater(terrain, hitX, hitY, rad, canvasHeight);
          applyBlastDamage(hitX, hitY, rad, dmg, tanks, floatingTexts);
          spawnExplosionParticles(particles, hitX, hitY, color, 25);
          shouldCheckFalls = true;

          // SPECIAL: Spawns a horizontal fan of 5 smaller fireballs
          // Let's create them as sub-explosions directly flanking the hit site!
          for (let f = -2; f <= 2; f++) {
            if (f === 0) continue; // main already done
            const checkX = hitX + f * 24;
            if (checkX >= 0 && checkX < canvasWidth) {
              const checkY = terrain.heights[Math.round(checkX)];
              // Schedule small secondary blast after negligible delay
              // Or execute them instantly to clear side dirt!
              carveCrater(terrain, checkX, checkY, 18, canvasHeight);
              applyBlastDamage(checkX, checkY, 18, 10, tanks, floatingTexts);
              spawnExplosionParticles(particles, checkX, checkY, '#fb923c', 8);
            }
          }
        } 
        else if (p.weaponId === 'cjp_swarm') {
          // Individual cockroach hit or initial capsule fail hit
          carveCrater(terrain, hitX, hitY, rad, canvasHeight);
          applyBlastDamage(hitX, hitY, rad, dmg, tanks, floatingTexts);
          spawnExplosionParticles(particles, hitX, hitY, color, 12);
          shouldCheckFalls = true;
        } 
        else if (p.weaponId === 'duniya_khatam') {
          // Massive devastation strike!
          carveCrater(terrain, hitX, hitY, rad, canvasHeight);
          applyBlastDamage(hitX, hitY, rad, dmg, tanks, floatingTexts);
          spawnExplosionParticles(particles, hitX, hitY, color, 50);
          shouldCheckFalls = true;

          // Double rumble effects
          for (let i = 0; i < 5; i++) {
            const rx = hitX + (Math.random() - 0.5) * 40;
            const ry = hitY + (Math.random() - 0.5) * 20;
            spawnExplosionParticles(particles, rx, ry, '#ea580c', 8);
          }
        } 
        else if (p.weaponId === 'modi_melody') {
          // Melody Blast confuse
          carveCrater(terrain, hitX, hitY, rad, canvasHeight);
          applyBlastDamage(hitX, hitY, rad, dmg, tanks, floatingTexts);
          spawnExplosionParticles(particles, hitX, hitY, color, 20);
          shouldCheckFalls = true;

          // Apply state: CONFUSED on the hit enemy or nearest
          const opponentId = p.ownerId === 'p1' ? 'p2' : 'p1';
          const enemy = tanks.find((t) => t.id === opponentId);
          if (enemy) {
            enemy.status.melodyConfused = true;
            addFloatingText(floatingTexts, 'MELODY CONFUSED! AIM FLUCTUATION!', enemy.x, enemy.y - 30, '#ec4899');
          }
        } 
        else if (p.weaponId === 'samay_checkmate') {
          // Checkmate precision lock
          carveCrater(terrain, hitX, hitY, rad, canvasHeight);
          applyBlastDamage(hitX, hitY, rad, dmg, tanks, floatingTexts);
          spawnExplosionParticles(particles, hitX, hitY, color, 15);
          spawnSparkles(particles, hitX, hitY, color, 20);
          shouldCheckFalls = true;

          const opponentId = p.ownerId === 'p1' ? 'p2' : 'p1';
          const enemy = tanks.find((t) => t.id === opponentId);
          if (enemy) {
            enemy.status.checkmateLocked = true;
            addFloatingText(floatingTexts, 'CHECKMATED! POWER LOCKED 50%!', enemy.x, enemy.y - 30, '#a855f7');
          }
        } 
        else if (p.weaponId === 'indian_spy') {
          // Spy blind
          carveCrater(terrain, hitX, hitY, rad, canvasHeight);
          applyBlastDamage(hitX, hitY, rad, dmg, tanks, floatingTexts);
          spawnExplosionParticles(particles, hitX, hitY, '#f8fafc', 40); // Blinding flash
          shouldCheckFalls = true;

          const opponentId = p.ownerId === 'p1' ? 'p2' : 'p1';
          const enemy = tanks.find((t) => t.id === opponentId);
          if (enemy) {
            enemy.status.spyBlindedTurns = 1;
            addFloatingText(floatingTexts, 'BLINDED! SENSORS OFF 1 TURN!', enemy.x, enemy.y - 30, '#94a3b8');
          }
        } 
        else if (p.weaponId === 'gadkari_highway') {
          // Highway roll completes: just sparkles and clean stop
          spawnSparkles(particles, hitX, hitY, '#4b5563', 25);
          // Small bump damage if rolls into tank
          applyBlastDamage(hitX, hitY, rad, dmg, tanks, floatingTexts);
        } 
        else if (p.weaponId === 'physics_wallah') {
          // Gravity Reversal Revolution!
          carveCrater(terrain, hitX, hitY, rad, canvasHeight);
          applyBlastDamage(hitX, hitY, rad, dmg, tanks, floatingTexts);
          spawnExplosionParticles(particles, hitX, hitY, color, 30);
          shouldCheckFalls = true;

          // Physics: launch caught tanks high in the air!
          tanks.forEach((tank) => {
            const dx = tank.x - hitX;
            const dy = tank.y - hitY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= rad + 25) {
              // Apply airborne logic and vertical upward velocity (negative y velocity)
              // This represents gravity reversing!
              const factor = 1 - dist / (rad + 25);
              const launchVel = -8 - factor * 8; // launches sky-high!
              
              const isP = (tank as any).isAirborne;
              if (isP === undefined || !isP) {
                (tank as any).isAirborne = true;
                (tank as any).airborneVy = launchVel;
                (tank as any).airborneStartX = tank.x;
                (tank as any).airborneStartY = tank.y; // record fall source
                addFloatingText(floatingTexts, 'REVOLUTION! REVERSED GRAVITY!', tank.x, tank.y - 35, '#10b981');
              }
            }
          });
        } 
        else if (p.weaponId === 'cheen_tapak') {
          // Opens bottomless void
          carveBottomlessVoid(terrain, hitX, rad, canvasHeight);
          applyBlastDamage(hitX, hitY, rad, dmg, tanks, floatingTexts);
          spawnExplosionParticles(particles, hitX, hitY, color, 25);
          shouldCheckFalls = true;

          // Spawn neat floating black hole void particles
          for (let i = 0; i < 20; i++) {
            particles.push({
              x: hitX + (Math.random() - 0.5) * rad,
              y: hitY + Math.random() * (canvasHeight - hitY),
              vx: 0,
              vy: 2 + Math.random() * 4,
              color: '#111827', // deep black void particles
              size: 2 + Math.random() * 3,
              life: 0,
              maxLife: 25,
              type: 'void',
            });
          }
        }
      }
    } else {
      nextProjectiles.push(p);
    }
  }

  // Swap lists
  projectiles.length = 0;
  projectiles.push(...nextProjectiles);

  // 2. Update particle timelines
  const nextParticles: Particle[] = [];
  for (let p of particles) {
    p.life++;
    if (p.life < p.maxLife) {
      // Apply physical forces
      if (p.type === 'dirt') {
        p.vy += 0.15; // dirt gravity
      } else if (p.type === 'fire') {
        p.vy -= 0.05; // fire rises slightly
        p.vx *= 0.95;
      }
      p.x += p.vx;
      p.y += p.vy;
      nextParticles.push(p);
    }
  }
  particles.length = 0;
  particles.push(...nextParticles);

  // 3. Update floating damage text lifetimes
  const nextTexts: FloatingText[] = [];
  for (let t of floatingTexts) {
    t.life++;
    if (t.life < t.maxLife) {
      t.y -= 0.45; // float slow upwards
      nextTexts.push(t);
    }
  }
  floatingTexts.length = 0;
  floatingTexts.push(...nextTexts);

  // 4. Trace and simulate Airborne Tanks under Physics Wallah's gravity reverse
  tanks.forEach((tank) => {
    const tAny = tank as any;
    if (tAny.isAirborne) {
      // Simulate tank position
      tAny.airborneVy += gravity; // downward gravity acceleration
      tank.y += tAny.airborneVy;

      // Bound checks
      const rx = Math.round(tank.x);
      if (rx >= 0 && rx < canvasWidth) {
        const landY = terrain.heights[rx];
        if (tank.y >= landY) {
          // Landed back on dirt!
          tank.y = landY;
          const landImpactVy = tAny.airborneVy;
          tAny.isAirborne = false;
          tAny.airborneVy = 0;

          // Take heavy fall damage proportional to impact velocity
          if (landImpactVy > 2.5) {
            const fdmg = Math.round(landImpactVy * 4.8);
            tank.health = Math.max(0, tank.health - fdmg);
            addFloatingText(floatingTexts, `+FALL DAMAGE! -${fdmg} HP`, tank.x, tank.y - 12, '#ef4444');
          } else {
            addFloatingText(floatingTexts, 'LANDED SAFELY', tank.x, tank.y - 12, '#34d399');
          }
          shouldCheckFalls = true;
        }
      } else {
        // Fall offscreen sides, stick to floor
        if (tank.y > canvasHeight - 15) {
          tank.y = canvasHeight - 15;
          tAny.isAirborne = false;
          tAny.airborneVy = 0;
        }
      }

      // Spawn falling particles under tank treads
      particles.push({
        x: tank.x + (Math.random() - 0.5) * 12,
        y: tank.y,
        vx: 0,
        vy: 0.1,
        color: tank.color,
        size: 2,
        life: 0,
        maxLife: 8,
        type: 'smoke',
      });
    }
  });

  return { shouldCheckFalls };
}

/**
 * Ensures tanks slide down into craters if terrain underneath gets hollowed out,
 * tallying appropriate slide fall damages.
 */
export function handleTankFalling(
  tanks: TankState[],
  terrain: TerrainData,
  floatingTexts: FloatingText[],
  canvasHeight: number
): void {
  tanks.forEach((tank) => {
    const tAny = tank as any;
    if (tAny.isAirborne) {
      // Let standard ballistic gravity launch simulation handle this tank
      return;
    }

    const rx = Math.round(tank.x);
    if (rx >= 0 && rx < terrain.heights.length) {
      const gY = terrain.heights[rx];
      if (tank.y < gY - 1) {
        const fallDistance = gY - tank.y;
        tank.y = gY;

        // Slide fall damage if hole was extremely deep (Pocket Tanks fall damage)
        if (fallDistance > 25) {
          const slideDmg = Math.min(25, Math.round(fallDistance * 0.16));
          tank.health = Math.max(0, tank.health - slideDmg);
          addFloatingText(
            floatingTexts,
            `FALL! -${slideDmg} HP`,
            tank.x,
            tank.y - 15,
            '#f97316'
          );
        }
      } else if (tank.y > gY + 1) {
        // Conforms back up if dirt got paved higher
        tank.y = gY;
      }
    }
  });
}

/**
 * Handles the "instant green laser line" calculations for Dhruv Rathee's Analysis Laser.
 */
export function fireInstantDhruvRatheeLaser(
  shooter: TankState,
  target: TankState,
  terrain: TerrainData,
  particles: Particle[],
  floatingTexts: FloatingText[],
  canvasWidth: number,
  canvasHeight: number
): void {
  // Laser launches from barrel end
  const angleRad = (shooter.angle * Math.PI) / 180;
  const barrelLen = 15;
  const barrelEndX = shooter.x + Math.cos(angleRad) * barrelLen;
  const barrelEndY = (shooter.y - 11) - Math.sin(angleRad) * barrelLen;

  // Let's raycast!
  let cx = barrelEndX;
  let cy = barrelEndY;
  const step = 4;
  const dx = Math.cos(angleRad) * step;
  const dy = -Math.sin(angleRad) * step; // subtract in canvas space

  let laserHitX = cx;
  let laserHitY = cy;
  let hitsSomething = false;

  for (let i = 0; i < 250; i++) { // step limits
    cx += dx;
    cy += dy;

    // Boundary check
    if (cx < 0 || cx >= canvasWidth || cy < 0 || cy >= canvasHeight) {
      laserHitX = Math.max(0, Math.min(canvasWidth - 1, cx));
      laserHitY = Math.max(0, Math.min(canvasHeight - 1, cy));
      break;
    }

    // Check hit target tank
    const distToTarget = Math.sqrt((cx - target.x) * (cx - target.x) + (cy - (target.y - 8)) * (cy - (target.y - 8)));
    if (distToTarget < 15) {
      laserHitX = cx;
      laserHitY = cy;
      hitsSomething = true;
      break;
    }

    // Check hit terrain height map
    const rx = Math.round(cx);
    if (rx >= 0 && rx < canvasWidth) {
      if (cy >= terrain.heights[rx]) {
        laserHitX = cx;
        laserHitY = terrain.heights[rx];
        hitsSomething = true;
        break;
      }
    }
  }

  // Draw laser line by generating instantaneous green lightning particle beams
  // Spawns drawing particles that live for 1 frame or 12 frames
  const distLaser = Math.sqrt((laserHitX - barrelEndX) * (laserHitX - barrelEndX) + (laserHitY - barrelEndY) * (laserHitY - barrelEndY));
  const particleStep = 8;
  const stepsCount = distLaser / particleStep;
  for (let s = 0; s <= stepsCount; s++) {
    const ratio = s / stepsCount;
    const px = barrelEndX + (laserHitX - barrelEndX) * ratio;
    const py = barrelEndY + (laserHitY - barrelEndY) * ratio;
    
    particles.push({
      x: px,
      y: py,
      vx: 0,
      vy: 0,
      color: '#22c55e', // neon bright green
      size: 1.5 + Math.random() * 2,
      life: 0,
      maxLife: 15,
      type: 'laser',
    });
  }

  // Create minor laser spark explosions at contact point
  spawnExplosionParticles(particles, laserHitX, laserHitY, '#22c55e', 20);

  // Apply critical scan backfire inside target!
  // Slogan: forcefully detonates one of their own weapons inside their pocket
  const laserDmg = 30;
  target.health = Math.max(0, target.health - laserDmg);
  
  addFloatingText(floatingTexts, 'CRITICAL BACKFIRE IN POCKET! -30 HP', target.x, target.y - 25, '#22c55e');
  spawnExplosionParticles(particles, target.x, target.y - 8, '#f97316', 15);
}
