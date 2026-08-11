export type GameAudioSignal = "noise" | "voice" | "breath";

type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const MASTER_LEVEL = 0.42;

function getAudioContextConstructor() {
  if (typeof window === "undefined") return null;

  const audioWindow = window as AudioContextWindow;
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

export class GameAudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private thrustNoiseGain: GainNode | null = null;
  private thrustToneGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private transientSources = new Set<AudioScheduledSourceNode>();
  private suspendTimer: number | null = null;
  private enabled = true;
  private playing = false;
  private thrusting = false;
  private disposed = false;

  begin() {
    if (!this.activate()) return false;

    this.stopTransientSources();
    this.playing = true;
    this.setThrusting(false);
    this.rampAmbience(1, 0.55);
    this.playBeginCue();
    return true;
  }

  pause() {
    if (!this.context || !this.playing) return;

    this.stopTransientSources();
    this.playing = false;
    this.setThrusting(false);
    this.rampAmbience(0, 0.18);
    this.playPauseCue();
    this.queueSuspend(420);
  }

  resume() {
    if (!this.activate()) return false;

    this.stopTransientSources();
    this.playing = true;
    this.setThrusting(false);
    this.rampAmbience(1, 0.32);
    this.playResumeCue();
    return true;
  }

  finish(success: boolean) {
    this.stopTransientSources();
    this.playing = false;
    this.setThrusting(false);
    this.rampAmbience(0, 0.72);

    if (!this.context || !this.enabled) return;

    this.playFinishCue(success);
    this.queueSuspend(1_800);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;

    if (!enabled) {
      this.stopTransientSources();
      this.setThrusting(false);
      this.rampMaster(0, 0.1);
      this.queueSuspend(180);
      return true;
    }

    return Boolean(
      !this.disposed &&
        ((this.context && this.context.state !== "closed") ||
          getAudioContextConstructor()),
    );
  }

  setThrusting(thrusting: boolean) {
    const shouldThrust = thrusting && this.playing && this.enabled;
    if (this.thrusting === shouldThrust) return;

    this.thrusting = shouldThrust;
    this.rampParam(
      this.thrustNoiseGain?.gain,
      shouldThrust ? 0.065 : 0,
      shouldThrust ? 0.06 : 0.14,
    );
    this.rampParam(
      this.thrustToneGain?.gain,
      shouldThrust ? 0.018 : 0,
      shouldThrust ? 0.08 : 0.16,
    );
  }

  playSignal(signal: GameAudioSignal) {
    if (!this.canPlay()) return;

    if (signal === "voice") {
      this.playVoiceCue();
    } else if (signal === "noise") {
      this.playNoiseCue();
    } else {
      this.playBreathCue();
    }
  }

  dispose() {
    this.disposed = true;
    this.clearSuspendTimer();

    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
    }

    this.sources = [];
    this.stopTransientSources();
    const context = this.context;
    this.context = null;
    this.masterGain = null;
    this.ambienceGain = null;
    this.thrustNoiseGain = null;
    this.thrustToneGain = null;
    this.noiseBuffer = null;

    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  private activate() {
    if (this.disposed || !this.enabled || !this.ensureContext()) return false;

    this.clearSuspendTimer();
    const context = this.context;
    if (!context) return false;

    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    this.rampMaster(MASTER_LEVEL, 0.08);
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
      limiter.threshold.value = -18;
      limiter.knee.value = 10;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.24;
      ambienceGain.connect(masterGain);
      masterGain.connect(limiter).connect(context.destination);

      this.context = context;
      this.masterGain = masterGain;
      this.ambienceGain = ambienceGain;
      this.noiseBuffer = this.createNoiseBuffer(context, 2);
      this.createAmbience(context, ambienceGain);
      this.createThrust(context, masterGain);
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
    lowDrone.frequency.value = 55;
    highDrone.type = "triangle";
    highDrone.frequency.value = 82.41;
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 190;
    droneFilter.Q.value = 0.7;
    droneGain.gain.value = 0.044;

    pulse.type = "sine";
    pulse.frequency.value = 0.11;
    pulseDepth.gain.value = 0.012;
    pulse.connect(pulseDepth).connect(droneGain.gain);

    lowDrone.connect(droneFilter);
    highDrone.connect(droneFilter);
    droneFilter.connect(droneGain).connect(destination);

    air.buffer = this.noiseBuffer;
    air.loop = true;
    airFilter.type = "bandpass";
    airFilter.frequency.value = 520;
    airFilter.Q.value = 0.55;
    airGain.gain.value = 0.014;
    air.connect(airFilter).connect(airGain).connect(destination);

    lowDrone.start();
    highDrone.start();
    pulse.start();
    air.start();
    this.sources.push(lowDrone, highDrone, pulse, air);
  }

  private createThrust(context: AudioContext, destination: AudioNode) {
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    const tone = context.createOscillator();
    const toneFilter = context.createBiquadFilter();
    const toneGain = context.createGain();

    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 1_050;
    noiseFilter.Q.value = 0.72;
    noiseGain.gain.value = 0;

    tone.type = "sawtooth";
    tone.frequency.value = 73.42;
    toneFilter.type = "lowpass";
    toneFilter.frequency.value = 240;
    toneFilter.Q.value = 0.8;
    toneGain.gain.value = 0;

    noise.connect(noiseFilter).connect(noiseGain).connect(destination);
    tone.connect(toneFilter).connect(toneGain).connect(destination);
    noise.start();
    tone.start();

    this.thrustNoiseGain = noiseGain;
    this.thrustToneGain = toneGain;
    this.sources.push(noise, tone);
  }

  private playBeginCue() {
    this.playOscillator(73.42, 146.83, "sine", 0, 0.7, 0.08);
    this.playOscillator(146.83, 220, "triangle", 0.16, 0.58, 0.045);
  }

  private playPauseCue() {
    this.playOscillator(196, 98, "triangle", 0, 0.28, 0.07);
  }

  private playResumeCue() {
    this.playOscillator(110, 220, "sine", 0, 0.3, 0.065);
    this.playOscillator(220, 330, "triangle", 0.09, 0.32, 0.04);
  }

  private playVoiceCue() {
    [440, 659.25, 880].forEach((frequency, index) => {
      this.playOscillator(
        frequency,
        frequency * 1.015,
        "sine",
        index * 0.065,
        0.34,
        0.065 - index * 0.01,
      );
    });
  }

  private playNoiseCue() {
    this.playNoiseBurst(175, 0.24, 0.13);
    this.playOscillator(116.54, 46.25, "sawtooth", 0, 0.26, 0.075);
  }

  private playBreathCue() {
    this.playNoiseBurst(760, 0.36, 0.055);
    this.playOscillator(233.08, 174.61, "sine", 0.04, 0.28, 0.035);
  }

  private playFinishCue(success: boolean) {
    const notes = success
      ? [220, 329.63, 440, 659.25]
      : [146.83, 130.81, 98, 73.42];

    notes.forEach((frequency, index) => {
      this.playOscillator(
        frequency,
        success ? frequency * 1.01 : frequency * 0.98,
        success ? "sine" : "triangle",
        index * 0.16,
        success ? 0.65 : 0.72,
        success ? 0.07 : 0.055,
      );
    });
  }

  private playOscillator(
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
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      endAt,
    );
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(level, startAt + 0.025);
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
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(80, frequency * 0.58),
      endAt,
    );
    filter.Q.value = 0.72;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(level, startAt + 0.018);
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

  private trackTransient(
    source: AudioScheduledSourceNode,
    connectedNodes: AudioNode[],
  ) {
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
        // The source may already have ended.
      }
    }

    this.transientSources.clear();
  }

  private canPlay() {
    return Boolean(
      this.context &&
        this.context.state !== "closed" &&
        this.enabled &&
        this.playing,
    );
  }

  private rampMaster(value: number, duration: number) {
    this.rampParam(this.masterGain?.gain, value, duration);
  }

  private rampAmbience(value: number, duration: number) {
    this.rampParam(this.ambienceGain?.gain, value, duration);
  }

  private rampParam(
    parameter: AudioParam | undefined,
    value: number,
    duration: number,
  ) {
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
