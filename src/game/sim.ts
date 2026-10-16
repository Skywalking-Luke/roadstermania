import {
  GRAV,
  GRAV_FALL,
  TAP_V,
  GROUND,
  HOVER,
  MAX_FALL,
  PH,
  PW,
  SKY,
  THRUST,
  buildLevel,
  type Course,
  type Solid,
} from "@/game/course";

export type Phase = "title" | "run" | "crash" | "clear";

export type Player = {
  x: number;
  y: number;
  prevX: number;
  vy: number;
  angle: number;
  roll: number;
  spin: number;
  airAngle: number;
  grounded: boolean;
  stuck: boolean;
  airRoll: boolean;
};

export type Popup = { x: number; y: number; life: number; text: string };

export type Sim = {
  phase: Phase;
  level: number;
  time: number;
  flips: number;
  hint: string;
  reason: string;
  paused: boolean;
  shake: number;
  flash: number;
  lock: number;
  node: number;
  player: Player;
  course: Course;
  popups: Popup[];
  score: Score;
  boost: Boost;
  /** Seconds of post-continue invincibility. */
  inv?: number;
};

export type Boost = { charges: number; t: number; nextAt: number; want: boolean };
export const BOOST = { every: 5000, max: 3, dur: 1.5, gain: 0.6 };
export function newBoost(): Boost {
  return { charges: 0, t: 0, nextAt: BOOST.every, want: false };
}
/** Eased 0..1 boost strength: quick ramp in, smooth fade out. */
export function boostLevel(b: Boost) {
  if (b.t <= 0) return 0;
  const k = b.t / BOOST.dur; // 1 -> 0
  const inn = Math.min(1, (1 - k) / 0.12);
  const out = Math.min(1, k / 0.35);
  return Math.sin((Math.min(inn, out) * Math.PI) / 2);
}

/** Points for the current level attempt (carried totals live in runGame). */
export type Score = {
  distance: number;
  passes: number;
  rolls: number;
  rollPts: number;
  ceiling: number;
  clear: number;
  combo: number;
  bestCombo: number;
  ceilT: number;
  lastRoll: number;
};

export const PTS = {
  perMetre: 1, // 1 metre = 10 px of road
  pass: 25, // each jam car cleared
  roll: 100, // rolling over a car, times combo
  fullRoll: 50, // finishing a 360 in the air
  ceilingPerSec: 20,
  clearPerLevel: 500,
  maxCombo: 5,
};

export function newScore(): Score {
  return { distance: 0, passes: 0, rolls: 0, rollPts: 0, ceiling: 0, clear: 0, combo: 0, bestCombo: 0, ceilT: 0, lastRoll: -9 };
}

export function scoreTotal(s: Score) {
  return Math.floor(s.distance) + s.passes + s.rollPts + Math.floor(s.ceiling) + s.clear;
}

export type FlapInput = { down: boolean; edge: boolean };

const REASONS: Record<Solid["kind"], string> = {
  car: "Clipped a car",
  arm: "Red light",
  toll: "Toll gate",
  lip: "Too high — the tunnel mouth is lower",
  jam: "Tunnel jam",
};

export function createSim(level: number): Sim {
  const sim: Sim = {
    phase: "title",
    level,
    time: 0,
    flips: 0,
    hint: "Tap to roll. Hold to climb.",
    reason: "",
    paused: false,
    shake: 0,
    flash: 0,
    lock: 0,
    node: 0,
    player: spawn(),
    course: buildLevel(level),
    popups: [],
    score: newScore(),
    boost: newBoost(),
  };
  sim.hint = hintFor(sim);
  sim.node = nodeFor(sim);
  return sim;
}

export function begin(sim: Sim, level: number) {
  load(sim, level);
  sim.phase = "run";
}

export function previewLevel(sim: Sim, level: number) {
  if (sim.phase !== "title") return;
  load(sim, level);
  sim.phase = "title";
}

function load(sim: Sim, level: number) {
  sim.inv = 0;
  sim.level = level;
  sim.course = buildLevel(level);
  sim.time = 0;
  sim.flips = 0;
  sim.reason = "";
  sim.paused = false;
  sim.shake = 0;
  sim.flash = 0;
  sim.lock = 0;
  sim.player = spawn();
  sim.popups = [];
  sim.score = newScore();
  sim.boost = { ...sim.boost, t: 0, want: false, nextAt: BOOST.every };
  sim.hint = hintFor(sim);
  sim.node = nodeFor(sim);
}

function spawn(): Player {
  return {
    x: 48,
    y: GROUND - PH - HOVER,
    prevX: 48,
    vy: 0,
    angle: 0,
    roll: 0,
    spin: 0,
    airAngle: 0,
    grounded: true,
    stuck: false,
    airRoll: false,
  };
}

export function stepSim(sim: Sim, dt: number, input: FlapInput) {
  sim.shake = Math.max(0, sim.shake - dt * 8);
  sim.flash = Math.max(0, sim.flash - dt * 1.6);
  sim.lock = Math.max(0, sim.lock - dt);
  if (sim.inv && sim.phase === "run" && !sim.paused) sim.inv = Math.max(0, sim.inv - dt);
  for (const pop of sim.popups) {
    pop.life -= dt;
    pop.y -= 14 * dt;
  }
  sim.popups = sim.popups.filter((p) => p.life > 0);

  if (sim.phase !== "run" || sim.paused) return { flap: false, flip: false, crash: false, clear: false, landed: false, boosted: false };

  sim.time += dt;
  const p = sim.player;
  const bst = sim.boost;
  let boosted = false;
  if (bst.want) {
    bst.want = false;
    if (bst.charges > 0 && bst.t <= 0) {
      bst.charges -= 1;
      bst.t = BOOST.dur;
      boosted = true;
      sim.popups.push({ x: p.x, y: p.y - 12, life: 0.8, text: "BOOST" });
      sim.shake = Math.max(sim.shake, 1.2);
    }
  }
  const speed = sim.course.speed * (1 + BOOST.gain * boostLevel(bst));
  bst.t = Math.max(0, bst.t - dt);
  let flap = false;

  if (p.stuck && !input.down) {
    p.stuck = false;
    p.vy = 36;
    p.spin = 0;
  }

  if (input.edge && !p.stuck) {
    p.spin = Math.min(16, (p.spin > 1.5 ? p.spin : 0) + 13.5);
    if (p.roll === 0) p.roll = 0.04;
    p.airRoll = true;
    p.vy = Math.min(p.vy - 78, TAP_V);
    p.grounded = false;
    flap = true;
    sim.shake = Math.max(sim.shake, 0.2);
  }


  if (p.stuck && input.down) {
    const ceil = sim.course.ceilings.find((c) => p.x + PW > c.x0 && p.x < c.x1 && p.y <= c.y + 2);
    if (ceil) {
      p.y = ceil.y;
      p.vy = 0;
      p.spin = 0;
      p.x += speed * dt;
    } else {
      p.stuck = false;
      p.vy = 36;
      p.y += p.vy * dt;
      p.x += speed * dt;
    }
  } else {
    const lift = 0.55 + 0.45 * Math.max(0, Math.cos(p.roll));
    const ay = input.down ? GRAV + THRUST * lift : GRAV_FALL;
    p.vy = Math.max(-220, Math.min(MAX_FALL, p.vy + ay * dt));
    p.y += p.vy * dt;
    p.x += speed * dt;
    p.stuck = false;
  }

  let landed = false;
  let badLand = false;
  if (!p.stuck && p.y + PH >= GROUND) {
    badLand = p.vy > 110 && Math.cos(p.roll) < 0.3 && !(sim.inv && sim.inv > 0);
    p.y = GROUND - PH;
    if (p.vy > 0) p.vy *= 0.2;
    if (!badLand && !input.down) p.vy = Math.min(p.vy, 0);
  }
  const nearHover = p.y + PH >= GROUND - 0.5 && p.vy >= 0 && Math.cos(p.roll) > 0.8;
  if (!p.stuck && !input.down && nearHover) {
    if (!p.grounded) landed = true;
    p.grounded = true;
    p.airRoll = false;
    if (landed && sim.score.combo > 1) {
      sim.popups.push({ x: p.x, y: p.y - 10, life: 0.9, text: `COMBO x${sim.score.combo}` });
    }
    sim.score.combo = 0;
  } else if (!p.stuck) {
    p.grounded = false;
  }

  if (!p.stuck) {
    for (const c of sim.course.ceilings) {
      const over = p.x + PW > c.x0 && p.x < c.x1;
      if (!over || p.y > c.y + 1) continue;
      if (input.down && p.y + PH > c.y) {
        p.y = c.y;
        p.vy = 0;
        p.stuck = true;
        p.grounded = false;
        p.roll = 0;
        p.spin = 0;
        break;
      }
      if (p.y < c.y) {
        p.y = c.y;
        if (p.vy < 0) p.vy = 24;
      }
    }
  } else {
    p.airAngle = 0;
  }

  if (!p.stuck && p.y < SKY) {
    p.y = SKY;
    if (p.vy < 0) p.vy = 0;
  }

  let completed = false;
  if (p.stuck) {
    p.angle = 0;
    p.roll = 0;
    p.spin = 0;
  } else {
    if (p.roll > 0 || p.spin > 0.4) {
      p.roll += p.spin * dt;
      p.spin *= Math.exp(-0.25 * dt);
      if (p.roll >= Math.PI * 2) {
        p.roll = 0;
        p.spin = 0;
        completed = true;
      }
    } else {
      p.roll = 0;
      p.spin = 0;
    }
    const target = Math.max(-0.42, Math.min(0.48, -p.vy * 0.002));
    p.angle += (target - p.angle) * (1 - Math.exp(-8 * dt));
  }

  const sc = sim.score;
  sc.distance += (speed * dt) / 10 * PTS.perMetre;
  if (p.stuck) {
    sc.ceiling += PTS.ceilingPerSec * dt;
    sc.ceilT += dt;
  }
  if (completed) {
    sc.rollPts += PTS.fullRoll;
    sim.popups.push({ x: p.x, y: p.y - 16, life: 0.7, text: `+${PTS.fullRoll}` });
  }

  let flip = false;
  for (const car of sim.course.cars) {
    if (!car.jam || car.scored) continue;
    const edge = car.x + car.w / 2 - PW / 2; // car centre passes under the Roadster centre
    if (p.prevX < edge && p.x >= edge) {
      car.scored = true;
      if (p.y + PH <= car.y + 2 && (p.roll > 0.8 || completed || p.airRoll)) {
        sim.flips += 1;
        flip = true;
        sc.combo = Math.min(PTS.maxCombo, sc.combo + 1);
        sc.bestCombo = Math.max(sc.bestCombo, sc.combo);
        const pts = PTS.roll * sc.combo;
        sc.rolls += 1;
        sc.rollPts += pts;
        sim.popups.push({ x: p.x, y: p.y - 8, life: 0.95, text: sc.combo > 1 ? `ROLL +${pts} x${sc.combo}` : `ROLL +${pts}` });
        sim.shake = Math.max(sim.shake, 0.8);
      } else {
        sc.passes += PTS.pass;
        sim.popups.push({ x: p.x, y: p.y - 8, life: 0.6, text: `+${PTS.pass}` });
      }
    }
  }

  let crash = badLand;
  if (badLand) {
    sim.phase = "crash";
    sim.reason = "Caught the road mid-roll";
    sim.shake = 5;
    sim.flash = 1;
    sim.lock = 0.4;
    p.vy = 0;
    p.roll = 0;
    p.spin = 0;
  }
  const hx = p.x + 8;
  const hy = p.y + 2;
  const hw = PW - 16;
  const hh = PH - 4;
  const smashing = bst.t > 0;
  for (const s of sim.course.solids) {
    if (smashing && (s.kind === "car" || s.kind === "jam")) continue;
    if (sim.inv && sim.inv > 0) break;
    if (hx < s.x + s.w && hx + hw > s.x && hy < s.y + s.h && hy + hh > s.y) {
      crash = true;
      sim.phase = "crash";
      sim.reason = REASONS[s.kind];
      sim.shake = 5;
      sim.flash = 1;
      sim.lock = 0.4;
      p.vy = 0;
      p.roll = 0;
      break;
    }
  }

  let clear = false;
  if (!crash && p.x >= sim.course.finish) {
    clear = true;
    sim.phase = "clear";
    sim.score.clear = PTS.clearPerLevel * sim.level;
    sim.reason = "";
    sim.lock = 0.35;
    sim.flash = 0.4;
    sim.hint = "Lap clear";
  }

  // Every 1000 points earned this level adds a boost charge (max 3).
  const earned = scoreTotal(sim.score);
  while (earned >= bst.nextAt) {
    bst.nextAt += BOOST.every;
    if (bst.charges < BOOST.max) {
      bst.charges += 1;
      sim.popups.push({ x: p.x, y: p.y - 20, life: 0.9, text: "+BOOST" });
    }
  }

  p.prevX = p.x;
  if (!clear) {
    sim.hint = hintFor(sim);
    sim.node = nodeFor(sim);
  } else {
    sim.node = sim.course.markers.length - 1;
  }

  return { flap, flip, crash, clear, landed, boosted };
}

function nodeFor(sim: Sim) {
  const x = sim.player.x;
  const i = sim.course.markers.findIndex((m) => x < m.x);
  return i < 0 ? sim.course.markers.length - 1 : i;
}

function hintFor(sim: Sim) {
  const p = sim.player;
  const course = sim.course;
  for (const tun of course.tunnels) {
    if (p.x > tun.x - 8 && p.x < tun.x + tun.len) {
      if (p.stuck) {
        const under = tun.cars.some((c) => c.x < p.x + PW + 28 && c.x + c.w > p.x - 8 && c.y > p.y + 4);
        return under ? "Stay on the ceiling. The jam is under you." : "Gap below. Let go to drop.";
      }
      if (!tun.switchUp) return "Hold the ceiling, or drive the floor";
      const mid = tun.x + tun.len * 0.48;
      return p.x < mid ? "Jam on the floor. Hold the ceiling." : "Jam up top. Let go and drop.";
    }
  }
  for (const toll of course.tolls) {
    if (p.x > toll.x - toll.roofLead && p.x < toll.x + 16) {
      return toll.high ? "High gap. Hold to climb through." : "Low gap. Let go and drop through.";
    }
  }
  if (p.stuck) return "Stuck. Let go to drop.";
  if (p.x < 220) return "Tap to roll over cars. Hold to climb.";

  let bestD = 240;
  let text = "Eyes ahead";
  const consider = (x: number, msg: string) => {
    const d = x - p.x;
    if (d > -30 && d < bestD) {
      bestD = d;
      text = msg;
    }
  };
  for (const arm of course.arms) consider(arm.x, arm.red ? "Red light. Hold to hop it." : "Green light. Stay low.");
  const jam = course.cars.find((c) => c.jam && c.x + c.w > p.x);
  if (jam) consider(jam.x, "Tap once to roll over the cars");
  consider(course.finish, "Landing arch");
  return text;
}
