export type Phase = "title" | "run" | "crash" | "clear";

export type Snap = {
  phase: Phase;
  level: number;
  unlocked: number;
  time: number;
  flips: number;
  bestMs: number | null;
  progress: number;
  hint: string;
  muted: boolean;
  flash: number;
  node: number;
  stuck: boolean;
  reason: string;
  paused: boolean;
  alt: number;
  downforce: number;
  roll: number;
  thrust: boolean;
  score: number;
  carried: number;
  combo: number;
  breakdown: Breakdown;
  runId: number;
  runTime: number;
  boostCharges: number;
  boostFill: number;
  boosting: boolean;
};

export type Breakdown = { distance: number; passes: number; rolls: number; rollPts: number; ceiling: number; clear: number; bestCombo: number };
const emptyBreakdown: Breakdown = { distance: 0, passes: 0, rolls: 0, rollPts: 0, ceiling: 0, clear: 0, bestCombo: 0 };

export const initialSnap: Snap = {
  phase: "title",
  level: 1,
  unlocked: 1,
  time: 0,
  flips: 0,
  bestMs: null,
  progress: 0,
  hint: "Tap to flap",
  muted: false,
  flash: 0,
  node: 0,
  stuck: false,
  reason: "",
  paused: false,
  alt: 0,
  downforce: 50,
  roll: 0,
  thrust: false,
  score: 0,
  carried: 0,
  combo: 0,
  breakdown: emptyBreakdown,
  runId: 0,
  runTime: 0,
  boostCharges: 0,
  boostFill: 0,
  boosting: false,
};

export type ScoreRow = { name: string; score: number; level: number; rolls: number; at: number; time?: number };

// v2 shape kept; `scores` and `name` are optional additions so older saves load unchanged.
type Save = { v: 2; best: Record<string, number>; unlocked: number; scores?: ScoreRow[]; name?: string };

const KEY = "reveal-run-v2";

let save: Save = { v: 2, best: {}, unlocked: 1 };
let muted = false;

function readSave(): Save {
  if (typeof localStorage === "undefined") return save;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { v: 2, best: {}, unlocked: 1 };
    const parsed = JSON.parse(raw) as Partial<Save>;
    if (parsed.v !== 2 || !parsed.best) return { v: 2, best: {}, unlocked: 1 };
    return {
      v: 2,
      best: parsed.best,
      unlocked: Math.max(1, parsed.unlocked ?? 1),
      scores: Array.isArray(parsed.scores)
        ? parsed.scores
            .filter((r) => r && typeof r.score === "number" && Number.isFinite(r.score))
            .map((r) => ({
              name: String(r.name ?? "???").slice(0, 3).toUpperCase(),
              score: Math.floor(r.score),
              level: Number(r.level) || 1,
              rolls: Number(r.rolls) || 0,
              at: Number(r.at) || 0,
              time: typeof r.time === "number" && Number.isFinite(r.time) ? r.time : undefined,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
        : [],
      name: typeof parsed.name === "string" ? parsed.name.slice(0, 3) : undefined,
    };
  } catch {
    return { v: 2, best: {}, unlocked: 1 };
  }
}

save = readSave();

function writeSave() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode */
  }
}

export function getBoard() {
  return Object.entries(save.best)
    .map(([level, ms]) => ({ level: Number(level), ms }))
    .filter((row) => Number.isFinite(row.level))
    .sort((a, b) => a.level - b.level);
}

export function getScores(): ScoreRow[] {
  return save.scores ?? [];
}

export function getLastName() {
  return save.name ?? "";
}

/** Would this score make the top 10 on this device? */
export function qualifies(score: number) {
  if (score <= 0) return false;
  const rows = getScores();
  return rows.length < 10 || score > rows[rows.length - 1].score;
}

const savedRuns = new Set<number>();

export function isRunSaved(runId: number) {
  return savedRuns.has(runId);
}

/** Saves a score; returns its 1-based rank, or 0 if it did not place. */
export function submitScore(runId: number, rawName: string, score: number, level: number, rolls: number, time?: number) {
  if (savedRuns.has(runId) || !qualifies(score)) return 0;
  savedRuns.add(runId);
  const name = (rawName.replace(/[^a-z0-9]/gi, "").toUpperCase() || "AAA").slice(0, 3);
  const row: ScoreRow = { name, score: Math.floor(score), level, rolls, at: Date.now(), time: time == null ? undefined : Math.round(time * 100) / 100 };
  const rows = [...getScores(), row].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, 10);
  save.scores = rows;
  save.name = name;
  writeSave();
  return rows.indexOf(row) + 1;
}

export function getUnlocked() {
  return save.unlocked;
}

export function getBest(level: number) {
  const ms = save.best[String(level)];
  return ms == null ? null : ms;
}

export function recordClear(level: number, seconds: number) {
  const ms = Math.round(seconds * 1000);
  const prev = save.best[String(level)];
  if (prev == null || ms < prev) save.best[String(level)] = ms;
  save.unlocked = Math.max(save.unlocked, level + 1);
  writeSave();
  return save.best[String(level)] ?? ms;
}

export function isMuted() {
  return muted;
}

export function toggleMuted() {
  muted = !muted;
  return muted;
}

let snap: Snap = {
  ...initialSnap,
  level: save.unlocked,
  unlocked: save.unlocked,
  bestMs: getBest(save.unlocked),
};
const listeners = new Set<() => void>();

export function getSnap() {
  return snap;
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function publish(next: Snap) {
  snap = next;
  for (const fn of listeners) fn();
}

export type Cmd =
  | { t: "start" }
  | { t: "again" }
  | { t: "next" }
  | { t: "title" }
  | { t: "mute" }
  | { t: "pause" }
  | { t: "level"; n: number };

const queue: Cmd[] = [];

export function send(cmd: Cmd) {
  queue.push(cmd);
}

export function drain(): Cmd[] {
  return queue.splice(0, queue.length);
}

let held = false;
let edges = 0;

export function pressFlap() {
  if (!held) edges += 1;
  held = true;
}

let boostReq = false;
export function pressBoost() {
  boostReq = true;
}
export function takeBoost() {
  const b = boostReq;
  boostReq = false;
  return b;
}

export function releaseFlap() {
  held = false;
}

export function flapHeld() {
  return held;
}

export function takeFlaps() {
  const n = edges;
  edges = 0;
  return n;
}

let testKeys: Set<string> | null = null;

export function getTestKeys() {
  return testKeys;
}

export function setTestKeys(codes: string[]) {
  testKeys = new Set(codes);
}

export function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const hund = Math.floor((safe % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, "0")}.${hund.toString().padStart(2, "0")}`;
}
