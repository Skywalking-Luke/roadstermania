import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { unlockAudio } from "@/game/audio";
import {
  formatTime,
  getBoard,
  getLastName,
  getScores,
  getSnap,
  isRunSaved,
  pressBoost,
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
      <FullscreenButton />
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
            <span className="run-timer">
              LV {String(snap.level).padStart(2, "0")} · {formatTime(snap.runTime)}
            </span>
            <span className="progress" role="progressbar" aria-label="Distance to finish" aria-valuenow={Math.round(snap.progress * 100)}>
              <b style={{ width: `${Math.round(snap.progress * 100)}%` }} />
              <i>🏁</i>
            </span>
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
          <button
            type="button"
            className={`boost-pad${snap.boostCharges > 0 ? " ready" : ""}${snap.boosting ? " firing" : ""}`}
            aria-label={`Boost, ${snap.boostCharges} charges`}
            disabled={snap.boostCharges === 0 && !snap.boosting}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              unlockAudio();
              pressBoost();
            }}
          >
            <span>BOOST</span>
            <span className="pips" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <i key={i} className={i < snap.boostCharges ? "on" : ""} />
              ))}
            </span>
            <span className="fill" aria-hidden="true">
              <b style={{ width: `${Math.round(Math.max(0, Math.min(1, snap.boostFill)) * 100)}%` }} />
            </span>
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
        <li className="howto-score">Every 5000 pts = 1 BOOST (max 3). BOOST button, Shift or B.</li>
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
            <span>RUN TIME</span>
            <strong>{formatTime(snap.runTime)}</strong>
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

type LHAdsApi = {
  rewardEnabled?: boolean;
  banner?: (el: HTMLElement) => void;
  offerReward?: (onAvailable: (show: () => Promise<boolean>) => void) => void;
};
const lhAds = () => (window as unknown as { LHAds?: LHAdsApi }).LHAds;

function AdBanner() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (el) lhAds()?.banner?.(el);
  }, [el]);
  return <div ref={setEl} className="lh-ad" style={{ display: "none", margin: "8px auto", maxWidth: 728, width: "100%" }} />;
}

function ContinueAd() {
  const [show, setShow] = useState<null | (() => Promise<boolean>)>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    const ads = lhAds();
    if (!ads?.rewardEnabled || (window as unknown as { __rrContUsed?: boolean }).__rrContUsed) return;
    ads.offerReward?.((fn) => {
      if (live) setShow(() => fn);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        show().then((ok) => {
          setShow(null);
          if (ok) send({ t: "cont" });
        });
      }}
    >
      ▶ WATCH AD TO CONTINUE
    </button>
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
      <AdBanner />
      <div className="result-actions">
        <ContinueAd />
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
      <AdBanner />
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

function FullscreenButton() {
  const doc = typeof document !== "undefined" ? (document as Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void }) : null;
  const supported = !!doc && (doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!doc) return;
    const sync = () => setOn(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    doc.addEventListener("fullscreenchange", sync);
    doc.addEventListener("webkitfullscreenchange", sync);
    return () => {
      doc.removeEventListener("fullscreenchange", sync);
      doc.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [doc]);
  if (!supported || !doc) return null;
  return (
    <button
      type="button"
      className="fs-btn"
      aria-label={on ? "Exit fullscreen" : "Fullscreen"}
      onClick={() => {
        const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
        if (on) {
          if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => {});
          else doc.webkitExitFullscreen?.();
        } else if (el.requestFullscreen) {
          void el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
        } else el.webkitRequestFullscreen?.();
      }}
    >
      {on ? "⤡" : "⛶"}
    </button>
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
      <p className="total">
        <span>RUN TIME</span>
        <span>{formatTime(snap.runTime)}</span>
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
        const r = submitScore(snap.runId, name, snap.score, snap.level, snap.breakdown.rolls, snap.runTime);
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
            <span className="t">{row.time == null ? "—" : formatTime(row.time)}</span>
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
