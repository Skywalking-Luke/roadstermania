import {
  GRAV,
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
};

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
  };
}

export function stepSim(sim: Sim, dt: number, input: FlapInput) {
  sim.shake = Math.max(0, sim.shake - dt * 8);
  sim.flash = Math.max(0, sim.flash - dt * 1.6);
  sim.lock = Math.max(0, sim.lock - dt);
  for (const pop of sim.popups) {
    pop.life -= dt;
    pop.y -= 14 * dt;
  }
  sim.popups = sim.popups.filter((p) => p.life > 0);

  if (sim.phase !== "run" || sim.paused) return { flap: false, flip: false, crash: false, clear: false, landed: false };

  sim.time += dt;
  const p = sim.player;
  const speed = sim.course.speed;
  let flap = false;

  if (p.stuck && !input.down) {
    p.stuck = false;
    p.vy = 36;
    p.spin = 0;
  }

  if (input.edge && !p.stuck) {
    p.spin = Math.min(16, (p.spin > 1.5 ? p.spin : 0) + 13.5);
    if (p.roll === 0) p.roll = 0.04;
    p.vy -= 78;
    p.grounded = false;
    flap = true;
    sim.shake = Math.max(sim.shake, 0.2);
  }

  const hoverY = GROUND - PH - HOVER;

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
    let ay = GRAV;
    if (input.down) {
      ay += THRUST * lift;
    } else {
      const err = hoverY - p.y;
      const hold = Math.max(-360, Math.min(420, err * 18 - p.vy * 6));
      ay += -GRAV * lift + hold * lift;
    }
    p.vy = Math.max(-220, Math.min(MAX_FALL, p.vy + ay * dt));
    p.y += p.vy * dt;
    p.x += speed * dt;
    p.stuck = false;
  }

  let landed = false;
  let badLand = false;
  if (!p.stuck && p.y + PH >= GROUND) {
    badLand = p.vy > 110 && Math.cos(p.roll) < 0.3;
    p.y = GROUND - PH;
    if (p.vy > 0) p.vy *= 0.2;
    if (!badLand && !input.down) p.vy = Math.min(p.vy, 0);
  }
  const nearHover = Math.abs(p.y - hoverY) < 5 && Math.abs(p.vy) < 22 && Math.cos(p.roll) > 0.8;
  if (!p.stuck && !input.down && nearHover) {
    if (!p.grounded) landed = true;
    p.grounded = true;
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

  let flip = false;
  for (const car of sim.course.cars) {
    if (!car.jam || car.scored) continue;
    const edge = car.x + car.w;
    if (p.prevX < edge && p.x >= edge) {
      car.scored = true;
      if (p.y + PH <= car.y + 2 && (p.roll > 0.8 || completed)) {
        sim.flips += 1;
        flip = true;
        sim.popups.push({ x: p.x, y: p.y - 8, life: 0.85, text: "ROLL" });
        sim.shake = Math.max(sim.shake, 0.8);
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
  for (const s of sim.course.solids) {
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
    sim.reason = "";
    sim.lock = 0.35;
    sim.flash = 0.4;
    sim.hint = "Lap clear";
  }

  p.prevX = p.x;
  if (!clear) {
    sim.hint = hintFor(sim);
    sim.node = nodeFor(sim);
  } else {
    sim.node = sim.course.markers.length - 1;
  }

  return { flap, flip, crash, clear, landed };
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
      if (!tun.switchUp) return "Hold the ceiling, or hover along the floor";
      const mid = tun.x + tun.len * 0.48;
      return p.x < mid ? "Jam on the floor. Hold the ceiling." : "Jam up top. Let go and drop.";
    }
  }
  for (const toll of course.tolls) {
    if (p.x > toll.x - toll.roofLead && p.x < toll.x + 16) {
      return toll.high ? "High gap. Hold to climb through." : "Low gap. Let go and hover through.";
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
  for (const arm of course.arms) consider(arm.x, arm.red ? "Red light. Hold to hop it." : "Green light. Stay on the hover.");
  const jam = course.cars.find((c) => c.jam && c.x + c.w > p.x);
  if (jam) consider(jam.x, "Tap once to roll over the cars");
  consider(course.finish, "Landing arch");
  return text;
}
