import { GROUND, PH, PW, ROOF, VH, VW, WALL, type CarObs } from "@/game/course";
import { boostLevel, type Sim } from "@/game/sim";
import type { Sprites } from "@/game/sprites";

type Part = { x: number; y: number; vx: number; vy: number; life: number; color: string; gas?: boolean; max?: number };

const GAS = ["#ffffff", "#e8eef4", "#cfd9e3", "#b9c6d2"];

const SKY = ["#010203", "#05060a", "#12080c"];

export function createRenderer() {
  const parts: Part[] = [];
  let flame = 0;
  let wasGround = true;

  function burst(x: number, y: number, color: string, n: number, sp: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = sp * (0.4 + Math.random());
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35 + Math.random() * 0.3, color });
    }
  }

  /** Cold-gas vapour from the front and back wheel nozzles, pushed downward. */
  function vent(sim: Sim, strength: number) {
    const p = sim.player;
    if (p.stuck) return;
    const cx = p.x + PW / 2;
    const cy = p.y + PH / 2;
    const c = Math.cos(p.angle);
    const sn = Math.sin(p.angle);
    const flip = Math.cos(p.roll) < 0 ? -1 : 1;
    for (const wx of [-11, 10]) {
      const ly = (PH / 2) * flip;
      const x = cx + wx * c - ly * sn;
      const y = cy + wx * sn + ly * c;
      const n = Math.max(1, Math.round(strength));
      for (let i = 0; i < n; i++) {
        const life = 0.3 + Math.random() * 0.35;
        parts.push({
          x: x + (Math.random() - 0.5) * 2,
          y,
          vx: (Math.random() - 0.5) * 22 - 18,
          vy: (60 + Math.random() * 50) * flip,
          life,
          max: life,
          color: GAS[Math.floor(Math.random() * GAS.length)],
          gas: true,
        });
      }
    }
  }

  /** Horizontal cold-gas jets out the rear during a forward boost. */
  function exhaust(sim: Sim, level: number) {
    const p = sim.player;
    const n = 1 + Math.round(level * 3);
    for (let i = 0; i < n; i++) {
      const life = 0.25 + Math.random() * 0.3;
      parts.push({
        x: p.x - 2,
        y: p.y + PH * 0.45 + (Math.random() - 0.5) * 4,
        vx: -(120 + Math.random() * 90) * level,
        vy: (Math.random() - 0.5) * 14,
        life,
        max: life,
        color: GAS[Math.floor(Math.random() * GAS.length)],
        gas: true,
      });
    }
  }

  return {
    reset() {
      parts.length = 0;
      flame = 0;
      wasGround = true;
    },
    draw(
      ctx: CanvasRenderingContext2D,
      sim: Sim,
      sprites: Sprites,
      clock: number,
      fx: { flap: boolean; flip: boolean; crash: boolean; landed: boolean },
      reduce: boolean,
    ) {
      const cam = sim.player.x - 86;
      const shake = reduce ? 0 : sim.shake;
      const ox = shake > 0.2 ? Math.round((Math.random() - 0.5) * shake * 1.4) : 0;
      const oy = shake > 0.2 ? Math.round((Math.random() - 0.5) * shake) : 0;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = SKY[0];
      ctx.fillRect(0, 0, VW, VH);

      const bands = [0, 70, 120];
      for (let i = 0; i < SKY.length; i++) {
        ctx.fillStyle = SKY[i];
        const y0 = bands[i];
        const y1 = i === SKY.length - 1 ? GROUND : bands[i + 1];
        ctx.fillRect(0, y0, VW, y1 - y0);
      }

      ctx.fillStyle = "#d5e4ee";
      for (let i = 0; i < 36; i++) {
        const tw = 0.2 + (i % 5) * 0.04;
        const sx = Math.floor((i * 53 + clock * tw * 8) % VW);
        const sy = (i * 17) % 78;
        ctx.globalAlpha = 0.35 + (i % 4) * 0.15;
        ctx.fillRect(sx, sy, 1, 1);
      }
      ctx.globalAlpha = 1;

      const mesa = (parallax: number, color: string, base: number, h: number, w: number, gap: number) => {
        ctx.fillStyle = color;
        const scroll = Math.floor(cam * parallax);
        for (let x = -((scroll % gap) + gap); x < VW + gap; x += gap) {
          ctx.fillRect(x, base, w, h);
          ctx.fillRect(x + 8, base - 10, Math.max(8, w - 22), 10);
        }
      };
      mesa(0.12, "#140c10", 108, 50, 70, 120);
      mesa(0.22, "#1c1014", 124, 34, 40, 84);

      const towerScroll = Math.floor(cam * 0.35);
      const towerGap = 210;
      for (let x = -((towerScroll % towerGap) + towerGap); x < VW + towerGap; x += towerGap) {
        const tx = x + 30;
        ctx.fillStyle = "#1c1e22";
        ctx.fillRect(tx, 78, 2, GROUND - 78);
        ctx.fillRect(tx + 8, 78, 1, GROUND - 78);
        ctx.fillStyle = "#2a2428";
        ctx.fillRect(tx - 5, 74, 18, 4);
        ctx.fillStyle = "#e7f3ef";
        ctx.fillRect(tx - 3, 72, 3, 2);
        ctx.fillRect(tx + 4, 72, 3, 2);
        ctx.fillStyle = "#8eb8cc22";
        ctx.beginPath();
        ctx.moveTo(tx + 4, 72);
        ctx.lineTo(tx - 4, 18);
        ctx.lineTo(tx + 12, 18);
        ctx.closePath();
        ctx.fill();
      }

      ctx.save();
      ctx.translate(ox, oy);

      for (const tun of sim.course.tunnels) {
        const x = Math.round(tun.x - cam);
        const w = tun.len;
        ctx.fillStyle = "#2c261f";
        ctx.fillRect(x, 0, w, tun.ceil);
        ctx.fillStyle = "#07080c";
        ctx.fillRect(x + WALL, tun.ceil, w - WALL * 2, GROUND - tun.ceil);
        ctx.fillStyle = "#ff3a2418";
        ctx.fillRect(x + WALL, tun.ceil, w - WALL * 2, 6);
        ctx.fillRect(x + WALL, GROUND - 6, w - WALL * 2, 6);
        ctx.fillStyle = "#ff4a32";
        for (let lx = x + 16; lx < x + w - 10; lx += 18) ctx.fillRect(lx, tun.ceil + 2, 5, 1);
        ctx.fillStyle = "#3a342c";
        ctx.fillRect(x, tun.ceil - 4, WALL, 4);
        ctx.fillRect(x + w - WALL, tun.ceil - 4, WALL, 4);
      }

      ctx.fillStyle = "#07090c";
      ctx.fillRect(0, GROUND, VW, VH - GROUND);
      ctx.fillStyle = "#ff3218";
      ctx.fillRect(0, GROUND, VW, 1);
      ctx.fillStyle = "#ff6a48";
      ctx.fillRect(0, Math.min(VH - 1, GROUND + 7), VW, 1);
      ctx.fillStyle = "#ff2a1410";
      ctx.fillRect(0, GROUND - 8, VW, 10);

      for (const toll of sim.course.tolls) {
        const gapH = PH + toll.gapSlack;
        const gapTop = toll.high ? ROOF : GROUND - gapH;
        const x0 = Math.round(toll.x - toll.roofLead - cam);
        const gate = Math.round(toll.x - cam);
        ctx.fillStyle = "#1c2028";
        ctx.fillRect(x0, ROOF - 8, toll.roofLead + WALL, 8);
        ctx.fillStyle = "#ff4a32";
        ctx.fillRect(x0, ROOF - 8, toll.roofLead + WALL, 1);
        ctx.fillStyle = "#12151c";
        if (gapTop > 0) ctx.fillRect(gate, 0, WALL, gapTop);
        const lower = gapTop + gapH;
        if (lower < GROUND) ctx.fillRect(gate, lower, WALL, GROUND - lower);
        ctx.fillStyle = "#243044";
        ctx.fillRect(gate + 2, gapTop, WALL - 4, gapH);
        ctx.fillStyle = "#3ddc97";
        ctx.fillRect(gate - 2, gapTop, 3, gapH);
        ctx.fillRect(gate + WALL - 1, gapTop, 3, gapH);
        ctx.fillRect(gate - 16, GROUND - 5, 10, 2);
        ctx.fillRect(gate - 8, GROUND - 8, 2, 6);
        ctx.fillStyle = "#0c0d10";
        ctx.fillRect(x0 + 8, ROOF - 22, 28, 12);
        ctx.fillStyle = toll.high ? "#ffb089" : "#7dffc3";
        ctx.font = "7px monospace";
        ctx.fillText(toll.high ? "HIGH" : "LOW", x0 + 11, ROOF - 13);
      }

      for (const arm of sim.course.arms) {
        const x = Math.round(arm.x - cam);
        ctx.fillStyle = "#141618";
        ctx.fillRect(x + 1, 36, 6, GROUND - 36);
        ctx.fillStyle = "#2a2e32";
        ctx.fillRect(x - 6, 30, 20, 12);
        const lamp = arm.red ? "#ff2a1c" : "#3ee08a";
        ctx.fillStyle = lamp;
        ctx.fillRect(x - 4, 32, 4, 4);
        ctx.fillRect(x + 2, 32, 4, 4);
        ctx.fillRect(x + 8, 32, 4, 4);
        if (arm.red) {
          ctx.fillStyle = "#ff2a1c";
          ctx.fillRect(x, GROUND - arm.barH, 8, arm.barH);
          ctx.fillStyle = "#ffd0c4";
          ctx.fillRect(x, GROUND - arm.barH, 8, 2);
          ctx.fillStyle = "#ff2a1828";
          ctx.fillRect(x - 10, GROUND - 6, 28, 6);
        } else {
          ctx.fillStyle = "#3ee08a";
          ctx.fillRect(x - 2, 44, 12, 3);
        }
      }

      for (const car of sim.course.cars) drawCar(ctx, sprites, car, cam);
      for (const tun of sim.course.tunnels) for (const car of tun.cars) drawCar(ctx, sprites, car, cam);

      // Checkered finish line across the road + FINISH board.
      const fl = Math.round(sim.course.finish + PW - cam);
      if (fl > -40 && fl < VW + 40) {
        for (let r = 0; r < 4; r++)
          for (let c = 0; c < 2; c++) {
            ctx.fillStyle = (r + c) % 2 ? "#111" : "#f4f4f4";
            ctx.fillRect(fl + c * 3, GROUND + 1 + r * 3, 3, 3);
          }
        ctx.fillStyle = "#f4f4f4";
        ctx.fillRect(fl, GROUND - 60, 1, 60);
        ctx.font = "7px monospace";
        ctx.fillText("FINISH", fl - 12, GROUND - 52);
      }
      const arch = Math.round(sim.course.finish - cam);
      ctx.fillStyle = "#ff4a32";
      ctx.fillRect(arch, GROUND - 48, 3, 48);
      ctx.fillRect(arch + 36, GROUND - 48, 3, 48);
      ctx.fillRect(arch, GROUND - 48, 39, 3);
      ctx.fillStyle = "#ffe8e0";
      ctx.fillRect(arch + 8, GROUND - 46, 4, 2);
      ctx.fillRect(arch + 16, GROUND - 46, 4, 2);
      ctx.fillRect(arch + 24, GROUND - 46, 4, 2);

      const p = sim.player;
      if (fx.flap) {
        flame = 0.18;
        vent(sim, 5);
      }
      if (sim.phase === "run" && !sim.paused && (flame > 0 || p.vy < -18)) vent(sim, flame > 0.1 ? 2 : 1);
      const bl = boostLevel(sim.boost);
      if (bl > 0.05 && sim.phase === "run" && !sim.paused) exhaust(sim, bl);
      if (fx.flip) burst(p.x + PW * 0.5, p.y, "#dfe8f0", 10, 42);
      if (fx.crash) burst(p.x + PW * 0.5, p.y + PH * 0.5, "#ff3b30", 16, 70);
      if (fx.landed && !wasGround) burst(p.x + 6, GROUND, "#a39e93", 5, 24);
      wasGround = p.grounded || p.stuck;
      flame = Math.max(0, flame - 1 / 60);

      for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i];
        part.life -= 1 / 60;
        part.x += part.vx / 60;
        part.y += part.vy / 60;
        if (part.gas) {
          part.vx *= 0.93;
          part.vy *= 0.9;
          if (part.y > GROUND - 1) {
            part.y = GROUND - 1;
            part.vy = 0;
            part.vx -= 1.5;
          }
        } else part.vy += 80 / 60;
        if (part.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        if (part.gas) {
          const t = 1 - part.life / (part.max ?? 0.5);
          const sz = 1 + Math.round(t * 5);
          ctx.globalAlpha = Math.max(0, 0.75 * (1 - t));
          ctx.fillStyle = part.color;
          ctx.fillRect(Math.round(part.x - cam - sz / 2), Math.round(part.y - sz / 2), sz, sz);
          ctx.globalAlpha = 1;
          continue;
        }
        ctx.globalAlpha = Math.max(0, part.life * 2);
        ctx.fillStyle = part.color;
        ctx.fillRect(Math.round(part.x - cam), Math.round(part.y), 2, 2);
        ctx.globalAlpha = 1;
      }

      const lift = Math.max(0, GROUND - (p.y + PH));
      ctx.globalAlpha = Math.max(0.12, 0.4 - lift / 90);
      ctx.fillStyle = "#000";
      ctx.fillRect(Math.round(p.x - cam + 4), GROUND - 1, 28, 2);
      ctx.globalAlpha = 1;

      drawHero(ctx, sprites, sim, cam, flame);

      ctx.font = "8px monospace";
      ctx.fillStyle = "#ffb089";
      for (const pop of sim.popups) {
        ctx.globalAlpha = Math.min(1, pop.life * 2);
        ctx.fillText(pop.text, Math.round(pop.x - cam), Math.round(pop.y));
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    },
  };
}

function drawCar(ctx: CanvasRenderingContext2D, sprites: Sprites, car: CarObs, cam: number) {
  const x = Math.round(car.x - cam);
  const y = Math.round(car.y);
  const img = sprites.cars[car.frame];
  if (img) {
    ctx.drawImage(img, x, y, car.w, car.h);
    return;
  }
  ctx.fillStyle = "#8a8178";
  ctx.fillRect(x, y + 3, car.w, car.h - 3);
  ctx.fillStyle = "#d9cbb8";
  ctx.fillRect(x + 4, y, Math.max(4, car.w - 14), 4);
}

function drawHero(
  ctx: CanvasRenderingContext2D,
  sprites: Sprites,
  sim: Sim,
  cam: number,
  flame: number,
) {
  const p = sim.player;
  const dx = Math.round(p.x - cam + PW / 2);
  const dy = Math.round(p.y + PH / 2);
  ctx.save();
  ctx.translate(dx, dy);
  ctx.rotate(p.stuck ? 0 : p.angle);
  if (p.stuck) ctx.scale(1, -1);
  else {
    const squash = Math.cos(p.roll);
    if (Math.abs(squash) < 0.08) {
      ctx.fillStyle = "#d5dde0";
      ctx.fillRect(-18, -1, 36, 2);
    }
    ctx.scale(1, squash === 0 ? 0.08 : squash);
  }
  const dw = 36;
  const dh = 11;
  const top = PH / 2 - dh;
  const burning = flame > 0 || p.vy < -18 || p.spin > 2;
  const bl = boostLevel(sim.boost);
  if (bl > 0.05) {
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-dw / 2 - 3, top + 4, 3, 3);
    ctx.fillStyle = "#d4e0ea";
    ctx.globalAlpha = 0.5 * bl;
    ctx.fillRect(-dw / 2 - 3 - Math.round(10 * bl), top + 3, Math.round(10 * bl), 5);
    ctx.globalAlpha = 1;
  }
  if (burning && !p.stuck) {
    // Cold-gas jets straight down from the front and back wheel nozzles.
    const len = 4 + Math.round(Math.min(1, flame * 6 + Math.max(0, -p.vy) / 120) * 6);
    for (const wx of [-12, 9]) {
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.9;
      ctx.fillRect(wx, top + dh, 3, 2);
      ctx.fillStyle = "#dce6ef";
      ctx.globalAlpha = 0.55;
      ctx.fillRect(wx - 1, top + dh + 2, 5, Math.ceil(len / 2));
      ctx.fillStyle = "#b9c6d2";
      ctx.globalAlpha = 0.25;
      ctx.fillRect(wx - 2, top + dh + 2 + Math.ceil(len / 2), 7, Math.ceil(len / 2));
      ctx.globalAlpha = 1;
    }
  }
  if (sprites.hero) {
    ctx.drawImage(sprites.hero, -dw / 2, top, dw, dh);
  } else {
    ctx.fillStyle = "#e7ecee";
    ctx.fillRect(-18, top + 3, 36, 8);
    ctx.fillStyle = "#9aa3a8";
    ctx.fillRect(-6, top + 1, 14, 4);
    ctx.fillStyle = "#ff2a1c";
    ctx.fillRect(16, top + 5, 3, 3);
    ctx.fillStyle = "#121416";
    ctx.fillRect(-14, top + dh - 4, 5, 4);
    ctx.fillRect(8, top + dh - 4, 5, 4);
  }
  ctx.restore();
}
