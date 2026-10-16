import { playClear, playCrash, playFlap, playFlip, resumeAudio, setHoldHiss, setMuted, unlockAudio, updateEngine } from "@/game/audio";
import { createRenderer } from "@/game/draw";
import { GROUND, PH, VH, VW } from "@/game/course";
import { begin, createSim, previewLevel, scoreTotal, stepSim, type Sim } from "@/game/sim";
import { loadSprites } from "@/game/sprites";
import {
  drain,
  flapHeld,
  getBest,
  getSnap,
  getTestKeys,
  getUnlocked,
  isMuted,
  isRunSaved,
  qualifies,
  pressFlap,
  publish,
  recordClear,
  releaseFlap,
  setTestKeys,
  takeFlaps,
  toggleMuted,
  type Snap,
} from "@/game/store";

const STEP = 1 / 60;

function flapCode(code: string) {
  return code === "Space" || code === "KeyW" || code === "ArrowUp";
}

let carried = 0;
let runId = 1;

function toSnap(sim: Sim): Snap {
  const span = Math.max(1, sim.course.finish - 48);
  return {
    phase: sim.phase,
    level: sim.level,
    unlocked: getUnlocked(),
    time: sim.time,
    flips: sim.flips,
    bestMs: getBest(sim.level),
    progress: Math.min(1, Math.max(0, (sim.player.x - 48) / span)),
    hint: sim.hint,
    muted: isMuted(),
    flash: sim.flash,
    node: sim.node,
    stuck: sim.player.stuck,
    reason: sim.reason,
    paused: sim.paused,
    alt: Math.max(0, GROUND - PH - sim.player.y) * 0.62,
    downforce: sim.player.stuck
      ? 96
      : Math.max(6, Math.round(Math.max(0, Math.cos(sim.player.roll)) * (90 - Math.min(72, Math.max(0, GROUND - PH - sim.player.y))))),
    roll: sim.player.angle,
    thrust: sim.player.vy < -18 || sim.player.spin > 2,
    score: carried + scoreTotal(sim.score),
    carried,
    combo: sim.score.combo,
    breakdown: {
      distance: Math.floor(sim.score.distance),
      passes: sim.score.passes,
      rolls: sim.score.rolls,
      rollPts: sim.score.rollPts,
      ceiling: Math.floor(sim.score.ceiling),
      clear: sim.score.clear,
      bestCombo: sim.score.bestCombo,
    },
    runId,
  };
}

export function runGame(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not start the pixel lap.");
  canvas.width = VW;
  canvas.height = VH;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sim = createSim(Math.max(1, getSnap().level || 1));
  const sprites = loadSprites();
  const renderer = createRenderer();
  let stopped = false;
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let prevTest = false;
  let clock = 0;
  let recorded = false;
  let appliedMute = isMuted();

  const newRun = () => {
    carried = 0;
    runId += 1;
  };

  const retry = () => {
    newRun();
    begin(sim, sim.level);
    renderer.reset();
    recorded = false;
    releaseFlap();
  };

  const next = () => {
    if (sim.phase !== "clear") return;
    carried += scoreTotal(sim.score);
    begin(sim, sim.level + 1);
    renderer.reset();
    recorded = false;
    releaseFlap();
  };

  const toTitle = () => {
    newRun();
    sim.phase = "title";
    previewLevel(sim, sim.level);
    renderer.reset();
    recorded = false;
    releaseFlap();
  };

  const commands = () => {
    for (const cmd of drain()) {
      if (cmd.t === "start" && sim.phase === "title") {
        newRun();
        begin(sim, sim.level);
        renderer.reset();
        recorded = false;
      } else if (cmd.t === "again") retry();
      else if (cmd.t === "next") next();
      else if (cmd.t === "title") toTitle();
      else if (cmd.t === "mute") {
        appliedMute = toggleMuted();
        setMuted(appliedMute);
      } else if (cmd.t === "level" && sim.phase === "title") previewLevel(sim, cmd.n);
      else if (cmd.t === "pause" && sim.phase === "run") {
        sim.paused = !sim.paused;
        releaseFlap();
      }
    }
  };

  const readFlap = () => {
    const test = getTestKeys();
    if (test) {
      const down = test.has("Space") || test.has("KeyW") || test.has("ArrowUp");
      const edge = down && !prevTest;
      prevTest = down;
      return { down, edge };
    }
    prevTest = false;
    return { down: flapHeld(), edge: takeFlaps() > 0 };
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (getTestKeys()) return;
    if ((e.target as HTMLElement | null)?.closest?.("input")) return;
    if (e.code === "Escape" && sim.phase === "run") {
      e.preventDefault();
      sim.paused = !sim.paused;
      releaseFlap();
      return;
    }
    if ((e.code === "Enter" || e.code === "Space") && sim.phase === "title" && !e.repeat) {
      e.preventDefault();
      newRun();
      begin(sim, sim.level);
      renderer.reset();
      recorded = false;
      return;
    }
    if (e.code === "KeyR" && (sim.phase === "run" || sim.phase === "crash")) {
      e.preventDefault();
      retry();
      return;
    }
    if (e.code === "KeyM") {
      appliedMute = toggleMuted();
      setMuted(appliedMute);
      return;
    }
    unlockAudio();
    if (sim.paused) return;
    if (!flapCode(e.code) || e.repeat || sim.phase !== "run" || sim.paused) return;
    e.preventDefault();
    pressFlap();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (getTestKeys()) return;
    if ((e.target as HTMLElement | null)?.closest?.("input")) return;
    if (flapCode(e.code)) releaseFlap();
  };
  const onPointerDown = (e: PointerEvent) => {
    unlockAudio();
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, input, form, .sheet")) return;
    const pending = qualifies(carried + scoreTotal(sim.score)) && !isRunSaved(runId);
    if (sim.phase === "run" && !sim.paused) pressFlap();
    else if (sim.phase === "crash" && sim.lock <= 0 && !pending) retry();
    else if (sim.phase === "clear" && sim.lock <= 0) next();
  };
  const onPointerUp = () => {
    if (!getTestKeys()) releaseFlap();
  };
  const onVis = () => {
    if (document.hidden) releaseFlap();
    else resumeAudio();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  document.addEventListener("visibilitychange", onVis);

  window.__controlsTest = {
    getYaw: () => sim.player.angle,
    getSpeed: () => -sim.player.vy,
    getPhase: () => sim.phase,
    getX: () => sim.player.x,
    getY: () => sim.player.y,
    getLevel: () => sim.level,
    getStuck: () => sim.player.stuck,
    getFlips: () => sim.flips,
    getScore: () => carried + scoreTotal(sim.score),
    setKeys: (codes: string[]) => setTestKeys(codes),
    setPose: (pose: { x?: number; y?: number; vy?: number }) => {
      if (sim.phase === "title") begin(sim, sim.level);
      if (pose.x != null) sim.player.x = pose.x;
      if (pose.y != null) sim.player.y = pose.y;
      if (pose.vy != null) sim.player.vy = pose.vy;
      sim.player.prevX = sim.player.x - 0.01;
      sim.player.grounded = false;
      sim.player.stuck = false;
    },
    getCourse: () => ({
      finish: sim.course.finish,
      speed: sim.course.speed,
      ground: GROUND,
      roof: 34,
      arms: sim.course.arms,
      cars: sim.course.cars.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h })),
      tolls: sim.course.tolls,
      tunnels: sim.course.tunnels.map((t) => ({
        x: t.x,
        len: t.len,
        ceil: t.ceil,
        switchUp: t.switchUp,
        cars: t.cars.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h })),
      })),
    }),
  };

  const frame = (now: number) => {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    commands();

    const input = readFlap();
    const fx = { flap: false, flip: false, crash: false, landed: false, clear: false };
    if (sim.phase === "run") {
      acc += dt;
      let n = 0;
      let edge = input.edge;
      while (acc >= STEP && n < 5 && sim.phase === "run") {
        const ev = stepSim(sim, STEP, { down: input.down, edge });
        edge = false;
        acc -= STEP;
        n += 1;
        fx.flap = fx.flap || ev.flap;
        fx.flip = fx.flip || ev.flip;
        fx.crash = fx.crash || ev.crash;
        fx.landed = fx.landed || ev.landed;
        fx.clear = fx.clear || ev.clear;
      }
    } else {
      acc = 0;
      stepSim(sim, dt, { down: false, edge: false });
    }

    if (fx.flap) playFlap();
    if (fx.flip) playFlip();
    if (fx.crash) playCrash();
    if (fx.clear && !recorded) {
      recorded = true;
      recordClear(sim.level, sim.time);
      playClear();
    }
    if (appliedMute !== isMuted()) {
      appliedMute = isMuted();
      setMuted(appliedMute);
    }
    updateEngine(sim.phase === "run", input.down && !sim.player.stuck);
    setHoldHiss(sim.phase === "run" && !sim.paused && input.down && !sim.player.stuck && sim.player.vy < 0);

    renderer.draw(ctx, sim, sprites, clock, fx, reduce);
    publish(toSnap(sim));
    raf = requestAnimationFrame(frame);
  };

  publish(toSnap(sim));
  raf = requestAnimationFrame(frame);

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      document.removeEventListener("visibilitychange", onVis);
      delete window.__controlsTest;
    },
  };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getPhase: () => string;
      getX: () => number;
      getY: () => number;
      getLevel: () => number;
      getStuck: () => boolean;
      getFlips: () => number;
      getScore: () => number;
      setKeys: (codes: string[]) => void;
      setPose: (pose: { x?: number; y?: number; vy?: number }) => void;
      getCourse: () => {
        finish: number;
        speed: number;
        ground: number;
        roof: number;
        tunnels: { x: number; len: number; ceil: number; switchUp: boolean }[];
      };
    };
  }
}
