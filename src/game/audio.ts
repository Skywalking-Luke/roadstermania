let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let engine: OscillatorNode | null = null;
let engineGain: GainNode | null = null;
let noise: AudioBuffer | null = null;
let wantMute = false;

function ensure() {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = wantMute ? 0 : 0.55;
    master.connect(ctx.destination);
    engine = ctx.createOscillator();
    engine.type = "square";
    engine.frequency.value = 70;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 280;
    engine.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engine.start();
    const len = Math.floor(ctx.sampleRate * 0.25);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function unlockAudio() {
  ensure();
}

export function resumeAudio() {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export function setMuted(muted: boolean) {
  wantMute = muted;
  if (!ctx || !master) return;
  master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.02);
}

export function updateEngine(running: boolean, thrust: boolean) {
  if (!ctx || !engine || !engineGain) return;
  engineGain.gain.setTargetAtTime(running ? 0.03 : 0, ctx.currentTime, 0.04);
  engine.frequency.setTargetAtTime(thrust ? 150 : 78, ctx.currentTime, 0.04);
}

function blip(freq: number, dur: number, type: OscillatorType, gain: number) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(g);
  g.connect(master);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

function burst(rate: number, dur: number, gain: number) {
  if (!ctx || !master || !noise) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const g = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = rate;
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start();
}

export function playFlap() {
  blip(220, 0.08, "square", 0.08);
  burst(900, 0.06, 0.12);
}

export function playFlip() {
  blip(520, 0.09, "square", 0.07);
  blip(780, 0.12, "square", 0.05);
}

export function playCrash() {
  burst(180, 0.28, 0.35);
  blip(90, 0.2, "sawtooth", 0.08);
}

export function playClear() {
  blip(440, 0.1, "square", 0.07);
  blip(660, 0.16, "square", 0.06);
}
