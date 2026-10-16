import { useState, useSyncExternalStore, type ReactNode } from "react";
import { unlockAudio } from "@/game/audio";
import { formatTime, getBoard, getSnap, pressFlap, releaseFlap, send, subscribe } from "@/game/store";

export function Frame({ children }: { children: ReactNode }) {
  const snap = useSyncExternalStore(subscribe, getSnap, getSnap);
  return (
    <main className="cabin">
      <section className={`screen phase-${snap.phase}`} aria-label="Roadster Mania">
        <div className="viewport" data-phase={snap.phase}>
          {children}
          <div className="scanlines" aria-hidden="true" />
          <Overlay />
        </div>
        {snap.phase === "title" ? null : <Console />}
      </section>
    </main>
  );
}

function Overlay() {
  const snap = useSyncExternalStore(subscribe, getSnap, getSnap);
  const [board, setBoard] = useState(false);
  return (
    <div className="overlay">
      <button type="button" className="board-open" onClick={() => setBoard(true)}>
        LEADERBOARD
      </button>
      {import.meta.env.BASE_URL.includes("mania") ? (
        <a className="site-home" href="/">
          LH CARS
        </a>
      ) : null}
      {snap.phase === "title" ? (
        <button
          type="button"
          className="sound-chip"
          onClick={() => {
            unlockAudio();
            send({ t: "mute" });
          }}
        >
          {snap.muted ? "SOUND OFF" : "SOUND ON"}
        </button>
      ) : null}
      {snap.phase === "title" ? <Title /> : null}
      {snap.phase === "run" && !snap.paused ? (
        <>
          <p className="live-tip" role="status" aria-live="polite">
            {snap.hint}
          </p>
          <button
            type="button"
            className="hold-pad"
            aria-label="Hold to climb. Tap to roll."
            onPointerDown={(e) => {
              e.preventDefault();
              unlockAudio();
              pressFlap();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              releaseFlap();
            }}
            onPointerCancel={() => releaseFlap()}
          >
            HOLD
          </button>
        </>
      ) : null}
      {snap.paused ? <Paused /> : null}
      {snap.phase === "crash" ? <Crash /> : null}
      {snap.phase === "clear" ? <Clear /> : null}
      {board ? <Board onClose={() => setBoard(false)} /> : null}
    </div>
  );
}

function Title() {
  const snap = useSyncExternalStore(subscribe, getSnap, getSnap);
  return (
    <div className="title-screen">
      <div className="stars" aria-hidden="true" />
      <div className="mark">
        <p className="led">ROADSTER</p>
        <p className="script">Mania</p>
      </div>
      <div className="horizon" aria-hidden="true" />
      <div className="grid-floor" aria-hidden="true">
        <div className="grid-plane" />
      </div>
      <ul className="howto">
        <li>
          <kbd>TAP</kbd> roll over cars
        </li>
        <li>
          <kbd>HOLD</kbd> climb or stick to the ceiling
        </li>
        <li>
          <kbd>LET GO</kbd> settle back to the hover
        </li>
      </ul>
      <button
        type="button"
        className="start-btn"
        onClick={() => {
          unlockAudio();
          send({ t: "start" });
        }}
      >
        TAP TO START
      </button>
      <div className="level-row">
        <button
          type="button"
          disabled={snap.level <= 1}
          onClick={() => send({ t: "level", n: snap.level - 1 })}
        >
          PREV
        </button>
        <span>
          LV {String(snap.level).padStart(2, "0")}
          {snap.bestMs != null ? ` · BEST ${formatTime(snap.bestMs / 1000)}` : ""}
        </span>
        <button
          type="button"
          disabled={snap.level >= snap.unlocked}
          onClick={() => send({ t: "level", n: snap.level + 1 })}
        >
          NEXT
        </button>
      </div>
    </div>
  );
}

function Console() {
  const snap = useSyncExternalStore(subscribe, getSnap, getSnap);
  const done = snap.phase === "crash" || snap.phase === "clear";
  return (
    <div className="console">
      {done ? (
        <div className="run-stats" role="group" aria-label="Run results">
          <div>
            <span>LEVEL</span>
            <strong>{String(snap.level).padStart(2, "0")}</strong>
          </div>
          <div>
            <span>TIME</span>
            <strong>{formatTime(snap.time)}</strong>
          </div>
          <div>
            <span>ROLLS</span>
            <strong>{snap.flips}</strong>
          </div>
        </div>
      ) : (
        <div className="gauges" aria-label="Live vehicle telemetry">
          <div className="gauge">
            <p className="gauge-label">DOWNFORCE</p>
            <div className="gauge-ring">
              <span>
                {Math.round(snap.downforce)}
                <small>%</small>
              </span>
            </div>
          </div>
          <div className="gauge">
            <p className="gauge-label">ORBIT</p>
            <div className="orbit" aria-hidden="true">
              <div className="orbit-car" style={{ transform: `rotate(${snap.roll}rad)` }} />
            </div>
          </div>
          <div className="gauge">
            <p className="gauge-label">THRUSTERS</p>
            <div className={`thrusters${snap.thrust ? " lit" : ""}`} aria-hidden="true">
              <i className={snap.thrust ? "on" : ""} />
              <i className={snap.thrust ? "on" : ""} />
              <i className={snap.thrust ? "on" : ""} />
              <i className={snap.thrust ? "on" : ""} />
            </div>
          </div>
          <div className="gauge">
            <p className="gauge-label">ALTITUDE</p>
            <div className="gauge-ring">
              <span>
                {snap.alt.toFixed(1)}
                <small>FT</small>
              </span>
            </div>
          </div>
        </div>
      )}
      <div className="console-side">
        <button
          type="button"
          aria-label={snap.muted ? "Unmute" : "Mute"}
          onClick={() => {
            unlockAudio();
            send({ t: "mute" });
          }}
        >
          {snap.muted ? "♪̸" : "♪"}
        </button>
        {snap.phase === "run" ? (
          <button type="button" aria-label="Pause" onClick={() => send({ t: "pause" })}>
            II
          </button>
        ) : null}
        <button type="button" aria-label="Retry" onClick={() => send({ t: "again" })}>
          ↻
        </button>
      </div>
    </div>
  );
}

function Paused() {
  return (
    <div className="result" role="dialog" aria-label="Paused">
      <p className="kicker">PAUSED</p>
      <h2>TAKE A BREATH</h2>
      <p className="result-help">Space or the HOLD pad. Esc resumes.</p>
      <div className="result-actions">
        <button type="button" onClick={() => send({ t: "pause" })}>
          RESUME
        </button>
        <button type="button" onClick={() => send({ t: "title" })}>
          TITLE
        </button>
      </div>
    </div>
  );
}

function Crash() {
  const snap = useSyncExternalStore(subscribe, getSnap, getSnap);
  return (
    <div className="result">
      <p className="kicker">CRASH</p>
      <h2>{snap.reason || "Down"}</h2>
      <p className="result-help">Hold climbs. A tap rolls. Let go to hover.</p>
      <div className="result-actions">
        <button type="button" onClick={() => send({ t: "again" })}>
          RETRY
        </button>
        <button type="button" onClick={() => send({ t: "title" })}>
          TITLE
        </button>
      </div>
    </div>
  );
}

function Clear() {
  const snap = useSyncExternalStore(subscribe, getSnap, getSnap);
  return (
    <div className="result">
      <p className="kicker">LAP CLEAR</p>
      <h2>LEVEL {String(snap.level).padStart(2, "0")}</h2>
      <div className="result-actions">
        <button type="button" onClick={() => send({ t: "next" })}>
          NEXT
        </button>
        <button type="button" onClick={() => send({ t: "title" })}>
          TITLE
        </button>
      </div>
    </div>
  );
}

function Board({ onClose }: { onClose: () => void }) {
  const rows = getBoard();
  return (
    <div className="sheet" role="dialog" aria-label="Leaderboard">
      <div className="sheet-head">
        <h2>LEADERBOARD</h2>
        <button type="button" aria-label="Close leaderboard" onClick={onClose}>
          ×
        </button>
      </div>
      {rows.length === 0 ? <p className="sheet-empty">No runs yet. Set the first time.</p> : null}
      <ol>
        {rows.map((row) => (
          <li key={row.level}>
            <span>LV {String(row.level).padStart(2, "0")}</span>
            <span>{formatTime(row.ms / 1000)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
