import { Weapon } from './types';

export const WEAPONS: Weapon[] = [
  {
    id: 'bmc_metro',
    name: 'BMC Metro Project',
    slogan: 'Detour since 2012. Watch out for flying debris!',
    description: 'Launches a single high-speed commuter bullet. Upon contact, it explodes into a horizontal fan of 5 fiery mini-blasts that level any surrounding sand barrier.',
    trajectoryDesc: 'Fast, low-arc projectile. Spawns horizontal fan on impact.',
    tintColor: '#facc15', // Gold
    craterRadius: 36,
    damage: 25,
  },
  {
    id: 'cjp_swarm',
    name: 'Cockroach Janta Party Swarm',
    slogan: 'Chronology samajhiye! First they flying, then they hounding!',
    description: 'Launches a cargo capsule up into the heavens. At its peak altitude, it breaks open into 8 homing cockroach missiles that seek the nearest tank to chip away their health!',
    trajectoryDesc: 'Launches capsule high. Splits mid-air into 8 homing missiles.',
    tintColor: '#38bdf8', // Light Blue
    craterRadius: 18,
    damage: 8, // (per cockroach)
  },
  {
    id: 'duniya_khatam',
    name: '"2026 Duniya Khatam" Strike',
    slogan: 'Lallan Mama predicted. Prepare for the end, bhakt jano!',
    description: 'A slow-flying heavy apocalyptic mortar with massive gravity drag. Its detonating yield creates an immense crater, pulling everything into a deep dirt pit.',
    trajectoryDesc: 'Very slow, heavy mortar. Absolute mass destruction crater.',
    tintColor: '#ef4444', // Hot Red
    craterRadius: 85,
    damage: 45,
  },
  {
    id: 'modi_melody',
    name: 'MODI KI Melody Blast',
    slogan: 'Melody khao, melodi ban jao! Italian relationship chemistry.',
    description: 'A ground-scrolling musical sine-blast that floats just above the terrain. Upon detonation, it confuses the enemy: their aim changes randomly by ±15° on their next turn.',
    trajectoryDesc: 'Soundwave that crawls along terrain heights. Confuses enemy controls.',
    tintColor: '#ec4899', // Hot Pink
    craterRadius: 28,
    damage: 18,
  },
  {
    id: 'samay_checkmate',
    name: "Samay Raina's Checkmate",
    slogan: 'Are you comedian? Game status: forced checkmate in 1 move.',
    description: 'A high-velocity, laser-accurate chess piece dart unaffected by any wind, dealing moderate damage and locking the enemy’s firing power to exactly 50% on their next turn.',
    trajectoryDesc: 'Super fast dart, zero wind susceptibility. Locks enemy power to 50%.',
    tintColor: '#a855f7', // Purple
    craterRadius: 15,
    damage: 20,
  },
  {
    id: 'indian_spy',
    name: '"Day 1 as an Indian Spy"',
    slogan: 'Ghar se nikalte hi, Border par pakde gaye! Blinding flash!',
    description: 'A sparkling flare launched high. On impact, it creates a blinding white flash of light, wiping out the enemy’s power slider, angle reader, and wind UI for exactly 2 turns.',
    trajectoryDesc: 'Sparkling high flare route. Completely blinds enemy UI for 2 turns.',
    tintColor: '#ffffff', // White
    craterRadius: 32,
    damage: 22,
  },
  {
    id: 'gadkari_highway',
    name: "Gadkari's 8-Lane Highway",
    slogan: 'Delhi to Mumbai in 12 minutes! Beautiful greenfield expressway.',
    description: 'Drops a heavy road-roller from your hull that rolls horizontally along the terrain. It converts and flattens all peaks and craters into a level grey asphalt highway.',
    trajectoryDesc: 'Heavy ground roller. Smooths and flattens half the maps into asphalt.',
    tintColor: '#4b5563', // Charcoal Gray
    craterRadius: 20, // flattening brush radius
    damage: 15,
  },
  {
    id: 'physics_wallah',
    name: "Physics Wallah's Revolution",
    slogan: 'REVOLUTIONNN! Hello Bachhoooo, study from anywhere!',
    description: 'Travels through the heavens in a high-amplitude double sine-wave loop. Detonates on impact to reverse local gravity in a radius, launching victim tanks skywards to take fall damage!',
    trajectoryDesc: 'Looping sine-wave arc. Detonates gravity reversal to launch tanks high.',
    tintColor: '#10b981', // Emerald Green
    craterRadius: 38,
    damage: 15, // Low impact damage + high falling physics damage
  },
  {
    id: 'dhruv_rathee',
    name: "Dhruv Rathee's Analysis Laser",
    slogan: 'Namaskar dosto, today we do structural analysis of your pocket.',
    description: 'A thin, focused scanning laser shot instantly at your barrel angle. Scans the enemy status and forcefully causes a secondary backfire detonation right in their own tank!',
    trajectoryDesc: 'Instant straight laser beam. Triggers direct backfire in enemy tank.',
    tintColor: '#22c55e', // Green laser
    craterRadius: 10,
    damage: 32,
  },
  {
    id: 'cheen_tapak',
    name: '"Cheen Tapak Dam Dam" Crater',
    slogan: 'Ancient spooky clay pot magic. Beeyom! Demolish.',
    description: 'Launches a magical, floaty skull-pot in light gravity. On impact, it opens a bottomless rectangular void directly beneath the enemy tank, hollowing out their structural foundations.',
    trajectoryDesc: 'Floaty low-gravity pot. carves a bottomless vertical pit under impact.',
    tintColor: '#f97316', // Orange
    craterRadius: 42,
    damage: 12,
  },
];
