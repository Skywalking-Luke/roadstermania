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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Frame>
      <GameView />
    </Frame>
  </StrictMode>,
);
