export type Sprites = {
  hero: HTMLCanvasElement | null;
  cars: (HTMLCanvasElement | null)[];
};

function crunch(img: HTMLImageElement, w: number) {
  const h = Math.max(1, Math.round((w * img.naturalHeight) / img.naturalWidth));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.imageSmoothingEnabled = true;
  g.drawImage(img, 0, 0, w, h);
  return canvas;
}

function load(src: string, w: number, set: (c: HTMLCanvasElement) => void) {
  const img = new Image();
  img.onload = () => {
    const c = crunch(img, w);
    if (c) set(c);
  };
  img.src = src;
}

export function loadSprites(base = `${(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/")}sprites`): Sprites {
  const out: Sprites = { hero: null, cars: [null, null, null, null] };
  load(`${base}/roadster.png`, 48, (c) => {
    out.hero = c;
  });
  for (let i = 0; i < 4; i++) {
    load(`${base}/car-${i + 1}.png`, 40, (c) => {
      out.cars[i] = c;
    });
  }
  return out;
}
