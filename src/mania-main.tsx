import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Frame } from "@/game/Hud";
import { GameView } from "@/game/GameView";
import "@/styles.css";

const root = document.documentElement;
root.style.setProperty("--cabin", `url("${import.meta.env.BASE_URL}cabin.jpg")`);

// No pinch / double-tap zoom (iOS Safari ignores user-scalable=no).
const stop = (e: Event) => e.preventDefault();
document.addEventListener("gesturestart", stop, { passive: false });
document.addEventListener("gesturechange", stop, { passive: false });
document.addEventListener("dblclick", stop, { passive: false });
document.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false },
);
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1 || ((e as TouchEvent & { scale?: number }).scale ?? 1) !== 1) e.preventDefault();
  },
  { passive: false },
);
let lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  (e) => {
    const now = e.timeStamp;
    const t = e.target as HTMLElement | null;
    if (now - lastTouchEnd < 350 && !t?.closest("input")) e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);

// Cache safeguards: drop any old service worker/caches, and if this page is an
// out-of-date copy (GitHub Pages caches HTML ~10 min), reload once onto the new build.
if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister())).catch(() => {});
}
if ("caches" in window) void caches.keys().then((ks) => ks.forEach((k) => void caches.delete(k))).catch(() => {});
(() => {
  const mine = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.src;
  if (!mine) return;
  fetch(`${location.pathname}?fresh=${Date.now()}`, { cache: "no-store" })
    .then((r) => r.text())
    .then((html) => {
      const m = html.match(/assets\/index-[\w-]+\.js/);
      if (!m || mine.includes(m[0])) return;
      if (sessionStorage.getItem("rm-reloaded") === m[0]) return;
      sessionStorage.setItem("rm-reloaded", m[0]);
      location.replace(`${location.pathname}?v=${m[0].slice(13, 21)}`);
    })
    .catch(() => {});
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Frame>
      <GameView />
    </Frame>
  </StrictMode>,
);
