import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Frame } from "@/game/Hud";
import { GameView } from "@/game/GameView";
import "@/styles.css";

const root = document.documentElement;
root.style.setProperty("--cabin", `url("${import.meta.env.BASE_URL}cabin.jpg")`);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Frame>
      <GameView />
    </Frame>
  </StrictMode>,
);
