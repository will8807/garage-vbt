import type { AudioFeedbackMode } from '../domain/types';
import type { DecisionEvent } from '../decision/events';

export type AudioAction =
  | { kind: 'speak_number'; value: number }
  | { kind: 'tone_positive' }
  | { kind: 'tone_negative' }
  | { kind: 'tone_warn' }
  | { kind: 'tone_stop' }
  | { kind: 'tone_buzz' };

const modeFlags: Record<AudioFeedbackMode, { speakNumbers: boolean; playTones: boolean }> = {
  count_and_tone: { speakNumbers: true, playTones: true },
  tone_only: { speakNumbers: false, playTones: true },
  count_only: { speakNumbers: true, playTones: false },
  muted: { speakNumbers: false, playTones: false },
};

export function mapEventToActions(
  event: DecisionEvent,
  mode: AudioFeedbackMode,
): AudioAction[] {
  const { speakNumbers, playTones } = modeFlags[mode];
  if (mode === 'muted') return [];

  switch (event.type) {
    case 'TRACKING_CONFIDENCE_LOW':
      return playTones ? [{ kind: 'tone_buzz' }] : [];

    case 'REP_COMPLETED':
      return speakNumbers ? [{ kind: 'speak_number', value: event.rep.index }] : [];

    case 'REP_IN_TARGET':
      return playTones ? [{ kind: 'tone_positive' }] : [];

    case 'REP_OUTSIDE_TARGET':
      return playTones ? [{ kind: 'tone_negative' }] : [];

    case 'VELOCITY_DROPOFF_WARNING':
      return playTones ? [{ kind: 'tone_warn' }] : [];

    case 'STOP_SET':
      // stop is loud enough to be useful even in count_only mode
      return [{ kind: 'tone_stop' }];

    case 'LOAD_RECOMMENDATION':
      return [];

    default:
      return [];
  }
}

export interface AudioFeedbackPlayer {
  play(action: AudioAction): Promise<void>;
  setMode(mode: AudioFeedbackMode): void;
  handleEvent(event: DecisionEvent): Promise<void>;
  unlock(): Promise<void>;
}

export interface AudioFeedbackPlayerOptions {
  mode?: AudioFeedbackMode;
  tones?: {
    positive: () => Promise<void> | void;
    negative: () => Promise<void> | void;
    warn: () => Promise<void> | void;
    stop: () => Promise<void> | void;
    buzz: () => Promise<void> | void;
  };
  speak?: (value: number) => Promise<void> | void;
  unlockAudio?: () => Promise<void> | void;
}

export function createAudioFeedbackPlayer(
  opts: AudioFeedbackPlayerOptions,
): AudioFeedbackPlayer {
  let mode: AudioFeedbackMode = opts.mode ?? 'count_and_tone';

  async function play(action: AudioAction): Promise<void> {
    switch (action.kind) {
      case 'speak_number':
        if (opts.speak) await opts.speak(action.value);
        return;
      case 'tone_positive':
        if (opts.tones) await opts.tones.positive();
        return;
      case 'tone_negative':
        if (opts.tones) await opts.tones.negative();
        return;
      case 'tone_warn':
        if (opts.tones) await opts.tones.warn();
        return;
      case 'tone_stop':
        if (opts.tones) await opts.tones.stop();
        return;
      case 'tone_buzz':
        if (opts.tones) await opts.tones.buzz();
        return;
    }
  }

  async function handleEvent(event: DecisionEvent): Promise<void> {
    const actions = mapEventToActions(event, mode);
    for (const action of actions) {
      await play(action);
    }
  }

  return {
    play,
    setMode(next) {
      mode = next;
    },
    handleEvent,
    async unlock() {
      if (opts.unlockAudio) await opts.unlockAudio();
    },
  };
}
