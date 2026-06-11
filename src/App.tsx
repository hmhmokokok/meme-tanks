import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Shield, Swords, HelpCircle, Flame, MessageSquare, Info, Users, Wifi, ArrowLeft, ArrowRight } from 'lucide-react';
import { WEAPONS } from './data';
import { TankState, Projectile, Particle, FloatingText, GamePhase, PlayMode, LocalPlayerRole } from './types';
import { generateTerrain, carveCrater, carveBottomlessVoid } from './lib/terrain';
import { buildInitialTanks, createDefaultAmmo, createMatchTerrain } from './lib/gameSetup';
import { moveTank, MAX_MOVES_PER_MATCH } from './lib/movement';
import { MultiplayerClient, MultiplayerMessage } from './lib/multiplayer';
import { 
  updatePhysicsTick, 
  handleTankFalling, 
  fireInstantDhruvRatheeLaser, 
  spawnExplosionParticles,
  addFloatingText
} from './lib/gameEngine';
import { 
  playSoundLaunch, 
  playSoundExplode, 
  playSoundLaser, 
  playSoundMelody, 
  playSoundChessClick, 
  playSoundGravityReverse,
  toggleSound,
  playSoundEnabled
} from './lib/audio';
import {
  createClouds,
  drawPocketTanksBackground,
  drawTerrain,
  drawPocketTank,
  drawWindArrow,
  type Cloud,
} from './lib/renderer';

import { CANVAS_WIDTH, CANVAS_HEIGHT } from './lib/constants';
const INITIAL_GRAVITY = 0.16;

export default function App() {
  // Game state
  const [phase, setPhase] = useState<GamePhase>('START_SCREEN');
  const [p1Name, setP1Name] = useState('PM Modi');
  const [p2Name, setP2Name] = useState('Dhruv Rathee');
  const [p1Color, setP1Color] = useState('#EAB308'); // Pocket Tanks yellow
  const [p2Color, setP2Color] = useState('#22C55E'); // Pocket Tanks green
  const [windLevel, setWindLevel] = useState<'none' | 'light' | 'normal' | 'gale'>('normal');

  // Interactive configurations mirroring into state for reactive UI rendering
  const [activePlayer, setActivePlayer] = useState<'p1' | 'p2'>('p1');
  const [p1Health, setP1Health] = useState(100);
  const [p2Health, setP2Health] = useState(100);
  const [p1Stock, setP1Stock] = useState<{ [id: string]: number }>({});
  const [p2Stock, setP2Stock] = useState<{ [id: string]: number }>({});
  
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>('bmc_metro');
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(55);
  const [windText, setWindText] = useState('Calm (0 km/h)');
  const [windSpeed, setWindSpeed] = useState(0);
  const [isFlying, setIsFlying] = useState(false);
  const [roundsPlayed, setRoundsPlayed] = useState(1);
  const [showGuide, setShowGuide] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  // Play mode & online
  const [playMode, setPlayMode] = useState<PlayMode>('offline');
  const [menuView, setMenuView] = useState<'pick' | 'offline' | 'online'>('pick');
  const [localRole, setLocalRole] = useState<LocalPlayerRole>('both');
  const [roomCode, setRoomCode] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [lobbyStatus, setLobbyStatus] = useState<'idle' | 'connecting' | 'waiting' | 'ready' | 'error'>('idle');
  const [onlineError, setOnlineError] = useState('');
  const [lobbyPlayers, setLobbyPlayers] = useState(0);
  const [p1MovesLeft, setP1MovesLeft] = useState(MAX_MOVES_PER_MATCH);
  const [p2MovesLeft, setP2MovesLeft] = useState(MAX_MOVES_PER_MATCH);
  const mpClientRef = useRef<MultiplayerClient | null>(null);
  const terrainSeedRef = useRef<number | undefined>(undefined);

  // Status effects
  const [p1Status, setP1Status] = useState({ melodyConfused: false, checkmateLocked: false, spyBlindedTurns: 0 });
  const [p2Status, setP2Status] = useState({ melodyConfused: false, checkmateLocked: false, spyBlindedTurns: 0 });

  // Refs for loop controls
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);

  // Core physics references kept in REF to enable hyper fluid 60FPS updates
  const gameRef = useRef<{
    terrainHeights: Float32Array;
    terrainTypes: Uint8Array; // 0 = Dirt, 1 = Nitin Gadkari Asphalt
    tanks: TankState[];
    projectiles: Projectile[];
    particles: Particle[];
    floatingTexts: FloatingText[];
  }>({
    terrainHeights: new Float32Array(CANVAS_WIDTH),
    terrainTypes: new Uint8Array(CANVAS_WIDTH),
    tanks: [],
    projectiles: [],
    particles: [],
    floatingTexts: []
  });

  // Sound handler
  const handleToggleSound = () => {
    const nextVal = toggleSound();
    setSoundOn(nextVal);
  };

  // Helper: triggers local wind speed randomization based on selected wind config
  const randomizeWind = () => {
    let maxWind = 0.22;
    if (windLevel === 'none') {
      gameRef.current.projectiles.length = 0; // wipe state
      setWindSpeed(0);
      setWindText('Calm 0 km/h');
      return;
    }
    if (windLevel === 'light') maxWind = 0.08;
    if (windLevel === 'gale') maxWind = 0.42;

    const currentSpeed = (Math.random() - 0.5) * maxWind;
    setWindSpeed(currentSpeed);

    const speedKmh = Math.abs(Math.round(currentSpeed * 120));
    const dir = currentSpeed > 0 ? 'East ➡️' : 'West ⬅️';
    setWindText(`${dir} ${speedKmh} km/h`);
  };

  /**
   * INITIATES THE CLASH
   */
  const startMatch = (seed?: number, onlineNames?: { p1: string; p2: string; p1c: string; p2c: string }) => {
    const matchSeed = seed ?? Math.floor(Math.random() * 1_000_000);
    terrainSeedRef.current = matchSeed;
    const terr = createMatchTerrain(CANVAS_WIDTH, CANVAS_HEIGHT, matchSeed);

    const names = onlineNames ?? {
      p1: p1Name,
      p2: p2Name,
      p1c: p1Color,
      p2c: p2Color,
    };

    const defaultAmmo = createDefaultAmmo();
    const tanks = buildInitialTanks(terr, {
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
      p1Name: names.p1,
      p2Name: names.p2,
      p1Color: names.p1c,
      p2Color: names.p2c,
      terrainSeed: matchSeed,
    });

    if (onlineNames) {
      setP1Name(names.p1);
      setP2Name(names.p2);
      setP1Color(names.p1c);
      setP2Color(names.p2c);
    }

    gameRef.current = {
      terrainHeights: terr.heights,
      terrainTypes: terr.types,
      tanks,
      projectiles: [],
      particles: [],
      floatingTexts: [],
    };

    setActivePlayer('p1');
    setP1Health(100);
    setP2Health(100);
    setP1Stock({ ...defaultAmmo });
    setP2Stock({ ...defaultAmmo });
    setP1MovesLeft(MAX_MOVES_PER_MATCH);
    setP2MovesLeft(MAX_MOVES_PER_MATCH);
    setAngle(45);
    setPower(60);
    setSelectedWeaponId(WEAPONS[0]?.id ?? 'bmc_metro');
    setRoundsPlayed(1);
    setPhase('PLAYING');
    setWinner(null);
    setP1Status({ melodyConfused: false, checkmateLocked: false, spyBlindedTurns: 0 });
    setP2Status({ melodyConfused: false, checkmateLocked: false, spyBlindedTurns: 0 });

    setTimeout(() => randomizeWind(), 50);
  };

  /**
   * RESET COMPLETELY BACK TO MENU
   */
  const resetToMenu = () => {
    mpClientRef.current?.disconnect();
    mpClientRef.current = null;
    setPhase('START_SCREEN');
    setMenuView('pick');
    setPlayMode('offline');
    setLocalRole('both');
    setRoomCode('');
    setJoinCodeInput('');
    setLobbyStatus('idle');
    setOnlineError('');
    setLobbyPlayers(0);
    setWinner(null);
    setIsFlying(false);
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
  };

  const canControl = playMode === 'offline' || localRole === activePlayer;

  const syncMoveCounts = () => {
    const t = gameRef.current.tanks;
    if (t[0]) setP1MovesLeft(t[0].movesRemaining);
    if (t[1]) setP2MovesLeft(t[1].movesRemaining);
  };

  const handleMultiplayerMessage = (msg: MultiplayerMessage) => {
    if (msg.type === 'room_created') {
      setRoomCode(msg.code);
      setLobbyStatus('waiting');
      setLobbyPlayers(1);
    } else if (msg.type === 'player_joined') {
      setLobbyPlayers(msg.players);
      if ('role' in msg && msg.role === 'guest') setLobbyStatus('ready');
    } else if (msg.type === 'lobby_ready') {
      setLobbyStatus('ready');
      setP1Name(msg.hostName);
      setP2Name(msg.guestName);
    } else if (msg.type === 'game_start') {
      if (localRole === 'p2') {
        setPlayMode('online');
        setWindLevel(msg.windLevel as typeof windLevel);
        startMatch(msg.seed, {
          p1: msg.p1Name,
          p2: msg.p2Name,
          p1c: msg.p1Color,
          p2c: msg.p2Color,
        });
      }
    } else if (msg.type === 'action_fire') {
      fireActiveWeapon(true, msg.weaponId, msg.angle, msg.power);
    } else if (msg.type === 'action_move') {
      moveActiveTank(msg.direction, true, msg.playerId);
    } else if (msg.type === 'turn_complete') {
      completeActiveTurn(true);
    } else if (msg.type === 'game_over') {
      setWinner(msg.winner);
      setPhase('GAME_OVER');
    } else if (msg.type === 'error') {
      setOnlineError(msg.message);
      setLobbyStatus('error');
    } else if (msg.type === 'peer_left') {
      setOnlineError('Opponent disconnected');
      setLobbyStatus('error');
    }
  };

  const createOnlineRoom = async () => {
    setOnlineError('');
    setLobbyStatus('connecting');
    setPlayMode('online');
    setLocalRole('p1');
    try {
      const client = new MultiplayerClient();
      await client.connect(handleMultiplayerMessage);
      mpClientRef.current = client;
      client.createRoom(p1Name, p1Color);
    } catch {
      setOnlineError('Could not connect. Run: npm run dev:server');
      setLobbyStatus('error');
    }
  };

  const joinOnlineRoom = async () => {
    setOnlineError('');
    setLobbyStatus('connecting');
    setPlayMode('online');
    setLocalRole('p2');
    try {
      const client = new MultiplayerClient();
      await client.connect(handleMultiplayerMessage);
      mpClientRef.current = client;
      client.joinRoom(joinCodeInput, p2Name, p2Color);
    } catch {
      setOnlineError('Could not connect. Run: npm run dev:server');
      setLobbyStatus('error');
    }
  };

  const startOnlineMatch = () => {
    const seed = Math.floor(Math.random() * 1_000_000);
    startMatch(seed, { p1: p1Name, p2: p2Name, p1c: p1Color, p2c: p2Color });
    mpClientRef.current?.startGame({
      seed,
      windLevel,
      p1Name,
      p2Name,
      p1Color,
      p2Color,
    });
  };

  const moveActiveTank = (
    direction: 'forward' | 'back',
    fromNetwork = false,
    playerId?: 'p1' | 'p2'
  ) => {
    if (phase !== 'PLAYING' || isFlying) return;
    const pid = playerId ?? activePlayer;
    if (!fromNetwork && !canControl) return;
    if (pid !== activePlayer) return;

    const tank = gameRef.current.tanks.find((t) => t.id === pid);
    if (!tank) return;

    const moved = moveTank(
      tank,
      direction,
      gameRef.current.terrainHeights,
      CANVAS_WIDTH
    );
    if (!moved) {
      addFloatingText(gameRef.current.floatingTexts, 'NO MOVES LEFT!', tank.x, tank.y - 20, '#ef4444');
      return;
    }

    syncMoveCounts();
    if (pid === 'p1') setP1Stock({ ...tank.weapons });
    else setP2Stock({ ...tank.weapons });

    if (!fromNetwork && playMode === 'online') {
      mpClientRef.current?.broadcastMove(pid, direction);
    }
  };

  /**
   * DYNAMIC FIRE MECHANICS
   */
  const fireActiveWeapon = (
    fromNetwork = false,
    weaponIdOverride?: string,
    angleOverride?: number,
    powerOverride?: number
  ) => {
    if (isFlying || phase !== 'PLAYING') return;
    if (!fromNetwork && !canControl) return;

    const tanks = gameRef.current.tanks;
    const activeTank = tanks.find((t) => t.id === activePlayer);
    const passiveTank = tanks.find((t) => t.id !== activePlayer);
    
    if (!activeTank || !passiveTank) return;

    const weaponId = weaponIdOverride ?? selectedWeaponId;
    const fireAngle = angleOverride ?? angle;
    const firePower = powerOverride ?? power;

    const currentAmmo = activeTank.weapons[weaponId] || 0;
    if (currentAmmo <= 0) {
      addFloatingText(gameRef.current.floatingTexts, 'OUT OF AMMO! CHOOSE ANOTHER', activeTank.x, activeTank.y - 25, '#ef4444');
      return;
    }

    activeTank.weapons[weaponId] = currentAmmo - 1;
    if (activePlayer === 'p1') {
      setP1Stock({ ...activeTank.weapons });
    } else {
      setP2Stock({ ...activeTank.weapons });
    }

    const angleRad = (fireAngle * Math.PI) / 180;
    const barrelLength = 22;
    const pivotY = activeTank.y - 18;
    const barrelEndX = activeTank.x + Math.cos(angleRad) * barrelLength;
    const barrelEndY = pivotY - Math.sin(angleRad) * barrelLength;

    // A: Special instant scan trigger for "Dhruv Rathee's Analysis Laser"
    if (weaponId === 'dhruv_rathee') {
      playSoundLaser();
      
      fireInstantDhruvRatheeLaser(
        activeTank,
        passiveTank,
        { heights: gameRef.current.terrainHeights, types: gameRef.current.terrainTypes },
        gameRef.current.particles,
        gameRef.current.floatingTexts,
        CANVAS_WIDTH,
        CANVAS_HEIGHT
      );

      // Instantly refresh health indicators
      setP1Health(tanks[0].health);
      setP2Health(tanks[1].health);

      // Trigger standard turn-advancer after a minute frame-draw delay
      setIsFlying(true);
      setTimeout(() => {
        completeActiveTurn();
      }, 1000);
      return;
    }

    // B: Standard ballistics
    let shootPowerFraction = firePower * 0.165;
    
    if (weaponId === 'modi_melody') playSoundMelody();
    else if (weaponId === 'samay_checkmate') playSoundChessClick();
    else if (weaponId === 'physics_wallah') playSoundGravityReverse();
    else playSoundLaunch();

    let customProjGrav: number | undefined = undefined;
    if (weaponId === 'cheen_tapak') {
      customProjGrav = INITIAL_GRAVITY * 0.42;
    } else if (weaponId === 'duniya_khatam') {
      customProjGrav = INITIAL_GRAVITY * 1.5;
    }

    gameRef.current.projectiles.push({
      id: 'proj_' + Math.random().toString(36).substring(2, 8),
      x: barrelEndX,
      y: barrelEndY,
      vx: Math.cos(angleRad) * shootPowerFraction,
      vy: -Math.sin(angleRad) * shootPowerFraction,
      weaponId: weaponId,
      ownerId: activePlayer,
      time: 0,
      startX: barrelEndX,
      startY: barrelEndY,
      customGravity: customProjGrav,
    });

    if (!fromNetwork && playMode === 'online') {
      mpClientRef.current?.broadcastFire(activePlayer, weaponId, fireAngle, firePower);
    }

    setIsFlying(true);
  };

  /**
   * CONCLUDES TURN TIMELINE & TRANSITIONS NEXT STEP
   */
  const completeActiveTurn = (fromNetwork = false) => {
    if (fromNetwork && playMode === 'online' && localRole === activePlayer) return;

    setIsFlying(false);

    // 1. Process health counters to check for sudden victory
    const tanks = gameRef.current.tanks;
    const p1 = tanks[0];
    const p2 = tanks[1];

    setP1Health(p1.health);
    setP2Health(p2.health);

    if (p1.health <= 0 || p2.health <= 0) {
      let winLabel: string;
      if (p1.health <= 0 && p2.health <= 0) winLabel = 'MUTUAL DESTRUCTION (DRAW)';
      else if (p1.health <= 0) winLabel = p2.name;
      else winLabel = p1.name;
      setPhase('GAME_OVER');
      setWinner(winLabel);
      if (!fromNetwork && playMode === 'online' && localRole === activePlayer) {
        mpClientRef.current?.broadcastGameOver(winLabel);
      }
      return;
    }

    // 2. End status effects for the player who just finished
    const justFinished = activePlayer;
    if (justFinished === 'p1' && p1.status.spyBlindedTurns > 0) {
      p1.status.spyBlindedTurns -= 1;
    } else if (justFinished === 'p2' && p2.status.spyBlindedTurns > 0) {
      p2.status.spyBlindedTurns -= 1;
    }

    // 3. Switch to next player
    const nextPlayer = justFinished === 'p1' ? 'p2' : 'p1';
    setActivePlayer(nextPlayer);

    const activeObj = tanks.find((t) => t.id === nextPlayer)!;

    // 4. Handle Melody Blast & Checkmate on the incoming turn
    if (activeObj.status.melodyConfused) {
      playSoundMelody();
      const wobble = Math.round((Math.random() - 0.5) * 24);
      let nextAng = activeObj.angle + wobble;
      if (nextAng < 0) nextAng = 0;
      if (nextAng > 180) nextAng = 180;
      activeObj.angle = nextAng;
      setAngle(Math.round(nextAng));
      addFloatingText(gameRef.current.floatingTexts, `MELODY DIZZY! AIM DRIFTED ±${Math.abs(wobble)}°`, activeObj.x, activeObj.y - 30, '#ec4899');
      activeObj.status.melodyConfused = false;
    }

    if (activeObj.status.checkmateLocked) {
      activeObj.power = 50;
      setPower(50);
      addFloatingText(gameRef.current.floatingTexts, 'POWER LOCK ACTIVE (50%)', activeObj.x, activeObj.y - 30, '#a855f7');
      activeObj.status.checkmateLocked = false;
    }

    // Keep React status in sync with gameRef (single source of truth)
    setP1Status({ ...p1.status });
    setP2Status({ ...p2.status });

    // 5. Update the controllers matching the next tank properties
    setAngle(Math.round(activeObj.angle));
    setPower(Math.round(activeObj.power));

    // Restore weapon selection fallback if the next user has no ammo of previously chosen weapon left
    const stockCheck = activeObj.weapons[selectedWeaponId] || 0;
    if (stockCheck <= 0) {
      // Choose first weapon with active inventory stock
      const firstValid = WEAPONS.find((w) => activeObj.weapons[w.id] > 0);
      if (firstValid) {
        setSelectedWeaponId(firstValid.id);
      }
    }

    syncMoveCounts();

    // 6. Spin new random wind speed
    randomizeWind();
    setRoundsPlayed((r) => r + 1);

    if (!fromNetwork && playMode === 'online' && localRole === activePlayer) {
      mpClientRef.current?.broadcastTurnComplete(activePlayer);
    }
  };

  /**
   * LISTENERS: KEYBOARD ARROW CONTROLS FOR ENRICHED DESKTOP COMFORT
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'PLAYING' || isFlying || !canControl) return;

      const activeObj = gameRef.current.tanks.find((t) => t.id === activePlayer);
      if (!activeObj) return;

      // Check current constraints
      const isBlinded = (activeObj.status.spyBlindedTurns ?? 0) > 0;
      const isCheckmated = activePlayer === 'p1' ? p1Status.checkmateLocked : p2Status.checkmateLocked;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setAngle((curr) => {
            const next = Math.min(180, curr + 1);
            activeObj.angle = next;
            return next;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setAngle((curr) => {
            const next = Math.max(0, curr - 1);
            activeObj.angle = next;
            return next;
          });
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (isCheckmated) break; // locked!
          setPower((curr) => {
            const next = Math.min(100, curr + 1);
            activeObj.power = next;
            return next;
          });
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (isCheckmated) break; // locked!
          setPower((curr) => {
            const next = Math.max(0, curr - 1);
            activeObj.power = next;
            return next;
          });
          break;
        case 'a':
        case 'A':
          e.preventDefault();
          moveActiveTank('back');
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          moveActiveTank('forward');
          break;
        case ' ': // Spacebar triggers fire
          e.preventDefault();
          fireActiveWeapon();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, isFlying, activePlayer, selectedWeaponId, angle, power, p1Status, p2Status, canControl, playMode]);

  /**
   * SYNCHRONIZE TURRET SETTINGS MANUALLY TO TANK OBJECTS FROM SLIDERS
   */
  const handleAngleSliderChange = (val: number) => {
    if (!canControl || isFlying) return;
    setAngle(val);
    const tank = gameRef.current.tanks.find((t) => t.id === activePlayer);
    if (tank) {
      tank.angle = val;
    }
  };

  const handlePowerSliderChange = (val: number) => {
    if (!canControl || isFlying) return;
    // block if samay checkmate triggers lock
    const isLocked = activePlayer === 'p1' ? p1Status.checkmateLocked : p2Status.checkmateLocked;
    if (isLocked) return;

    setPower(val);
    const tank = gameRef.current.tanks.find((t) => t.id === activePlayer);
    if (tank) {
      tank.power = val;
    }
  };

  /**
   * ANIMATOR LOOP - DRAWS STARLIGHTS, HEIGHTMAP CONTOURS, PROJECTILE TRAILS
   */
  useEffect(() => {
    if (phase !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set static canvas resolutions
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const clouds: Cloud[] = createClouds(CANVAS_WIDTH, CANVAS_HEIGHT);

    const drawLoop = () => {
      // 1. Physics Step Update
      const { shouldCheckFalls } = updatePhysicsTick(
        gameRef.current.projectiles,
        gameRef.current.particles,
        gameRef.current.floatingTexts,
        gameRef.current.tanks,
        { heights: gameRef.current.terrainHeights, types: gameRef.current.terrainTypes },
        windSpeed,
        INITIAL_GRAVITY,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        completeActiveTurn,
        activePlayer
      );

      // Handle dirt falling triggers
      if (shouldCheckFalls) {
        handleTankFalling(
          gameRef.current.tanks,
          { heights: gameRef.current.terrainHeights, types: gameRef.current.terrainTypes },
          gameRef.current.floatingTexts,
          CANVAS_HEIGHT
        );
      }

      // Check if projectle just finished flight
      if (isFlying && gameRef.current.projectiles.length === 0) {
        if (playMode === 'offline' || localRole === activePlayer) {
          completeActiveTurn();
        }
      }

      // 2. Pocket Tanks sky, sun, clouds & hills
      drawPocketTanksBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, clouds);
      drawWindArrow(ctx, CANVAS_WIDTH, windSpeed);

      // 3. Destructible terrain
      drawTerrain(
        ctx,
        gameRef.current.terrainHeights,
        gameRef.current.terrainTypes,
        CANVAS_WIDTH,
        CANVAS_HEIGHT
      );

      // 4. Projectiles — glossy shells
      gameRef.current.projectiles.forEach((p) => {
        let tColor = '#444444';
        const weaponObj = WEAPONS.find((w) => w.id === p.weaponId);
        if (weaponObj) tColor = weaponObj.tintColor;

        const radius = p.subType === 'cockroach' ? 3.5 : 5.5;

        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(p.x + 1.5, p.y + 2, radius, radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        const shellGrad = ctx.createRadialGradient(p.x - 1, p.y - 1, 0, p.x, p.y, radius);
        shellGrad.addColorStop(0, '#FFF');
        shellGrad.addColorStop(0.35, tColor);
        shellGrad.addColorStop(1, tColor);
        ctx.fillStyle = shellGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. Tanks
      gameRef.current.tanks.forEach((tank) => {
        const isSelfBlinded = tank.status.spyBlindedTurns > 0;
        if (isSelfBlinded) {
          ctx.globalAlpha = 0.45;
        }
        drawPocketTank(ctx, tank);
        ctx.globalAlpha = 1;

        if (tank.status.melodyConfused) {
          ctx.fillStyle = '#E91E63';
          ctx.font = '9px Tahoma, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('💫 DIZZY', tank.x, tank.y - 28);
        } else if (tank.status.checkmateLocked) {
          ctx.fillStyle = '#7B1FA2';
          ctx.font = '9px Tahoma, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('♟️ LOCK 50%', tank.x, tank.y - 28);
        } else if (tank.status.spyBlindedTurns > 0) {
          ctx.fillStyle = '#555';
          ctx.font = '9px Tahoma, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`🕵️ BLIND (${tank.status.spyBlindedTurns}T)`, tank.x, tank.y - 28);
        }
      });

      // 7. Draw Live Particle Effects
      gameRef.current.particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 1 - p.life / p.maxLife;
        ctx.beginPath();
        
        if (p.type === 'soundwave') {
          // Concentric radio rings
          ctx.arc(p.x, p.y, p.size * (1 + p.life * 0.2), 0, Math.PI * 2);
          ctx.strokeStyle = p.color;
          ctx.stroke();
        } else if (p.type === 'laser') {
          // Green rectangle beams
          ctx.rect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
          ctx.fill();
        } else {
          // Circular particle splatters
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1.0; // reset

      // 8. Draw Floating Popup Words (Fall damage warnings, power locks)
      gameRef.current.floatingTexts.forEach((t) => {
        ctx.fillStyle = t.color;
        ctx.font = 'bold 12px Tahoma, sans-serif';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 1 - t.life / t.maxLife;
        ctx.fillText(t.text, t.x, t.y);
      });
      ctx.globalAlpha = 1.0; // reset

      // Request next frame recursively
      requestRef.current = requestAnimationFrame(drawLoop);
    };

    // Begin looping
    requestRef.current = requestAnimationFrame(drawLoop);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [phase, windSpeed, isFlying, activePlayer]);

  // Handle active status check helpers
  const activeTankObj = gameRef.current.tanks.find((t) => t.id === activePlayer);
  const isCurrentlyBlinded = (() => {
    const tank = gameRef.current.tanks.find((t) => t.id === activePlayer);
    return (tank?.status.spyBlindedTurns ?? 0) > 0;
  })();
  const isCurrentlyPowerLocked = activePlayer === 'p1' ? p1Status.checkmateLocked : p2Status.checkmateLocked;
  const activeMovesLeft = activePlayer === 'p1' ? p1MovesLeft : p2MovesLeft;

  return (
    <div className="w-screen h-[100dvh] bg-[#4DA8E8] text-[#1A1A1A] flex flex-col font-sans selection:bg-[#316AC5] selection:text-white overflow-hidden">
      
      <div id="game-container" className="w-full h-full bg-gradient-to-b from-[#6EC4F5] to-[#4DA8E8] overflow-hidden flex flex-col relative">
        
        {/* GLOBAL HUD TOP BAR */}
        {phase === 'PLAYING' ? (
          <header className="h-11 sm:h-14 pt-titlebar px-2 sm:px-4 md:px-6 grid grid-cols-[1fr_auto_1fr] items-center shrink-0 z-20 gap-1 sm:gap-4">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <div className="w-9 h-9 pt-panel-inset shrink-0 overflow-hidden">
                <span className="w-full h-full flex items-center justify-center font-bold text-[#1A1A1A] text-xs" style={{ backgroundColor: p1Color }}>P1</span>
              </div>
              <div className="hidden sm:block min-w-0">
                <div className="text-[9px] uppercase text-white/80 font-bold leading-none">Player 1</div>
                <div className="text-sm font-bold text-white truncate">{p1Name}</div>
              </div>
              <div className="h-4 w-20 md:w-28 pt-panel-inset overflow-hidden relative shrink-0">
                <div className="h-full bg-[#43A047] transition-all duration-300" style={{ width: `${Math.max(0, p1Health)}%` }} />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-[#1A1A1A]">{p1Health}%</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <div className="pt-panel-inset px-4 py-1 flex items-center gap-2 min-w-[100px] justify-center">
                <span className="text-[8px] uppercase text-[#555] font-bold">Wind</span>
                <span className="text-sm font-bold text-[#1565C0]">{windSpeed >= 0 ? '→' : '←'}</span>
                <span className="text-sm font-bold text-[#333]">{Math.abs(Math.round(windSpeed * 120))}</span>
              </div>
              <div className="flex items-center pt-panel p-0.5">
                <button onClick={() => setShowGuide(!showGuide)} className="p-2.5 sm:p-1.5 text-[#333] hover:bg-[#B0B0B0] cursor-pointer touch-manipulation" title="Weapon Guide"><HelpCircle className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></button>
                <button onClick={handleToggleSound} className="p-2.5 sm:p-1.5 text-[#333] hover:bg-[#B0B0B0] cursor-pointer touch-manipulation" title="Toggle Sound">{soundOn ? <Volume2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#2E7D32]" /> : <VolumeX className="w-4 h-4 sm:w-3.5 sm:h-3.5" />}</button>
                <button onClick={resetToMenu} className="p-2.5 sm:p-1.5 text-[#333] hover:bg-[#FFCDD2] cursor-pointer touch-manipulation" title="Quit Match"><RotateCcw className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></button>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3 min-w-0 justify-end">
              <div className="h-4 w-20 md:w-28 pt-panel-inset overflow-hidden relative shrink-0">
                <div className="h-full bg-[#43A047] transition-all duration-300" style={{ width: `${Math.max(0, p2Health)}%` }} />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-[#1A1A1A]">{p2Health}%</span>
              </div>
              <div className="hidden sm:block text-right min-w-0">
                <div className="text-[9px] uppercase text-white/80 font-bold leading-none">Player 2</div>
                <div className="text-sm font-bold text-white truncate">{p2Name}</div>
              </div>
              <div className="w-9 h-9 pt-panel-inset shrink-0 overflow-hidden">
                <span className="w-full h-full flex items-center justify-center font-bold text-[#1A1A1A] text-xs" style={{ backgroundColor: p2Color }}>P2</span>
              </div>
            </div>
          </header>
        ) : (
          <header className="h-14 pt-titlebar px-6 flex items-center justify-between shrink-0 z-20">
            <div className="flex items-center gap-2.5">
              <div className="p-1 pt-panel-inset bg-[#FFD700]">
                <Swords className="w-4 h-4 text-[#1A1A1A]" />
              </div>
              <div>
                <h1 className="font-bold tracking-tight text-md text-white leading-none">
                  Meme Tanks
                </h1>
                <p className="text-[9px] text-white/70 uppercase tracking-wider mt-0.5">
                  Pocket Tanks Style • v1.0
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="text-xs flex items-center gap-1.5 pt-panel hover:bg-[#E0E0E0] text-[#333] font-medium py-1.5 px-3 transition cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Weapons
              </button>
              <button
                onClick={handleToggleSound}
                className="p-1.5 pt-panel hover:bg-[#E0E0E0] text-[#333] transition cursor-pointer"
                title="Toggle Sound"
              >
                {soundOn ? <Volume2 className="w-3.5 h-3.5 text-[#2E7D32]" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
            </div>
          </header>
        )}

      {/* RENDER PHASE: START SCREENS */}
      {phase === 'START_SCREEN' &&
        <main className="flex-1 overflow-y-auto px-6 py-6 md:py-10 flex flex-col items-center justify-center">
          
          <div className="text-center mb-6 max-w-xl">
            <span className="text-[10px] bg-white/90 text-[#316AC5] font-bold px-3 py-1 uppercase tracking-wider pt-panel-inset inline-block">
              🇮🇳 Meme Artillery • Pocket Tanks Style
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-3 text-white drop-shadow-md uppercase">
              Meme Tanks
            </h2>
            <p className="text-xs md:text-sm text-white/90 mt-2 leading-relaxed drop-shadow">
              Each weapon fires once per match. Move your tank forward or back up to 3 times!
            </p>
          </div>

          {menuView === 'pick' && (
            <div className="w-full max-w-md pt-panel p-1 shadow-lg">
              <div className="pt-panel-inset p-6 space-y-4">
                <h3 className="text-sm font-bold text-[#333] uppercase text-center">Choose Game Mode</h3>
                <button
                  onClick={() => { setPlayMode('offline'); setLocalRole('both'); setMenuView('offline'); }}
                  className="w-full py-4 pt-panel hover:bg-[#E8E8E8] flex items-center justify-center gap-3 cursor-pointer transition touch-manipulation min-h-[56px]"
                >
                  <Users className="w-6 h-6 text-[#316AC5]" />
                  <div className="text-left">
                    <div className="font-bold text-[#333]">Offline 2 Player</div>
                    <div className="text-[10px] text-[#666]">Pass & play on one device</div>
                  </div>
                </button>
                <button
                  onClick={() => { setMenuView('online'); setOnlineError(''); setLobbyStatus('idle'); }}
                  className="w-full py-4 pt-panel hover:bg-[#E8E8E8] flex items-center justify-center gap-3 cursor-pointer transition touch-manipulation min-h-[56px]"
                >
                  <Wifi className="w-6 h-6 text-[#316AC5]" />
                  <div className="text-left">
                    <div className="font-bold text-[#333]">Online Multiplayer</div>
                    <div className="text-[10px] text-[#666]">Play with a friend over the network</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {menuView === 'online' && (
            <div className="w-full max-w-md pt-panel p-1 shadow-lg">
              <div className="pt-panel-inset p-6 space-y-4">
                <button onClick={() => setMenuView('pick')} className="text-[10px] text-[#316AC5] font-bold cursor-pointer">← Back</button>
                <h3 className="text-sm font-bold text-[#333] uppercase text-center">Online Multiplayer</h3>
                    <p className="text-[10px] text-[#666] text-center">Online play works automatically when deployed. Local dev: run <code className="bg-[#DDD] px-1">npm run dev:server</code></p>

                {lobbyStatus === 'idle' || lobbyStatus === 'error' ? (
                  <>
                    <div>
                      <label className="block text-[10px] text-[#555] font-bold mb-1 uppercase">Your Name</label>
                      <input value={p1Name} onChange={(e) => setP1Name(e.target.value)} maxLength={18} className="w-full pt-panel-inset px-3 py-2 text-xs outline-none mb-3" />
                      <button onClick={createOnlineRoom} className="w-full py-2.5 bg-[#316AC5] hover:bg-[#2451A8] text-white font-bold text-xs uppercase rounded cursor-pointer mb-4">
                        Create Room (Host)
                      </button>
                    </div>
                    <div className="border-t border-[#999] pt-4">
                      <label className="block text-[10px] text-[#555] font-bold mb-1 uppercase">Join with Room Code</label>
                      <input value={p2Name} onChange={(e) => setP2Name(e.target.value)} maxLength={18} placeholder="Your name" className="w-full pt-panel-inset px-3 py-2 text-xs outline-none mb-2" />
                      <input value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())} maxLength={4} placeholder="ABCD" className="w-full pt-panel-inset px-3 py-2 text-xs outline-none mb-2 uppercase tracking-widest text-center font-bold" />
                      <button onClick={joinOnlineRoom} className="w-full py-2.5 bg-[#43A047] hover:bg-[#2E7D32] text-white font-bold text-xs uppercase rounded cursor-pointer">
                        Join Room
                      </button>
                    </div>
                  </>
                ) : lobbyStatus === 'connecting' ? (
                  <p className="text-center text-sm text-[#555]">Connecting...</p>
                ) : lobbyStatus === 'waiting' ? (
                  <div className="text-center space-y-3">
                    <p className="text-[10px] uppercase text-[#555] font-bold">Room Code</p>
                    <p className="text-3xl font-bold tracking-[0.3em] text-[#316AC5]">{roomCode}</p>
                    <p className="text-xs text-[#666]">Share this code with your friend. Waiting for opponent...</p>
                    {lobbyPlayers >= 2 && localRole === 'p1' && (
                      <button onClick={startOnlineMatch} className="w-full py-2.5 bg-[#316AC5] text-white font-bold text-xs uppercase rounded cursor-pointer mt-2">
                        Start Game
                      </button>
                    )}
                  </div>
                ) : lobbyStatus === 'ready' ? (
                  <div className="text-center space-y-3">
                    <p className="text-sm font-bold text-[#43A047]">Opponent connected!</p>
                    {localRole === 'p1' ? (
                      <button onClick={startOnlineMatch} className="w-full py-2.5 bg-[#316AC5] text-white font-bold text-xs uppercase rounded cursor-pointer">
                        Start Game
                      </button>
                    ) : (
                      <p className="text-xs text-[#666]">Waiting for host to start...</p>
                    )}
                  </div>
                ) : null}

                {onlineError && <p className="text-[10px] text-red-600 text-center font-bold">{onlineError}</p>}
              </div>
            </div>
          )}

          {menuView === 'offline' && (
          <div className="w-full max-w-2xl pt-panel p-1 shadow-lg relative">
            <div className="pt-panel-inset p-6 md:p-8">
            <button onClick={() => setMenuView('pick')} className="text-[10px] text-[#316AC5] font-bold cursor-pointer mb-4">← Back</button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#808080]">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: p1Color }} />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#333]">
                    Player 1 (Yellow Tank)
                  </h3>
                </div>
                
                <div>
                  <label className="block text-[10px] text-[#555] font-bold mb-1 uppercase">
                    Tank Name:
                  </label>
                  <input
                    type="text"
                    maxLength={18}
                    value={p1Name}
                    onChange={(e) => setP1Name(e.target.value)}
                    className="w-full pt-panel-inset text-[#1A1A1A] px-3 py-2 text-xs outline-none"
                    placeholder="e.g. PM Modi"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[#555] font-bold mb-1.5 uppercase">
                    Tank Color:
                  </label>
                  <div className="flex gap-2">
                    {[ '#EAB308', '#FFD700', '#EF4444', '#F97316' ].map((c) => (
                      <button
                        key={c}
                        onClick={() => setP1Color(c)}
                        className={`w-7 h-7 border-2 transition cursor-pointer ${p1Color === c ? 'border-[#316AC5] scale-110' : 'border-[#808080] opacity-70 hover:opacity-100'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#808080]">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: p2Color }} />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#333]">
                    Player 2 (Green Tank)
                  </h3>
                </div>

                <div>
                  <label className="block text-[10px] text-[#555] font-bold mb-1 uppercase">
                    Tank Name:
                  </label>
                  <input
                    type="text"
                    className="w-full pt-panel-inset text-[#1A1A1A] px-3 py-2 text-xs outline-none"
                    maxLength={18}
                    value={p2Name}
                    onChange={(e) => setP2Name(e.target.value)}
                    placeholder="e.g. Dhruv Rathee"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[#555] font-bold mb-1.5 uppercase">
                    Tank Color:
                  </label>
                  <div className="flex gap-2">
                    {[ '#22C55E', '#16A34A', '#3B82F6', '#8B5CF6' ].map((c) => (
                      <button
                        key={c}
                        onClick={() => setP2Color(c)}
                        className={`w-7 h-7 border-2 transition cursor-pointer ${p2Color === c ? 'border-[#316AC5] scale-110' : 'border-[#808080] opacity-70 hover:opacity-100'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#808080] mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-[10px] text-[#555] font-bold uppercase">
                  Wind:
                </span>
                <div className="flex pt-panel-inset p-0.5 w-full sm:w-auto">
                  {(['none', 'light', 'normal', 'gale'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setWindLevel(lvl)}
                      className={`text-[9px] uppercase py-1.5 px-3 transition duration-150 cursor-pointer ${windLevel === lvl ? 'bg-[#316AC5] text-white font-bold' : 'text-[#555] hover:bg-[#D0D0D0]'}`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => startMatch()}
                className="w-full sm:w-auto bg-[#316AC5] hover:bg-[#2451A8] active:bg-[#1A3A7A] text-white font-bold py-2.5 px-8 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer text-xs rounded shadow-[0_3px_0_#1A3A7A,0_4px_8px_rgba(0,0,0,0.25)] hover:shadow-[0_2px_0_#1A3A7A] active:shadow-[0_1px_0_#1A3A7A] active:translate-y-[2px] transition-all border-2 border-[#2451A8]"
              >
                <Play className="w-4 h-4 fill-white" />
                Start Game
              </button>
            </div>
            </div>
          </div>
          )}

          <div className="mt-6 text-center text-[10px] text-white/80 max-w-md drop-shadow px-2">
            <span className="hidden sm:inline"><span className="font-bold">↑/↓</span> aim • <span className="font-bold">←/→</span> power • <span className="font-bold">A/D</span> move • <span className="font-bold">Space</span> fire</span>
            <span className="sm:hidden">Use on-screen sliders &amp; buttons to aim, move, and fire</span>
          </div>

        </main>
      }

      {/* DETAILED WEAPONS GUIDE OVERLAY MODAL */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="pt-panel w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl p-1">
            <div className="pt-titlebar p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-white" />
                <h3 className="font-bold text-sm text-white uppercase">
                  Weapon Arsenal
                </h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="text-white hover:bg-white/20 font-bold text-xs w-7 h-7 flex items-center justify-center cursor-pointer pt-panel-inset"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2 pt-panel-inset m-1 custom-scrollbar">
              {WEAPONS.map((w) => (
                <div key={w.id} className="p-3 pt-panel flex gap-3">
                  <div className="w-2 shrink-0" style={{ backgroundColor: w.tintColor }} />
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <h4 className="font-bold text-xs text-[#1A1A1A]">{w.name}</h4>
                      <span className="text-[8px] px-1.5 py-0.5 pt-panel-inset text-[#555]">
                        {w.trajectoryDesc}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#B45309] italic">"{w.slogan}"</p>
                    <p className="text-[10px] text-[#555] leading-normal">{w.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* PLAYING PHASE MAIN GAMEPLAY GRAPHICS WINDOW & CONTROL CONSOLE */}
      {phase === 'PLAYING' &&
        <div className="flex-1 flex flex-col min-h-0">
          
          <div className="flex-1 flex items-center justify-center p-1 sm:p-2 min-h-[24vh] lg:min-h-0">
            <div className="pt-panel p-0.5 sm:p-1 w-full max-w-[1200px] mx-auto">
              <canvas
                ref={canvasRef}
                className="w-full h-auto block touch-none"
                style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
                id="game-canvas"
              />
            </div>
          </div>

          <div id="control-drawer" className="shrink-0 px-1 sm:px-2 pb-1 sm:pb-2 max-h-[52dvh] lg:max-h-none overflow-y-auto">
            <div className="pt-panel p-1 max-w-[1200px] mx-auto">
              <div className="pt-panel-inset p-2 sm:p-3 grid grid-cols-1 lg:grid-cols-[220px_1fr_190px] gap-2 sm:gap-3 lg:min-h-[200px]">
            
            <div id="group-weapons" className="flex flex-col min-h-0 order-2 lg:order-none">
              <div className="text-[9px] uppercase text-[#555] font-bold bg-[#C8C8C8] px-2 py-1 mb-2 text-center border border-[#999]">Weapons</div>
              <div className="flex lg:grid lg:grid-cols-2 gap-1.5 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden flex-1 custom-scrollbar weapon-scroll-x lg:content-start pb-1 lg:pb-0">
                {WEAPONS.map((w) => {
                  const currentStock = activePlayer === 'p1' ? p1Stock[w.id] : p2Stock[w.id];
                  const outOfAmmo = (currentStock || 0) <= 0;
                  const isSelected = selectedWeaponId === w.id;

                  return (
                    <button
                      key={w.id}
                      id={`weapon-btn-${w.id}`}
                      onClick={() => setSelectedWeaponId(w.id)}
                      disabled={isFlying || outOfAmmo || !canControl}
                      className={`p-2 sm:p-1.5 text-[10px] sm:text-[9px] text-left cursor-pointer transition flex items-center justify-between gap-1 h-10 sm:h-8 min-w-[130px] lg:min-w-0 shrink-0 lg:shrink touch-manipulation ${isSelected ? 'bg-[#316AC5] text-white font-bold pt-panel-inset' : 'pt-panel hover:bg-[#E8E8E8] text-[#333]'} disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      <div className="flex items-center space-x-1 truncate">
                        <div className="w-2 h-2 shrink-0 border border-[#666]" style={{ backgroundColor: w.tintColor }} />
                        <span className="truncate">{w.name}</span>
                      </div>
                      <span className="text-[8px] px-1 font-bold bg-[#FFD700] text-[#333] shrink-0 min-w-[14px] text-center">
                        {currentStock || 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div id="group-instruments" className="flex flex-col justify-center border-y lg:border-y-0 lg:border-x border-[#999] px-1 sm:px-2 lg:px-4 order-1 lg:order-none">
              {!isFlying && (
                <div className="text-[9px] uppercase text-center text-[#555] font-bold mb-2 pb-1 border-b border-[#BBB]">
                  <span className="inline-block w-2 h-2 mr-1 align-middle" style={{ backgroundColor: activePlayer === 'p1' ? p1Color : p2Color }} />
                  Turn: <span className="text-[#316AC5]">{activePlayer === 'p1' ? p1Name : p2Name}</span>
                  {playMode === 'online' && !canControl && (
                    <span className="block text-[8px] text-[#888] normal-case mt-0.5">Waiting for opponent...</span>
                  )}
                </div>
              )}
              {!canControl && playMode === 'online' && !isFlying && (
                <div className="text-center text-xs text-[#666] py-8">Opponent&apos;s turn — watch the battle!</div>
              )}
              {isFlying && canControl && (
                <div className="text-[9px] uppercase text-center text-[#E65100] font-bold mb-2">🎯 Projectile in flight...</div>
              )}
              {canControl && isCurrentlyBlinded ? (
                <div id="blinded-telemetry-warning" className="flex items-center justify-between h-full pt-panel-inset p-3">
                  <div className="space-y-1 pr-4">
                    <div className="text-[10px] text-[#C62828] uppercase font-bold">⚠️ Sensors Blinded</div>
                    <p className="text-[10px] text-[#555] leading-tight">
                      Offline for {(() => {
                        const t = gameRef.current.tanks.find((t) => t.id === activePlayer);
                        return t?.status.spyBlindedTurns ?? 0;
                      })()} more turn(s)!
                    </p>
                  </div>
                  <button
                    onClick={fireActiveWeapon}
                    disabled={isFlying}
                    id="fire-btn-blinded"
                    className="w-24 h-24 sm:w-20 sm:h-20 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 shadow-[0_4px_0_#991B1B,0_6px_12px_rgba(0,0,0,0.3)] hover:shadow-[0_2px_0_#991B1B,0_4px_8px_rgba(0,0,0,0.25)] active:shadow-[0_1px_0_#991B1B] active:translate-y-[3px] flex flex-col items-center justify-center transition-all cursor-pointer text-white shrink-0 font-bold text-sm disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 touch-manipulation"
                  >
                    <span>FIRE</span>
                    <span className="text-[7px] opacity-80">BLIND</span>
                  </button>
                </div>
              ) : canControl ? (
                <div className="space-y-2 w-full">
                <div className="flex items-center justify-center gap-2 pt-panel-inset py-2 px-2">
                  <span className="text-[10px] sm:text-[9px] font-bold text-[#333] uppercase shrink-0">Move ({activeMovesLeft})</span>
                  <button
                    onClick={() => moveActiveTank('back')}
                    disabled={isFlying || activeMovesLeft <= 0}
                    className="flex items-center gap-1 px-4 py-2.5 sm:px-2 sm:py-1 pt-panel text-[10px] sm:text-[9px] font-bold cursor-pointer disabled:opacity-30 touch-manipulation min-h-11"
                    title="Move back (A)"
                  >
                    <ArrowLeft className="w-4 h-4 sm:w-3 sm:h-3" /> Back
                  </button>
                  <button
                    onClick={() => moveActiveTank('forward')}
                    disabled={isFlying || activeMovesLeft <= 0}
                    className="flex items-center gap-1 px-4 py-2.5 sm:px-2 sm:py-1 pt-panel text-[10px] sm:text-[9px] font-bold cursor-pointer disabled:opacity-30 touch-manipulation min-h-11"
                    title="Move forward (D)"
                  >
                    Fwd <ArrowRight className="w-4 h-4 sm:w-3 sm:h-3" />
                  </button>
                </div>
                <div className="flex flex-col sm:grid sm:grid-cols-[1fr_1fr_auto] items-stretch sm:items-center gap-2 sm:gap-3 w-full">
                  
                  <div id="aim-dial-box" className="flex items-center gap-2 pt-panel-inset px-2 py-2">
                    <div className="relative w-12 h-12 shrink-0 pt-panel flex items-center justify-center bg-white mx-auto">
                      <div className="absolute w-0.5 h-5 bg-[#E65100] origin-bottom" style={{ transform: `rotate(${angle - 90}deg)`, bottom: '50%' }} />
                      <span className="absolute text-[9px] font-bold text-[#E65100]">{angle}°</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-[9px] text-[#333] font-bold uppercase">Angle</span>
                        <span className="text-[8px] text-[#888]">↑↓</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleAngleSliderChange(Math.max(0, angle - 5))} disabled={isFlying} className="text-sm sm:text-[8px] pt-panel w-10 h-10 sm:w-5 sm:h-5 font-bold cursor-pointer disabled:opacity-25 touch-manipulation">-</button>
                        <input type="range" min={0} max={180} value={angle} disabled={isFlying} onChange={(e) => handleAngleSliderChange(Number(e.target.value))} className="flex-1 mobile-range accent-[#E65100] min-w-0 lg:h-1.5" />
                        <button onClick={() => handleAngleSliderChange(Math.min(180, angle + 5))} disabled={isFlying} className="text-sm sm:text-[8px] pt-panel w-10 h-10 sm:w-5 sm:h-5 font-bold cursor-pointer disabled:opacity-25 touch-manipulation">+</button>
                      </div>
                    </div>
                  </div>

                  <div id="power-dial-box" className="flex items-center gap-2 pt-panel-inset px-2 py-2">
                    <div className="relative w-12 h-12 shrink-0 pt-panel flex items-center justify-center bg-white">
                      <svg className="w-10 h-10 -rotate-90">
                        <circle cx="20" cy="20" r="15" stroke="#DDD" strokeWidth="3" fill="transparent" />
                        <circle cx="20" cy="20" r="15" stroke={isCurrentlyPowerLocked ? '#7B1FA2' : '#1565C0'} strokeWidth="3" fill="transparent" strokeDasharray={2 * Math.PI * 15} strokeDashoffset={2 * Math.PI * 15 * (1 - power / 100)} />
                      </svg>
                      <span className="absolute text-[9px] font-bold text-[#1565C0]">{power}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-[9px] text-[#333] font-bold uppercase">Power</span>
                        <span className="text-[8px] text-[#888]">←→</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handlePowerSliderChange(Math.max(2, power - 10))} disabled={isFlying || isCurrentlyPowerLocked} className="text-sm sm:text-[8px] pt-panel w-10 h-10 sm:w-5 sm:h-5 font-bold cursor-pointer disabled:opacity-25 touch-manipulation">-</button>
                        <input type="range" min={2} max={100} value={power} disabled={isFlying || isCurrentlyPowerLocked} onChange={(e) => handlePowerSliderChange(Number(e.target.value))} className="flex-1 mobile-range accent-[#1565C0] min-w-0 disabled:opacity-30 lg:h-1.5" />
                        <button onClick={() => handlePowerSliderChange(Math.min(100, power + 10))} disabled={isFlying || isCurrentlyPowerLocked} className="text-sm sm:text-[8px] pt-panel w-10 h-10 sm:w-5 sm:h-5 font-bold cursor-pointer disabled:opacity-25 touch-manipulation">+</button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={fireActiveWeapon}
                    disabled={isFlying}
                    id="fire-btn-playing"
                    className="w-[88px] h-[88px] sm:w-[76px] sm:h-[76px] mx-auto sm:mx-0 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 shadow-[0_4px_0_#991B1B,0_6px_14px_rgba(0,0,0,0.35)] hover:shadow-[0_2px_0_#991B1B,0_4px_10px_rgba(0,0,0,0.3)] active:shadow-[0_1px_0_#991B1B] active:translate-y-[3px] flex flex-col items-center justify-center transition-all cursor-pointer text-white shrink-0 font-bold disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 justify-self-center border-2 border-red-800 touch-manipulation"
                  >
                    <span className="text-lg sm:text-base tracking-wide">FIRE</span>
                    <span className="text-[8px] sm:text-[7px] opacity-80 uppercase">{isFlying ? 'Wait' : 'Tap'}</span>
                  </button>
                </div>
                </div>
              ) : null}
            </div>

            {(() => {
              const weapon = WEAPONS.find((w) => w.id === selectedWeaponId);
              if (!weapon) return (
                <div id="no-weapon-intel" className="hidden md:flex pt-panel-inset p-3 flex-col text-center justify-center text-[10px] text-[#888] italic min-h-[160px] order-3 lg:order-none">
                  Select a weapon.
                </div>
              );

              return (
                <div id="weapon-intel-card" className="hidden md:flex pt-panel-inset p-3 flex-col justify-between min-h-[160px] order-3 lg:order-none">
                  <div>
                    <div className="text-[8px] text-[#316AC5] font-bold uppercase mb-1 text-center border-b border-[#CCC] pb-1">Selected</div>
                    <div className="text-[11px] font-bold text-[#1A1A1A] truncate mt-1">{weapon.name}</div>
                    <div className="text-[9px] text-[#B45309] italic line-clamp-2 mt-1">"{weapon.slogan}"</div>
                    <p className="text-[9px] text-[#555] leading-snug mt-2 line-clamp-3">{weapon.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-center mt-2">
                    <div className="pt-panel py-1">
                      <div className="text-[7px] text-[#888] uppercase">Radius</div>
                      <div className="text-[9px] font-bold text-[#E65100]">{weapon.craterRadius > 50 ? 'Huge' : weapon.craterRadius > 25 ? 'Wide' : 'Normal'}</div>
                    </div>
                    <div className="pt-panel py-1">
                      <div className="text-[7px] text-[#888] uppercase">Damage</div>
                      <div className="text-[9px] font-bold text-[#1565C0]">{weapon.damage}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

              </div>
            </div>
          </div>

        </div>
      }

      {/* RENDER PHASE: GAME OVER SUMMARY SCREEN */}
      {phase === 'GAME_OVER' &&
        <main className="flex-1 max-w-lg mx-auto w-full px-6 py-12 flex flex-col items-center justify-center">
          
          <div id="game-over-box" className="pt-panel p-1 w-full shadow-lg">
            <div className="pt-panel-inset p-8 text-center space-y-6">
            <div className="pt-titlebar -mx-8 -mt-8 px-8 py-3 mb-4">
              <span className="text-sm text-white font-bold uppercase">Game Over</span>
            </div>
            
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-[#1A1A1A] uppercase">
                {winner === 'MUTUAL DESTRUCTION (DRAW)' ? 'Draw!' : 'Victory!'}
              </h2>
            </div>

            <div className="py-4 px-4 pt-panel bg-[#FFD700]/20 inline-block w-full">
              <span className="text-[9px] text-[#555] uppercase font-bold block">Winner</span>
              <span className="text-xl font-bold text-[#C62828] uppercase block mt-1">
                🏆 {winner}
              </span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => startMatch(terrainSeedRef.current)}
                id="btn-rematch"
                className="flex-1 bg-[#E53935] hover:bg-[#C62828] text-white font-bold py-2.5 px-5 transition uppercase cursor-pointer text-xs pt-panel border-[#FF6659]"
              >
                Rematch
              </button>
              <button
                onClick={resetToMenu}
                id="btn-to-menu"
                className="flex-1 pt-panel hover:bg-[#E8E8E8] text-[#333] font-bold py-2.5 px-5 transition uppercase cursor-pointer text-xs"
              >
                Main Menu
              </button>
            </div>
            </div>
          </div>

        </main>
      }

      <footer className="h-7 pt-panel flex items-center justify-center text-[9px] text-[#555] shrink-0 mx-1 mb-1">
        Meme Tanks — Pocket Tanks inspired • Pass & Play • v1.0
      </footer>

      </div>
    </div>
  );
}
