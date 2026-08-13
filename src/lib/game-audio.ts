export type GameAudioCue =
  | "jump"
  | "land"
  | "verse"
  | "hit"
  | "pickup"
  | "checkpoint"
  | "boss-enter"
  | "boss-hit"
  | "complete"
  | "game-over";

type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const MASTER_LEVEL = 0.34;

function getAudioContextConstructor() {
  if (typeof window === "undefined") return null;
  const audioWindow = window as AudioContextWindow;
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

/** Original procedural sound design. No published recording is loaded or sampled. */
export class GameAudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private transientSources = new Set<AudioScheduledSourceNode>();
  private suspendTimer: number | null = null;
  private enabled = true;
  private playing = false;
  private disposed = false;

  begin() {
    if (!this.activate()) return false;
    this.stopTransientSources();
    this.playing = true;
    this.rampAmbience(1, 0.5);
    this.playChord([73.42, 110, 146.83], 0.08, 0.46, "triangle");
    return true;
  }

  pause() {
    if (!this.context || !this.playing) return;
    this.stopTransientSources();
    this.playing = false;
    this.rampAmbience(0, 0.16);
    this.playTone(196, 92, "triangle", 0, 0.24, 0.055);
    this.queueSuspend(360);
  }

  resume() {
    if (!this.activate()) return false;
    this.stopTransientSources();
    this.playing = true;
    this.rampAmbience(1, 0.28);
    this.playTone(110, 220, "sine", 0, 0.28, 0.055);
    this.playTone(220, 330, "triangle", 0.07, 0.24, 0.035);
    return true;
  }

  finish(success: boolean) {
    this.stopTransientSources();
    this.playing = false;
    this.rampAmbience(0, 0.7);
    if (!this.context || !this.enabled) return;

    if (success) {
      [220, 329.63, 440, 659.25].forEach((frequency, index) => {
        this.playTone(frequency, frequency * 1.01, "sine", index * 0.15, 0.58, 0.062);
      });
    } else {
      [146.83, 123.47, 92.5, 65.41].forEach((frequency, index) => {
        this.playTone(frequency, frequency * 0.96, "triangle", index * 0.13, 0.6, 0.052);
      });
    }
    this.queueSuspend(1_500);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopTransientSources();
      this.rampMaster(0, 0.08);
      this.queueSuspend(160);
      return true;
    }

    const available = Boolean(
      !this.disposed &&
        ((this.context && this.context.state !== "closed") || getAudioContextConstructor()),
    );
    if (available && this.playing) this.activate();
    return available;
  }

  playCue(cue: GameAudioCue) {
    if (!this.canPlay()) return;

    switch (cue) {
      case "jump":
        this.playTone(130.81, 392, "square", 0, 0.14, 0.034);
        this.playNoiseBurst(980, 0.08, 0.025);
        break;
      case "land":
        this.playNoiseBurst(145, 0.1, 0.065);
        this.playTone(82.41, 61.74, "triangle", 0, 0.1, 0.04);
        break;
      case "verse":
        this.playTone(659.25, 1_318.51, "square", 0, 0.09, 0.028);
        this.playNoiseBurst(1_650, 0.055, 0.018);
        break;
      case "hit":
        this.playNoiseBurst(185, 0.26, 0.11);
        this.playTone(116.54, 43.65, "sawtooth", 0, 0.3, 0.07);
        break;
      case "pickup":
        this.playChord([440, 659.25, 880], 0.055, 0.28, "sine");
        break;
      case "checkpoint":
        this.playChord([146.83, 220, 293.66, 440], 0.09, 0.48, "triangle");
        break;
      case "boss-enter":
        this.playNoiseBurst(82, 0.62, 0.095);
        this.playTone(55, 46.25, "sawtooth", 0, 0.72, 0.085);
        this.playTone(73.42, 55, "square", 0.18, 0.58, 0.035);
        break;
      case "boss-hit":
        this.playNoiseBurst(410, 0.18, 0.08);
        this.playTone(220, 880, "square", 0, 0.16, 0.036);
        break;
      case "complete":
        this.finish(true);
        break;
      case "game-over":
        this.finish(false);
        break;
    }
  }

  dispose() {
    this.disposed = true;
    this.clearSuspendTimer();
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // A Web Audio source may already have ended.
      }
    }
    this.sources = [];
    this.stopTransientSources();

    const context = this.context;
    this.context = null;
    this.masterGain = null;
    this.ambienceGain = null;
    this.noiseBuffer = null;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }

  private activate() {
    if (this.disposed || !this.enabled || !this.ensureContext()) return false;
    this.clearSuspendTimer();
    const context = this.context;
    if (!context) return false;
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    this.rampMaster(MASTER_LEVEL, 0.07);
    return true;
  }

  private ensureContext() {
    if (this.context && this.context.state !== "closed") return true;
    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) return false;

    try {
      const context = new AudioContextConstructor();
      const masterGain = context.createGain();
      const ambienceGain = context.createGain();
      const limiter = context.createDynamicsCompressor();

      masterGain.gain.value = 0;
      ambienceGain.gain.value = 0;
      limiter.threshold.value = -20;
      limiter.knee.value = 8;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.22;
      ambienceGain.connect(masterGain);
      masterGain.connect(limiter).connect(context.destination);

      this.context = context;
      this.masterGain = masterGain;
      this.ambienceGain = ambienceGain;
      this.noiseBuffer = this.createNoiseBuffer(context, 2);
      this.createAmbience(context, ambienceGain);
      return true;
    } catch {
      this.context = null;
      this.masterGain = null;
      this.ambienceGain = null;
      this.noiseBuffer = null;
      return false;
    }
  }

  private createAmbience(context: AudioContext, destination: AudioNode) {
    const droneFilter = context.createBiquadFilter();
    const droneGain = context.createGain();
    const lowDrone = context.createOscillator();
    const highDrone = context.createOscillator();
    const pulse = context.createOscillator();
    const pulseDepth = context.createGain();
    const air = context.createBufferSource();
    const airFilter = context.createBiquadFilter();
    const airGain = context.createGain();

    lowDrone.type = "sine";
    lowDrone.frequency.value = 46.25;
    highDrone.type = "triangle";
    highDrone.frequency.value = 69.3;
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 180;
    droneFilter.Q.value = 0.7;
    droneGain.gain.value = 0.04;

    pulse.type = "sine";
    pulse.frequency.value = 0.13;
    pulseDepth.gain.value = 0.009;
    pulse.connect(pulseDepth).connect(droneGain.gain);
    lowDrone.connect(droneFilter);
    highDrone.connect(droneFilter);
    droneFilter.connect(droneGain).connect(destination);

    air.buffer = this.noiseBuffer;
    air.loop = true;
    airFilter.type = "bandpass";
    airFilter.frequency.value = 480;
    airFilter.Q.value = 0.48;
    airGain.gain.value = 0.011;
    air.connect(airFilter).connect(airGain).connect(destination);

    lowDrone.start();
    highDrone.start();
    pulse.start();
    air.start();
    this.sources.push(lowDrone, highDrone, pulse, air);
  }

  private playChord(
    frequencies: number[],
    spacing: number,
    duration: number,
    type: OscillatorType,
  ) {
    frequencies.forEach((frequency, index) => {
      this.playTone(
        frequency,
        frequency * 1.012,
        type,
        index * spacing,
        duration,
        Math.max(0.025, 0.058 - index * 0.007),
      );
    });
  }

  private playTone(
    startFrequency: number,
    endFrequency: number,
    type: OscillatorType,
    delay: number,
    duration: number,
    level: number,
  ) {
    const context = this.context;
    const destination = this.masterGain;
    if (!context || !destination || context.state === "closed") return;

    const startAt = context.currentTime + delay;
    const endAt = startAt + duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), endAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(level, startAt + Math.min(0.02, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
    oscillator.connect(gain).connect(destination);
    this.trackTransient(oscillator, [gain]);
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.02);
  }

  private playNoiseBurst(frequency: number, duration: number, level: number) {
    const context = this.context;
    const destination = this.masterGain;
    if (!context || !destination || !this.noiseBuffer) return;

    const startAt = context.currentTime;
    const endAt = startAt + duration;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(frequency, startAt);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, frequency * 0.58), endAt);
    filter.Q.value = 0.72;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(level, startAt + Math.min(0.016, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
    source.connect(filter).connect(gain).connect(destination);
    this.trackTransient(source, [filter, gain]);
    source.start(startAt);
    source.stop(endAt + 0.02);
  }

  private createNoiseBuffer(context: AudioContext, duration: number) {
    const frameCount = Math.ceil(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private trackTransient(source: AudioScheduledSourceNode, connectedNodes: AudioNode[]) {
    this.transientSources.add(source);
    source.addEventListener(
      "ended",
      () => {
        this.transientSources.delete(source);
        source.disconnect();
        for (const node of connectedNodes) node.disconnect();
      },
      { once: true },
    );
  }

  private stopTransientSources() {
    for (const source of this.transientSources) {
      try {
        source.stop();
      } catch {
        // A Web Audio source may already have ended.
      }
    }
    this.transientSources.clear();
  }

  private canPlay() {
    return Boolean(
      this.context && this.context.state !== "closed" && this.enabled && this.playing,
    );
  }

  private rampMaster(value: number, duration: number) {
    this.rampParam(this.masterGain?.gain, value, duration);
  }

  private rampAmbience(value: number, duration: number) {
    this.rampParam(this.ambienceGain?.gain, value, duration);
  }

  private rampParam(parameter: AudioParam | undefined, value: number, duration: number) {
    const context = this.context;
    if (!context || !parameter || context.state === "closed") return;
    const now = context.currentTime;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(parameter.value, now);
    parameter.linearRampToValueAtTime(value, now + duration);
  }

  private queueSuspend(delay: number) {
    const context = this.context;
    if (!context || typeof window === "undefined") return;
    this.clearSuspendTimer();
    this.suspendTimer = window.setTimeout(() => {
      this.suspendTimer = null;
      if ((!this.enabled || !this.playing) && context.state === "running") {
        void context.suspend().catch(() => undefined);
      }
    }, delay);
  }

  private clearSuspendTimer() {
    if (this.suspendTimer === null || typeof window === "undefined") return;
    window.clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
  }
}
