import { useState, useSyncExternalStore, type ReactNode } from "react";
import { unlockAudio } from "@/game/audio";
import {
  formatTime,
  getBoard,
  getLastName,
  getScores,
  getSnap,
  isRunSaved,
  pressFlap,
  qualifies,
  releaseFlap,
  send,
  submitScore,
  subscribe,
  type Snap,
} from "@/game/store";

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
      {false /* home link disabled */ ? (
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
          <div className="score-hud" aria-label="Score">
            <strong>{snap.score.toLocaleString()}</strong>
            {snap.combo > 1 ? <span className="combo">COMBO x{snap.combo}</span> : null}
          </div>
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
          <kbd>LET GO</kbd> fall back to the road
        </li>
        <li className="howto-score">Roll over cars for +100. Chain rolls before landing for up to x5.</li>
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
      <Breakdown snap={snap} />
      <SaveScore snap={snap} />
      <p className="result-help">Hold climbs. A tap rolls. Let go and you drop.</p>
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
      <Breakdown snap={snap} />
      <SaveScore snap={snap} clear />
      <div className="result-actions">
        <button type="button" onClick={() => send({ t: "next" })}>
          NEXT · FASTER
        </button>
        <button type="button" onClick={() => send({ t: "title" })}>
          TITLE
        </button>
      </div>
    </div>
  );
}

function Breakdown({ snap }: { snap: Snap }) {
  const b = snap.breakdown;
  const rows: [string, number][] = [
    ["DISTANCE", b.distance],
    ["CARS PASSED", b.passes],
    [`ROLLS · ${b.rolls} OVER CARS${b.bestCombo > 1 ? ` · x${b.bestCombo}` : ""}`, b.rollPts],
    ["CEILING", b.ceiling],
  ];
  if (b.clear) rows.push([`LEVEL ${snap.level} CLEAR`, b.clear]);
  if (snap.carried) rows.unshift(["EARLIER LEVELS", snap.carried]);
  return (
    <div className="breakdown" aria-label="Score breakdown">
      {rows.map(([k, v]) => (
        <p key={k}>
          <span>{k}</span>
          <span>{v.toLocaleString()}</span>
        </p>
      ))}
      <p className="total">
        <span>TOTAL</span>
        <span>{snap.score.toLocaleString()}</span>
      </p>
    </div>
  );
}

function SaveScore({ snap, clear }: { snap: Snap; clear?: boolean }) {
  const [name, setName] = useState(getLastName());
  const [rank, setRank] = useState(0);
  if (rank) return <p className="saved">SAVED · #{rank} ON THIS DEVICE</p>;
  if (isRunSaved(snap.runId) || !qualifies(snap.score)) return null;
  return (
    <form
      className="name-entry"
      onSubmit={(e) => {
        e.preventDefault();
        const r = submitScore(snap.runId, name, snap.score, snap.level, snap.breakdown.rolls);
        setRank(r || -1);
      }}
    >
      <label htmlFor="initials">{clear ? "BANK RUN" : "TOP 10!"} INITIALS</label>
      <input
        id="initials"
        value={name}
        maxLength={3}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        onChange={(e) => setName(e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 3))}
        placeholder="AAA"
      />
      <button type="submit">SAVE</button>
    </form>
  );
}

function Board({ onClose }: { onClose: () => void }) {
  const rows = getScores();
  const times = getBoard();
  return (
    <div className="sheet" role="dialog" aria-label="Leaderboard">
      <div className="sheet-head">
        <h2>TOP 10 · THIS DEVICE</h2>
        <button type="button" aria-label="Close leaderboard" onClick={onClose}>
          ×
        </button>
      </div>
      {rows.length === 0 ? <p className="sheet-empty">No scores yet. Finish a run to set the first one.</p> : null}
      <ol className="scores">
        {rows.map((row, i) => (
          <li key={`${row.at}-${i}`}>
            <span>
              {String(i + 1).padStart(2, "0")} {row.name}
            </span>
            <span>LV {row.level}</span>
            <strong>{row.score.toLocaleString()}</strong>
          </li>
        ))}
      </ol>
      {times.length ? (
        <>
          <h3>BEST LAP TIMES</h3>
          <ol>
            {times.map((row) => (
              <li key={row.level}>
                <span>LV {String(row.level).padStart(2, "0")}</span>
                <span>{formatTime(row.ms / 1000)}</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}
