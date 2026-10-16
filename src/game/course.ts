/** Logical view width; adapts to the screen's aspect ratio (height stays VH). */
export let VW = 320;
export function setViewWidth(w: number) {
  VW = Math.max(240, Math.min(640, Math.round(w)));
  return VW;
}
export const VH = 180;
export const GROUND = 158;
export const PW = 26;
export const PH = 12;
export const ROOF = 34;
export const WALL = 10;
export const SKY = 4;

export const FLAP_V = -248;
export const GRAV = 520;
export const MAX_FALL = 240;
export const HOVER = 0; // no hover: the car rests on the road
export const GRAV_FALL = 400; // gravity when the button is released
export const TAP_V = -205; // upward kick from a tap

/** Base speed grows 11% per level, capped so it stays playable. */
export function levelSpeed(level: number) {
  return Math.min(165, Math.round(78 * Math.pow(1.11, Math.max(0, level - 1))));
}

/** Each level's run is 22% longer than the previous one (capped at 10x level 1). */
export function levelLength(level: number) {
  return Math.round(BASE_LEN * Math.min(10, Math.pow(1.22, Math.max(0, level - 1))));
}
const BASE_LEN = 1600;
export const THRUST = -900;

export type MarkerId = "light" | "jam" | "toll" | "tunnel" | "arch";

export type Marker = { id: MarkerId; x: number };

export type CarObs = {
  x: number;
  y: number;
  w: number;
  h: number;
  frame: number;
  jam: boolean;
  scored: boolean;
};

export type ArmObs = { x: number; barH: number; red: boolean };

export type TollObs = { x: number; high: boolean; gapSlack: number; roofLead: number };

export type TunnelObs = { x: number; len: number; ceil: number; cars: CarObs[]; switchUp: boolean };

export type Solid = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "car" | "arm" | "toll" | "lip" | "jam";
};

export type Ceiling = { x0: number; x1: number; y: number };

export type Course = {
  level: number;
  speed: number;
  arms: ArmObs[];
  cars: CarObs[];
  tolls: TollObs[];
  tunnels: TunnelObs[];
  finish: number;
  markers: Marker[];
  solids: Solid[];
  ceilings: Ceiling[];
};

const SPECS = [
  { frame: 0, w: 34, h: 12 },
  { frame: 1, w: 32, h: 14 },
  { frame: 2, w: 34, h: 16 },
  { frame: 3, w: 36, h: 20 },
];

function carSolid(c: CarObs, kind: Solid["kind"]): Solid {
  return { x: c.x + 2, y: c.y + 1, w: Math.max(6, c.w - 4), h: Math.max(6, c.h - 2), kind };
}

export function buildLevel(level: number): Course {
  const L = Math.max(1, Math.floor(level));
  const speed = levelSpeed(L);
  const slack = Math.max(4, 18 - (L - 1) * 2);
  const gapSlack = Math.max(10, 28 - (L - 1) * 2);
  const barH = Math.min(26, 16 + Math.floor((L - 1) * 1.4));
  const spacing = Math.max(64, 108 - (L - 1) * 5);
  const pad = (k: number) => Math.max(128, Math.round(speed * k));

  const arms: ArmObs[] = [];
  const cars: CarObs[] = [];
  const tolls: TollObs[] = [];
  const tunnels: TunnelObs[] = [];
  const markers: Marker[] = [];
  let x = L === 1 ? 460 : 280;

  arms.push({ x, barH, red: L % 3 !== 2 });
  markers.push({ id: "light", x });
  x += pad(1.25);

  markers.push({ id: "jam", x });
  const nJam = Math.min(6, 2 + L);
  for (let i = 0; i < nJam; i++) {
    const spec = L >= 3 && i % 3 === 2 ? SPECS[3] : i % 2 === 1 ? SPECS[2] : SPECS[i % 2];
    cars.push({
      x,
      y: GROUND - spec.h,
      w: spec.w,
      h: spec.h,
      frame: spec.frame,
      jam: true,
      scored: false,
    });
    x += spacing;
  }
  x += pad(1.15);

  const toll: TollObs = {
    x,
    high: L % 2 === 0,
    gapSlack,
    roofLead: Math.max(136, Math.round(speed * 1.25)),
  };
  tolls.push(toll);
  markers.push({ id: "toll", x: toll.x - toll.roofLead });
  x += pad(1.2);

  const jamH = 14;
  const ceil = GROUND - (PH + slack + jamH + slack + PH);
  const switchUp = L >= 4;
  const tCars: CarObs[] = [];
  const count = switchUp ? 4 : 3;
  let cx = x + 80;
  for (let i = 0; i < count; i++) {
    if (switchUp && i === 2) cx += 100;
    const mode: "mid" | "low" | "high" = !switchUp ? "mid" : i < 2 ? "low" : "high";
    let y = ceil + PH + slack;
    let h = jamH;
    let w = 28;
    let frame = i % 2;
    if (mode === "low") {
      h = PH + 4;
      y = GROUND - h;
      w = 32;
      frame = 2;
    } else if (mode === "high") {
      h = PH + 4;
      y = ceil;
      w = 32;
      frame = 3;
    }
    tCars.push({ x: cx, y, w, h, frame, jam: false, scored: false });
    cx += 48;
  }
  const len = cx + 40 - x;
  const tunnel: TunnelObs = { x, len, ceil, cars: tCars, switchUp };
  tunnels.push(tunnel);
  markers.push({ id: "tunnel", x });
  x += len + pad(0.75);

  if (L >= 5) {
    const extra = Math.min(4, 1 + Math.floor(L / 2));
    for (let i = 0; i < extra; i++) {
      const spec = L >= 6 && i === extra - 1 ? SPECS[3] : SPECS[0];
      cars.push({
        x,
        y: GROUND - spec.h,
        w: spec.w,
        h: spec.h,
        frame: spec.frame,
        jam: true,
        scored: false,
      });
      x += spacing - 4;
    }
    x += pad(0.85);
  }

  if (L >= 7) {
    arms.push({ x, barH: Math.min(32, barH + 4), red: true });
    x += pad(0.9);
  }

  // Stretch the run to the target length with extra traffic and lights.
  const target = levelLength(L) - 24;
  let seg = 0;
  const nSeg = Math.min(4, 2 + Math.floor(L / 3));
  for (;;) {
    const jamFits = x + nSeg * spacing + pad(1.1) <= target;
    const armFits = x + pad(1.1) <= target;
    if (!armFits) break;
    if (seg % 2 === 0 && jamFits) {
      markers.push({ id: "jam", x });
      const n = nSeg;
      for (let i = 0; i < n; i++) {
        const spec = L >= 3 && i === n - 1 ? SPECS[3] : SPECS[(i + seg) % 3];
        cars.push({ x, y: GROUND - spec.h, w: spec.w, h: spec.h, frame: spec.frame, jam: true, scored: false });
        x += spacing;
      }
      x += pad(1.1);
    } else {
      arms.push({ x, barH, red: true });
      markers.push({ id: "light", x });
      x += pad(1.1);
    }
    seg += 1;
  }
  x = Math.max(x, target);

  const finish = x + 24;
  markers.push({ id: "arch", x: finish });

  const solids: Solid[] = [];
  const ceilings: Ceiling[] = [];
  for (const arm of arms) {
    if (!arm.red) continue;
    solids.push({ x: arm.x, y: GROUND - arm.barH, w: 6, h: arm.barH, kind: "arm" });
  }
  for (const car of cars) solids.push(carSolid(car, "car"));
  for (const gate of tolls) {
    const gapH = PH + gate.gapSlack;
    const gapTop = gate.high ? ROOF : GROUND - gapH;
    if (gapTop > 0) solids.push({ x: gate.x, y: 0, w: WALL, h: gapTop, kind: "toll" });
    const lower = gapTop + gapH;
    if (lower < GROUND) solids.push({ x: gate.x, y: lower, w: WALL, h: GROUND - lower, kind: "toll" });
    ceilings.push({ x0: gate.x - gate.roofLead, x1: gate.x + WALL, y: ROOF });
  }
  for (const tun of tunnels) {
    solids.push({ x: tun.x, y: 0, w: WALL, h: tun.ceil, kind: "lip" });
    solids.push({ x: tun.x + tun.len - WALL, y: 0, w: WALL, h: tun.ceil, kind: "lip" });
    ceilings.push({ x0: tun.x + WALL, x1: tun.x + tun.len - WALL, y: tun.ceil });
    for (const car of tun.cars) solids.push(carSolid(car, "jam"));
  }

  return { level: L, speed, arms, cars, tolls, tunnels, finish, markers, solids, ceilings };
}
