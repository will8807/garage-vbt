let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx) sharedCtx = new Ctx();
  return sharedCtx;
}

export async function unlockAudio(): Promise<void> {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
}

function playOscillator(opts: {
  freq: number;
  durationMs: number;
  type?: OscillatorType;
  gain?: number;
  freqEnd?: number;
}): Promise<void> {
  return new Promise<void>((resolve) => {
    const ctx = getCtx();
    if (!ctx) return resolve();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq, ctx.currentTime);
    if (opts.freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, opts.freqEnd),
        ctx.currentTime + opts.durationMs / 1000,
      );
    }
    const peak = opts.gain ?? 0.25;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(peak, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + opts.durationMs / 1000,
    );
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + opts.durationMs / 1000);
    osc.onended = () => resolve();
  });
}

export const tones = {
  async positive(): Promise<void> {
    await playOscillator({ freq: 880, durationMs: 120, type: 'sine' });
  },
  async negative(): Promise<void> {
    await playOscillator({ freq: 220, durationMs: 180, type: 'square', gain: 0.18 });
  },
  async warn(): Promise<void> {
    await playOscillator({ freq: 440, durationMs: 80, type: 'triangle' });
    await new Promise((r) => setTimeout(r, 80));
    await playOscillator({ freq: 440, durationMs: 80, type: 'triangle' });
  },
  async stop(): Promise<void> {
    await playOscillator({
      freq: 660,
      freqEnd: 330,
      durationMs: 280,
      type: 'sawtooth',
      gain: 0.22,
    });
  },
  async buzz(): Promise<void> {
    await playOscillator({ freq: 110, durationMs: 100, type: 'sawtooth', gain: 0.15 });
  },
};
