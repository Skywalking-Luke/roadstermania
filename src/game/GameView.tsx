import { useEffect, useRef, useState } from "react";
import { runGame } from "@/game/runGame";

export function GameView() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let stop = () => {};
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        stop = runGame(canvas).stop;
      } catch (err) {
        setError(err instanceof Error ? err.message : "The road failed to load.");
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
      stop();
    };
  }, []);

  return (
    <>
      <canvas ref={ref} />
      {error ? (
        <p className="absolute inset-x-0 top-6 z-30 px-6 text-center text-sm text-hot">{error}</p>
      ) : null}
    </>
  );
}
