// Retro sound synthesizer using native Web Audio API

let audioCtx: AudioContext | null = null;
let isSoundEnabled = true;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function toggleSound(forced?: boolean): boolean {
  if (forced !== undefined) {
    isSoundEnabled = forced;
  } else {
    isSoundEnabled = !isSoundEnabled;
  }
  return isSoundEnabled;
}

export function playSoundEnabled(): boolean {
  return isSoundEnabled;
}

/**
 * Fires a standard synth tank projectile launch sweeping upward.
 */
export function playSoundLaunch(): void {
  if (!isSoundEnabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(680, ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch (e) {
    console.warn('Audio launch trace error', e);
  }
}

/**
 * Deep rumble noise for explosions.
 */
export function playSoundExplode(heavy: boolean = false): void {
  if (!isSoundEnabled) return;
  try {
    const ctx = getAudioContext();
    
    // Create random white noise buffer
    const bufferSize = ctx.sampleRate * (heavy ? 0.6 : 0.35);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = buffer;

    // Filter to make it sound rumbling and deep
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(heavy ? 120 : 250, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + (heavy ? 0.6 : 0.35));

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(heavy ? 0.35 : 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (heavy ? 0.6 : 0.35));

    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noiseNode.start();
  } catch (e) {
    console.warn('Audio explosion trigger error', e);
  }
}

/**
 * High frequency sci-fi green laser zap.
 */
export function playSoundLaser(): void {
  if (!isSoundEnabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    console.warn('Audio laser error', e);
  }
}

/**
 * Melody blast arpeggio sounds, playful italian notes.
 */
export function playSoundMelody(): void {
  if (!isSoundEnabled) return;
  try {
    const ctx = getAudioContext();
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.08);
      
      gain.gain.setValueAtTime(0.0, ctx.currentTime + index * 0.08);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + index * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + index * 0.08 + 0.18);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + index * 0.08);
      osc.stop(ctx.currentTime + index * 0.08 + 0.2);
    });
  } catch (e) {
    console.warn('Audio melody arpeggio error', e);
  }
}

/**
 * Clean chess piece wooden tap double-click.
 */
export function playSoundChessClick(): void {
  if (!isSoundEnabled) return;
  try {
    const ctx = getAudioContext();
    
    // Tap 1
    let osc1 = ctx.createOscillator();
    let gain1 = ctx.createGain();
    osc1.frequency.setValueAtTime(350, ctx.currentTime);
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.05);

    // Tap 2 after 0.07 seconds
    setTimeout(() => {
      if (!isSoundEnabled) return;
      let osc2 = ctx.createOscillator();
      let gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(290, ctx.currentTime);
      gain2.gain.setValueAtTime(0.12, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.05);
    }, 70);
  } catch (e) {
    console.warn('Audio chess error', e);
  }
}

/**
 * Gravity reversal synth sweeping pitch upward.
 */
export function playSoundGravityReverse(): void {
  if (!isSoundEnabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 0.45);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.warn('Audio gravity reverse error', e);
  }
}
