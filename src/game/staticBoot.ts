import { playClear, playCrash, playFlap, playFlip, setMuted, unlockAudio, updateEngine } from "@/game/audio";
import { GROUND, PH, VH, VW } from "@/game/course";
import { createRenderer } from "@/game/draw";
import { begin, createSim, previewLevel, stepSim } from "@/game/sim";
import { loadSprites } from "@/game/sprites";
import { formatTime, getBest, getUnlocked, recordClear } from "@/game/store";

const STEP = 1 / 60;

export type PlayView = {
  phase: "title" | "run" | "crash" | "clear";
  level: number;
  unlocked: number;
  time: string;
  flips: number;
  hint: string;
  reason: string;
  paused: boolean;
  alt: string;
  progress: number;
  best: string;
};

export function mount(canvas: HTMLCanvasElement, onView: (view: PlayView) => void, spriteBase = "assets/play") {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas unavailable");
  canvas.width = VW;
  canvas.height = VH;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sim = createSim(1);
  const sprites = loadSprites(spriteBase);
  const renderer = createRenderer();
  let held = false;
  let edges = 0;
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let clock = 0;
  let recorded = false;
  let muted = false;

  const view = (): PlayView => ({
    phase: sim.phase,
    level: sim.level,
    unlocked: getUnlocked(),
    time: formatTime(sim.time),
    flips: sim.flips,
    hint: sim.hint,
    reason: sim.reason,
    paused: sim.paused,
    alt: Math.max(0, GROUND - PH - sim.player.y).toFixed(1),
    progress: Math.min(1, Math.max(0, (sim.player.x - 48) / Math.max(1, sim.course.finish - 48))),
    best: (() => {
      const ms = getBest(sim.level);
      return ms == null ? "" : formatTime(ms / 1000);
    })(),
  });

  const press = () => {
    if (!held) edges += 1;
    held = true;
  };
  const release = () => {
    held = false;
  };

  const api = {
    unlock: () => unlockAudio(),
    press,
    release,
    start() {
      unlockAudio();
      begin(sim, sim.level);
      renderer.reset();
      recorded = false;
      release();
    },
    again() {
      begin(sim, sim.level);
      renderer.reset();
      recorded = false;
      release();
    },
    next() {
      if (sim.phase !== "clear") return;
      begin(sim, sim.level + 1);
      renderer.reset();
      recorded = false;
      release();
    },
    title() {
      sim.phase = "title";
      previewLevel(sim, sim.level);
      renderer.reset();
      recorded = false;
      release();
    },
    pause() {
      if (sim.phase !== "run") return;
      sim.paused = !sim.paused;
      release();
    },
    mute() {
      muted = !muted;
      setMuted(muted);
      return muted;
    },
    level(n: number) {
      if (sim.phase !== "title") return;
      const cap = getUnlocked();
      previewLevel(sim, Math.max(1, Math.min(cap, n)));
    },
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Escape" && sim.phase === "run") {
      e.preventDefault();
      api.pause();
      return;
    }
    if ((e.code === "Enter" || e.code === "Space") && sim.phase === "title" && !e.repeat) {
      e.preventDefault();
      api.start();
      return;
    }
    if (e.code === "KeyR" && (sim.phase === "run" || sim.phase === "crash")) {
      e.preventDefault();
      api.again();
      return;
    }
    if (e.code === "KeyM") {
      api.mute();
      return;
    }
    if (sim.paused) return;
    if ((e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") && !e.repeat && sim.phase === "run") {
      e.preventDefault();
      press();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") release();
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    const input = { down: held, edge: edges > 0 };
    edges = 0;
    const fx = { flap: false, flip: false, crash: false, landed: false };
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
        if (ev.clear && !recorded) {
          recorded = true;
          recordClear(sim.level, sim.time);
          playClear();
        }
      }
    } else {
      acc = 0;
      stepSim(sim, dt, { down: false, edge: false });
    }
    if (fx.flap) playFlap();
    if (fx.flip) playFlip();
    if (fx.crash) playCrash();
    updateEngine(sim.phase === "run" && !sim.paused, held && !sim.player.stuck);
    renderer.draw(ctx, sim, sprites, clock, fx, reduce);
    onView(view());
    raf = requestAnimationFrame(frame);
  };
  onView(view());
  raf = requestAnimationFrame(frame);
  return api;
}
