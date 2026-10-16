# Roadstermania

Free browser game. No account.

Tap to roll over traffic. Hold to climb or stick to a tunnel ceiling. Let go to hover.

## GitHub Pages

The root of `main` is the built game. Turn on Pages from the `main` branch, folder `/` (root).

Live site: https://skywalking-luke.github.io/reveal-run/

Do not add sign-in. Do not change the game.

## Rebuild

```bash
npm install
npx vite build --config vite.mania.config.ts
cp mania-dist/host/index.html index.html
cp -a mania-dist/assets mania-dist/sprites mania-dist/cabin.jpg mania-dist/favicon.svg mania-dist/og.jpg mania-dist/x-banner.jpg .
```

The Vite `base` is `/reveal-run/`. Keep that if the repo name stays `reveal-run`.
