// Draws one frame of the game. Reads game and view state; changes neither,
// apart from the confetti it is handed.

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { BEAT_TIMES, DURATION, currentMove, totalScore, trophyTier, type GameState } from '../core/game';
import type { Verdict } from '../core/judging';
import { MOVES, demoShape, duoPartner } from '../core/moves';
import type { Shape } from '../core/shape';
import type { Frame } from '../vision/replay';
import type { Confetti } from './confetti';
import { drawGlove, drawMascot, type Mood } from './mascot';
import { C, PLAYER_COLORS, emojiFont, font } from './palette';

export interface RoundExtras {
  verdict: Verdict;
  claudePending: boolean;
  photo: ImageBitmap | null;
  clip: Frame[];
}

export interface View {
  video: HTMLVideoElement;
  landmarks: (NormalizedLandmark[] | null)[];
  extras: RoundExtras[];
  confetti: Confetti;
  debug: boolean;
  /** Seconds since the app started. */
  time: number;
  toast: { icon: string; until: number } | null;
  loading: boolean;
  error: string | null;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  W: number;
  H: number;
  stage: Rect;
  /** Area right of the stage. */
  side: Rect;
  /** Where the camera image sits inside `side` (letterboxed, never cropped). */
  feed: Rect;
}

export function layout(W: number, H: number, video: HTMLVideoElement): Layout {
  const stage = { x: 0, y: 0, w: Math.round(W * 0.36), h: H };
  const side = { x: stage.w, y: 0, w: W - stage.w, h: H };
  const vw = video.videoWidth || 16;
  const vh = video.videoHeight || 9;
  const s = Math.min(side.w / vw, (side.h * 0.78) / vh);
  const fw = vw * s;
  const fh = vh * s;
  const feed = { x: side.x + (side.w - fw) / 2, y: (H - fh) / 2, w: fw, h: fh };
  return { W, H, stage, side, feed };
}

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
const pop = (x: number) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return 1 + Math.sin(x * Math.PI) * 0.35 * (1 - x) + (ease(x) - 1);
};

function toScreen(L: Layout, lm: NormalizedLandmark) {
  return { x: L.feed.x + (1 - lm.x) * L.feed.w, y: L.feed.y + lm.y * L.feed.h };
}

export function drawFrame(ctx: CanvasRenderingContext2D, L: Layout, g: GameState, v: View) {
  ctx.save();
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, L.W, L.H);
  drawStage(ctx, L, g, v);
  drawSide(ctx, L, g, v);
  v.confetti.draw(ctx);
  drawToast(ctx, L, v);
  ctx.restore();
}

// ---------------------------------------------------------------- stage

const WAVE = (t: number): Shape => ({
  torso: -90 + Math.sin(t * 2) * 4,
  lUpper: 100,
  lFore: 95,
  rUpper: -30,
  rFore: -80 + Math.sin(t * 8) * 35,
});
const BECKON = (t: number): Shape => ({
  torso: -90,
  lUpper: -140 + Math.sin(t * 6) * 15,
  lFore: -100 + Math.sin(t * 6) * 25,
  rUpper: -40 - Math.sin(t * 6) * 15,
  rFore: -80 - Math.sin(t * 6) * 25,
});
const CHEER = (t: number): Shape => ({
  torso: -90 + Math.sin(t * 5) * 5,
  lUpper: -130,
  lFore: -110 + Math.sin(t * 10) * 20,
  rUpper: -50,
  rFore: -70 - Math.sin(t * 10) * 20,
});
const DROOP = (t: number): Shape => ({ torso: -90 + Math.sin(t) * 3, lUpper: 97, lFore: 93, rUpper: 83, rFore: 87 });

function blink(time: number) {
  const p = time % 3.7;
  return p < 0.12 ? 1 - Math.abs(p - 0.06) / 0.06 : 0;
}

function drawStage(ctx: CanvasRenderingContext2D, L: Layout, g: GameState, v: View) {
  const { stage } = L;
  ctx.save();
  ctx.beginPath();
  ctx.rect(stage.x, stage.y, stage.w, stage.h);
  ctx.clip();
  ctx.fillStyle = C.stage;
  ctx.fillRect(stage.x, stage.y, stage.w, stage.h);
  ctx.fillStyle = C.stageDot;
  const gap = Math.max(24, stage.w / 14);
  for (let y = gap / 2; y < stage.h; y += gap)
    for (let x = gap / 2; x < stage.w; x += gap) {
      ctx.beginPath();
      ctx.arc(x, y, gap * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  // Floor.
  const floorY = stage.h * 0.8;
  ctx.fillStyle = 'rgba(18, 18, 42, 0.35)';
  ctx.beginPath();
  ctx.ellipse(stage.w / 2, floorY + stage.h * 0.02, stage.w * 0.36, stage.h * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();

  const h = Math.min(stage.w * 0.36, stage.h * 0.28);
  const cx = stage.w / 2;
  const hipY = floorY - h * 0.3;
  const t = g.t;
  const time = v.time;
  const move = currentMove(g);
  const solo = (shape: Shape, mood: Mood, extra: { spin?: number; squash?: number; frozen?: boolean } = {}) =>
    drawMascot(ctx, cx, hipY, h, shape, { mood, blink: blink(time), ...extra });
  const duo = (shape: Shape, mood: Mood, frozen = false) => {
    const dh = h * 0.68;
    drawMascot(ctx, stage.w * 0.29, hipY + h * 0.08, dh, shape, { mood, blink: blink(time), frozen });
    drawMascot(ctx, stage.w * 0.71, hipY + h * 0.08, dh, duoPartner(shape), {
      mood, blink: blink(time + 0.4), frozen, body: C.mint,
    });
  };

  if (v.loading || v.error) {
    const bob = Math.abs(Math.sin(time * 4)) * h * 0.2;
    solo(v.error ? DROOP(time) : WAVE(time), v.error ? 'sad' : 'smug', { squash: 1 - bob / h / 3 });
    ctx.restore();
    return;
  }

  switch (g.phase) {
    case 'attract': {
      solo(WAVE(time), 'smug');
      drawHandsUpHint(ctx, cx, stage.h * 0.14, stage.w * 0.16, time, g.ready);
      break;
    }
    case 'calibrate':
      solo(BECKON(time), 'shock');
      break;
    case 'demo': {
      const shape = demoShape(move, t, DURATION.demo);
      if (move.duo) duo(shape, 'happy');
      else solo(shape, t < DURATION.demo - 0.8 ? 'happy' : 'focus');
      drawMoveBadge(ctx, cx, stage.h * 0.12, stage.w * 0.11, move.icon, Math.min(1, t * 3));
      break;
    }
    case 'countdown':
    case 'hold': {
      const frozen = g.phase === 'hold';
      if (move.duo) duo(move.target, 'focus', frozen);
      else solo(move.target, 'focus', { frozen });
      drawMoveBadge(ctx, cx, stage.h * 0.12, stage.w * 0.11, move.icon, 1);
      break;
    }
    case 'react':
    case 'replay': {
      const r = g.results[g.results.length - 1];
      const good = (r?.stars ?? 0) > 0;
      if (good) {
        const spin = g.phase === 'react' ? ease(t / 0.9) * Math.PI * 2 : 0;
        const hop = g.phase === 'react' ? Math.sin(Math.min(1, t / 0.9) * Math.PI) * h * 0.6 : 0;
        drawMascot(ctx, cx, hipY - hop, h, CHEER(time), { mood: 'happy', spin, blink: 0 });
      } else {
        const sag = g.phase === 'react' ? 1 - 0.25 * ease(t / 1.2) : 0.75;
        solo(DROOP(time), 'sad', { squash: sag });
        drawRainCloud(ctx, cx, hipY - h * 1.35, h * 0.75, time);
      }
      break;
    }
    case 'final': {
      const tier = trophyTier(g);
      drawTrophy(ctx, cx, stage.h * 0.2, stage.w * 0.2, tier, time);
      ctx.fillStyle = C.white;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 8;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = font(stage.w * 0.15);
      const total = String(totalScore(g));
      ctx.strokeText(total, cx, stage.h * 0.42);
      ctx.fillText(total, cx, stage.h * 0.42);
      const hh = h * 0.75;
      if (tier > 0) drawMascot(ctx, cx, floorY - hh * 0.3, hh, CHEER(time), { mood: 'happy', blink: blink(time) });
      else {
        drawMascot(ctx, cx, floorY - hh * 0.3, hh, DROOP(time), { mood: 'sad', squash: 0.8 });
        drawRainCloud(ctx, cx, floorY - hh * 1.5, hh * 0.7, time);
      }
      break;
    }
  }
  ctx.restore();
}

function drawMoveBadge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, icon: string, k: number) {
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pop(k), pop(k));
  ctx.fillStyle = C.white;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.font = emojiFont(r * 1.1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, 0, r * 0.06);
  ctx.restore();
}

/** Two little people raising their hands: the wordless "start" cue. */
function drawHandsUpHint(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number, ready: number) {
  ctx.save();
  ctx.translate(x, y);
  const lift = (Math.sin(time * 4) + 1) / 2;
  ctx.lineCap = 'round';
  for (const [i, color] of [C.tomato, C.cyan].entries()) {
    const px = (i === 0 ? -1 : 1) * s * 0.55;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = s * 0.12;
    ctx.beginPath();
    ctx.arc(px, -s * 0.25, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px, -s * 0.05);
    ctx.lineTo(px, s * 0.45);
    for (const side of [-1, 1]) {
      ctx.moveTo(px, s * 0.05);
      ctx.lineTo(px + side * s * 0.3, -s * 0.15 - lift * s * 0.35);
    }
    ctx.stroke();
  }
  if (ready > 0) {
    ctx.strokeStyle = C.mint;
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.arc(0, s * 0.05, s * 1.1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ready));
    ctx.stroke();
  }
  ctx.restore();
}

function drawRainCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number) {
  ctx.save();
  ctx.translate(x + Math.sin(time * 1.5) * s * 0.1, y);
  ctx.strokeStyle = 'rgba(191, 233, 255, 0.8)';
  ctx.lineWidth = s * 0.03;
  for (let i = 0; i < 9; i++) {
    const rx = (i / 8 - 0.5) * s * 1.1;
    const phase = (time * 1.6 + i * 0.37) % 1;
    const ry = s * 0.2 + phase * s * 1.1;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - s * 0.04, ry + s * 0.14);
    ctx.stroke();
  }
  ctx.fillStyle = C.rain;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = s * 0.04;
  ctx.beginPath();
  ctx.arc(-s * 0.35, 0, s * 0.25, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(-s * 0.1, -s * 0.2, s * 0.3, Math.PI, Math.PI * 1.9);
  ctx.arc(s * 0.25, -s * 0.1, s * 0.28, Math.PI * 1.2, Math.PI * 0.1);
  ctx.arc(s * 0.4, s * 0.08, s * 0.18, Math.PI * 1.6, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTrophy(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, tier: number, time: number) {
  ctx.save();
  ctx.translate(x, y + Math.sin(time * 2) * s * 0.05);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = s * 0.07;
  if (tier === 0) {
    // A dented tin can with a fly buzzing round it.
    ctx.rotate(0.15);
    ctx.fillStyle = '#A7ADC6';
    ctx.beginPath();
    ctx.rect(-s * 0.45, -s * 0.55, s * 0.9, s * 1.1);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.55, s * 0.45, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, s * 0.1);
    ctx.lineTo(-s * 0.3, s * 0.2);
    ctx.lineTo(-s * 0.45, s * 0.3);
    ctx.stroke();
    ctx.rotate(-0.15);
    const fx = Math.cos(time * 5) * s * 0.8;
    const fy = -s * 0.7 + Math.sin(time * 9) * s * 0.25;
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(fx, fy, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const metal = ['', '#C98A4B', '#D5DAE8', C.sun][tier]!;
  ctx.fillStyle = metal;
  // Handles.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * s * 0.55, -s * 0.3, s * 0.22, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-s * 0.6, -s * 0.65);
  ctx.lineTo(s * 0.6, -s * 0.65);
  ctx.quadraticCurveTo(s * 0.55, s * 0.2, 0, s * 0.3);
  ctx.quadraticCurveTo(-s * 0.55, s * 0.2, -s * 0.6, -s * 0.65);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(-s * 0.1, s * 0.28, s * 0.2, s * 0.3);
  ctx.strokeRect(-s * 0.1, s * 0.28, s * 0.2, s * 0.3);
  ctx.fillRect(-s * 0.4, s * 0.58, s * 0.8, s * 0.2);
  ctx.strokeRect(-s * 0.4, s * 0.58, s * 0.8, s * 0.2);
  // Stars for the tier.
  ctx.font = emojiFont(s * 0.3);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⭐'.repeat(tier), 0, -s * 0.22);
  ctx.restore();
}

// ---------------------------------------------------------------- camera side

function drawSide(ctx: CanvasRenderingContext2D, L: Layout, g: GameState, v: View) {
  const { feed } = L;
  ctx.save();
  ctx.beginPath();
  ctx.rect(feed.x, feed.y, feed.w, feed.h);
  ctx.clip();

  if (v.loading || v.error) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(feed.x, feed.y, feed.w, feed.h);
    ctx.globalAlpha = v.error ? 1 : 0.5 + 0.5 * Math.sin(v.time * 5);
    ctx.font = emojiFont(feed.h * 0.18);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(v.error ? '📷 ✖' : '📷', feed.x + feed.w / 2, feed.y + feed.h / 2);
    ctx.globalAlpha = 1;
  } else if (g.phase === 'replay') drawReplay(ctx, L, g, v);
  else if (g.phase === 'final') drawPhotoStrip(ctx, L, g, v);
  else {
    drawVideo(ctx, feed, v.video);
    if (g.phase === 'react' && (g.results[g.results.length - 1]?.stars ?? 0) === 0) {
      ctx.fillStyle = 'rgba(40, 44, 70, 0.55)';
      ctx.fillRect(feed.x, feed.y, feed.w, feed.h);
    }
    drawCostumes(ctx, L, v);
    if (v.debug) drawSkeletons(ctx, L, v);
    if (g.phase === 'calibrate') drawCalibration(ctx, L, g, v);
    if (g.phase === 'hold') drawFreeze(ctx, L, g, v);
    if (g.phase === 'countdown') drawBeat(ctx, L, g);
    if (g.phase === 'react') drawReaction(ctx, L, g);
  }
  ctx.restore();

  drawTopBand(ctx, L, g, v);
  if (g.phase !== 'final' && g.phase !== 'attract') drawMeters(ctx, L, g);
}

function drawVideo(ctx: CanvasRenderingContext2D, r: Rect, video: HTMLVideoElement | ImageBitmap, zoom = 1) {
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.scale(-zoom, zoom);
  ctx.drawImage(video, -r.w / 2, -r.h / 2, r.w, r.h);
  ctx.restore();
}

function drawCostumes(ctx: CanvasRenderingContext2D, L: Layout, v: View) {
  v.landmarks.forEach((lm, i) => {
    if (!lm) return;
    const color = PLAYER_COLORS[i] ?? C.sun;
    const ls = toScreen(L, lm[11]!);
    const rs = toScreen(L, lm[12]!);
    const width = Math.hypot(ls.x - rs.x, ls.y - rs.y);
    const nose = toScreen(L, lm[0]!);
    // Party hat, tilted with the shoulders.
    const tilt = Math.atan2(ls.y - rs.y, ls.x - rs.x);
    ctx.save();
    ctx.translate(nose.x, nose.y - width * 0.55);
    ctx.rotate(tilt + (tilt > Math.PI / 2 || tilt < -Math.PI / 2 ? Math.PI : 0));
    ctx.fillStyle = color;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(2, width * 0.04);
    ctx.beginPath();
    ctx.moveTo(-width * 0.22, 0);
    ctx.lineTo(0, -width * 0.6);
    ctx.lineTo(width * 0.22, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.sun;
    ctx.beginPath();
    ctx.arc(0, -width * 0.6, width * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Giant cartoon gloves.
    for (const [wrist, elbow] of [[15, 13], [16, 14]] as const) {
      const w = lm[wrist]!;
      if ((w.visibility ?? 1) < 0.5) continue;
      const ws = toScreen(L, w);
      const es = toScreen(L, lm[elbow]!);
      const a = Math.atan2(ws.y - es.y, ws.x - es.x);
      drawGlove(ctx, ws.x + Math.cos(a) * width * 0.08, ws.y + Math.sin(a) * width * 0.08, width * 0.16, a, Math.max(2, width * 0.03));
    }
  });
}

const BONES: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]];

function drawSkeletons(ctx: CanvasRenderingContext2D, L: Layout, v: View) {
  v.landmarks.forEach((lm, i) => {
    if (!lm) return;
    ctx.strokeStyle = PLAYER_COLORS[i] ?? C.white;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (const [a, b] of BONES) {
      const pa = toScreen(L, lm[a]!);
      const pb = toScreen(L, lm[b]!);
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
    }
    ctx.stroke();
  });
}

function drawCalibration(ctx: CanvasRenderingContext2D, L: Layout, g: GameState, v: View) {
  const { feed } = L;
  const slots = g.solo ? [0.5] : [0.27, 0.73];
  slots.forEach((sx, i) => {
    const x = feed.x + feed.w * sx;
    const s = feed.h * 0.32;
    const y = feed.y + feed.h * 0.55;
    const ok = v.landmarks[i] != null;
    const color = PLAYER_COLORS[g.solo ? 0 : i]!;
    ctx.save();
    ctx.setLineDash([s * 0.08, s * 0.06]);
    ctx.lineWidth = s * 0.04;
    ctx.strokeStyle = ok ? C.mint : color;
    ctx.fillStyle = ok ? 'rgba(61, 220, 151, 0.25)' : 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(x, y - s * 0.75, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(x - s * 0.5, y - s * 0.4, s, s * 1.3, [s * 0.4, s * 0.4, 0, 0]);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
  if (g.ready > 0) {
    ctx.strokeStyle = C.mint;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(feed.x + feed.w / 2, feed.y + feed.h * 0.2, feed.h * 0.07, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, g.ready / 1.5));
    ctx.stroke();
  }
}

function drawBeat(ctx: CanvasRenderingContext2D, L: Layout, g: GameState) {
  const { feed } = L;
  let idx = 0;
  BEAT_TIMES.forEach((bt, i) => {
    if (g.t >= bt) idx = i;
  });
  const n = BEAT_TIMES.length - idx;
  const local = (g.t - BEAT_TIMES[idx]!) / 0.6;
  const scale = 1.6 - ease(Math.min(1, local * 2)) * 0.6;
  ctx.save();
  ctx.globalAlpha = 1 - Math.max(0, local - 0.7) / 0.3;
  ctx.translate(feed.x + feed.w / 2, feed.y + feed.h / 2);
  ctx.scale(scale, scale);
  ctx.font = font(feed.h * 0.35);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = feed.h * 0.03;
  ctx.strokeStyle = C.ink;
  ctx.strokeText(String(n), 0, 0);
  ctx.fillStyle = n === 1 ? C.sun : C.white;
  ctx.fillText(String(n), 0, 0);
  ctx.restore();
}

function drawFreeze(ctx: CanvasRenderingContext2D, L: Layout, g: GameState, v: View) {
  const { feed } = L;
  const flash = Math.max(0, 1 - g.t / 0.25);
  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.7})`;
    ctx.fillRect(feed.x, feed.y, feed.w, feed.h);
  }
  // Frost border.
  const b = feed.h * 0.035;
  ctx.strokeStyle = C.frost;
  ctx.lineWidth = b;
  ctx.shadowColor = C.frost;
  ctx.shadowBlur = b * 1.5;
  ctx.strokeRect(feed.x + b / 2, feed.y + b / 2, feed.w - b, feed.h - b);
  ctx.shadowBlur = 0;
  // Sync link between the two players' chests.
  const [a, c] = v.landmarks;
  if (a && c && g.live.sync > 0.55) {
    const chest = (lm: NormalizedLandmark[]) => {
      const l = toScreen(L, lm[11]!);
      const r = toScreen(L, lm[12]!);
      return { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 + Math.abs(l.x - r.x) * 0.3 };
    };
    const p = chest(a);
    const q = chest(c);
    const k = (g.live.sync - 0.55) / 0.45;
    ctx.save();
    ctx.strokeStyle = C.mint;
    ctx.shadowColor = C.mint;
    ctx.shadowBlur = 20 + k * 30;
    ctx.lineWidth = 4 + k * 14;
    ctx.lineCap = 'round';
    ctx.setLineDash([18, 14]);
    ctx.lineDashOffset = -v.time * 120;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo((p.x + q.x) / 2, Math.min(p.y, q.y) - 60, q.x, q.y);
    ctx.stroke();
    ctx.restore();
  }
  // Timer ring.
  const left = 1 - g.t / DURATION.hold;
  const cx = feed.x + feed.w / 2;
  const cy = feed.y + feed.h * 0.1;
  const r = feed.h * 0.05;
  ctx.fillStyle = 'rgba(18, 18, 42, 0.6)';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = left < 0.3 ? C.tomato : C.frost;
  ctx.lineWidth = r * 0.45;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
  ctx.stroke();
  ctx.font = emojiFont(r * 0.9);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('❄️', cx, cy + r * 0.05);
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, cracked = false) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = r * 0.12;
  ctx.stroke();
  if (cracked) {
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.9);
    ctx.lineTo(x - r * 0.15, y - r * 0.2);
    ctx.lineTo(x + r * 0.15, y + r * 0.1);
    ctx.lineTo(x - r * 0.05, y + r * 0.6);
    ctx.stroke();
  }
}

function drawReaction(ctx: CanvasRenderingContext2D, L: Layout, g: GameState) {
  const { feed } = L;
  const r = g.results[g.results.length - 1];
  if (!r) return;
  const cx = feed.x + feed.w / 2;
  const cy = feed.y + feed.h * 0.42;
  const size = feed.h * 0.12;
  if (r.stars === 0) {
    const fall = Math.max(0, g.t - 0.6);
    ctx.save();
    ctx.translate(cx, cy + fall * fall * feed.h * 0.4);
    ctx.rotate(fall * 1.5);
    drawStar(ctx, 0, 0, size * 1.2, C.slate, true);
    ctx.restore();
  } else {
    for (let i = 0; i < 3; i++) {
      const k = pop((g.t - 0.25 - i * 0.3) / 0.35);
      const x = cx + (i - 1) * size * 2.3;
      ctx.save();
      ctx.translate(x, cy - (i === 1 ? size * 0.4 : 0));
      ctx.scale(Math.max(0, k), Math.max(0, k));
      drawStar(ctx, 0, 0, size, i < r.stars ? C.sun : 'rgba(255,255,255,0.25)');
      ctx.restore();
    }
  }
  // Points.
  const k = ease((g.t - 1.1) / 0.5);
  if (k > 0) {
    ctx.save();
    ctx.globalAlpha = k;
    ctx.font = font(feed.h * 0.11);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = feed.h * 0.015;
    ctx.strokeStyle = C.ink;
    const text = `+${r.points}`;
    const y = cy + size * 2.1 - k * feed.h * 0.04;
    ctx.strokeText(text, cx, y);
    ctx.fillStyle = r.stars > 0 ? C.mint : C.white;
    ctx.fillText(text, cx, y);
    ctx.restore();
  }
}

function drawReplay(ctx: CanvasRenderingContext2D, L: Layout, g: GameState, v: View) {
  const { feed } = L;
  const ex = v.extras[g.results.length - 1];
  const r = g.results[g.results.length - 1];
  const clip = ex?.clip ?? [];
  const p = Math.min(1, g.t / (DURATION.replay * 0.8));
  let frame: ImageBitmap | null = ex?.photo ?? null;
  if (clip.length > 0) {
    const first = clip[0]!.t;
    const last = clip[clip.length - 1]!.t;
    const at = first + (last - first) * p;
    frame = clip.reduce((best, f) => (Math.abs(f.t - at) < Math.abs(best.t - at) ? f : best)).bmp;
  }
  if (frame) drawVideo(ctx, feed, frame, 1 + 0.18 * ease(p));
  // Cinematic bars and vignette.
  const bar = feed.h * 0.09;
  ctx.fillStyle = C.ink;
  ctx.fillRect(feed.x, feed.y, feed.w, bar);
  ctx.fillRect(feed.x, feed.y + feed.h - bar, feed.w, bar);
  const grad = ctx.createRadialGradient(feed.x + feed.w / 2, feed.y + feed.h / 2, feed.h * 0.3, feed.x + feed.w / 2, feed.y + feed.h / 2, feed.w * 0.7);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(feed.x, feed.y, feed.w, feed.h);
  // Replay marker.
  ctx.font = emojiFont(bar * 0.6);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = Math.floor(v.time * 2) % 2 === 0 ? 1 : 0.4;
  ctx.fillText('⏪', feed.x + bar * 0.4, feed.y + bar / 2);
  ctx.globalAlpha = 1;

  if (!ex || !r) return;
  drawJudges(ctx, L, g.t, ex);
  // Award.
  const ak = pop((g.t - 2.8) / 0.4);
  if (ak > 0) {
    ctx.save();
    ctx.translate(feed.x + feed.w * 0.86, feed.y + feed.h * 0.28);
    ctx.rotate(Math.sin(v.time * 3) * 0.15);
    ctx.scale(ak, ak);
    ctx.fillStyle = C.sun;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      const rr = i % 2 === 0 ? feed.h * 0.13 : feed.h * 0.1;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.font = emojiFont(feed.h * 0.12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ex.verdict.award, 0, feed.h * 0.008);
    ctx.restore();
  }
  // Laugh bonus.
  const lk = pop((g.t - 3.3) / 0.4);
  if (lk > 0 && r.laughBonus > 0) {
    ctx.save();
    ctx.translate(feed.x + feed.w * 0.14, feed.y + feed.h * 0.28);
    ctx.scale(lk, lk);
    ctx.font = emojiFont(feed.h * 0.09);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('😂'.repeat(Math.round(r.laughBonus / 15)), 0, 0);
    ctx.font = font(feed.h * 0.07);
    ctx.lineWidth = 6;
    ctx.strokeStyle = C.ink;
    ctx.strokeText(`+${r.laughBonus}`, 0, feed.h * 0.1);
    ctx.fillStyle = C.mint;
    ctx.fillText(`+${r.laughBonus}`, 0, feed.h * 0.1);
    ctx.restore();
  }
}

export const CARD_TIMES = [1.0, 1.5, 2.3] as const;

function drawJudges(ctx: CanvasRenderingContext2D, L: Layout, t: number, ex: RoundExtras) {
  const { feed } = L;
  const h = feed.h * 0.19;
  const colors = [C.mint, C.cyan, C.tomato];
  for (let i = 0; i < 3; i++) {
    const x = feed.x + feed.w * (0.25 + i * 0.25);
    const y = feed.y + feed.h - h * 0.3;
    const up = ease((t - CARD_TIMES[i]!) / 0.3);
    const stingy = i === 2;
    const shape: Shape = up > 0
      ? { torso: -90, lUpper: -115 + 30 * (1 - up), lFore: -80, rUpper: -65 - 30 * (1 - up), rFore: -100 }
      : { torso: -90, lUpper: 110, lFore: 60, rUpper: 70, rFore: 120 };
    drawMascot(ctx, x, y, h, shape, { mood: stingy ? 'smug' : up > 0 ? 'happy' : 'focus', body: colors[i] });
    if (up <= 0) continue;
    const cw = h * 0.85;
    const ch = h * 0.62;
    const cy = y - h * 1.55 - up * h * 0.1;
    ctx.save();
    ctx.translate(x, cy);
    ctx.fillStyle = C.white;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.rect(-cw / 2, -ch / 2, cw, ch);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = font(ch * 0.6);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ex.claudePending ? '?' : String(ex.verdict.judges[i]), 0, ch * 0.04);
    ctx.restore();
  }
}

function drawPhotoStrip(ctx: CanvasRenderingContext2D, L: Layout, g: GameState, v: View) {
  const { feed } = L;
  ctx.fillStyle = C.ink;
  ctx.fillRect(feed.x, feed.y, feed.w, feed.h);
  const best = g.results
    .map((r, i) => ({ r, ex: v.extras[i] }))
    .filter((x) => x.ex?.photo)
    .sort((a, b) => b.r.points + b.r.laughBonus - (a.r.points + a.r.laughBonus))
    .slice(0, 4);
  const cols = 2;
  const pw = feed.w * 0.4;
  const ph = (pw * 9) / 16;
  best.forEach(({ r, ex }, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = feed.x + feed.w * (0.28 + col * 0.44);
    const y = feed.y + feed.h * (0.27 + row * 0.47);
    const k = ease((g.t - 0.3 - i * 0.35) / 0.5);
    if (k <= 0) return;
    ctx.save();
    ctx.translate(x, y + (1 - k) * feed.h * 0.3);
    ctx.rotate((i % 2 === 0 ? -1 : 1) * 0.05 * (1 + row));
    ctx.globalAlpha = k;
    const pad = pw * 0.04;
    ctx.fillStyle = C.white;
    ctx.fillRect(-pw / 2 - pad, -ph / 2 - pad, pw + pad * 2, ph + pad * 4.5);
    drawVideo(ctx, { x: -pw / 2, y: -ph / 2, w: pw, h: ph }, ex!.photo!);
    ctx.font = emojiFont(pad * 2.4);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const icon = MOVES.find((m) => m.id === r.moveId)?.icon ?? '';
    ctx.fillText(`${ex!.verdict.award} ${icon}`, -pw / 2, ph / 2 + pad * 2.2);
    for (let s = 0; s < 3; s++) drawStar(ctx, pw / 2 - pad * (2 + s * 3), ph / 2 + pad * 2.2, pad * 1.2, s < r.stars ? C.sun : '#DDE0EE');
    ctx.restore();
  });
}

// ---------------------------------------------------------------- HUD

function drawTopBand(ctx: CanvasRenderingContext2D, L: Layout, g: GameState, v: View) {
  const { side, feed } = L;
  const bandH = feed.y;
  const cy = bandH / 2;
  if (bandH < 30) return;
  if (g.phase === 'attract' || v.loading || v.error) {
    ctx.save();
    ctx.font = font(Math.min(bandH * 0.42, side.w * 0.07));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = side.x + side.w / 2;
    ctx.fillStyle = C.sun;
    ctx.fillText('CHUCKLE VISION', x, cy);
    ctx.restore();
    return;
  }
  // Round pips.
  const n = MOVES.length;
  const r = Math.min(bandH * 0.16, side.w * 0.022);
  const startX = side.x + side.w * 0.08;
  for (let i = 0; i < n; i++) {
    const x = startX + i * r * 3;
    const res = g.results[i];
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = res ? (res.stars > 0 ? C.mint : C.slate) : 'rgba(255,255,255,0.12)';
    ctx.fill();
    if (i === g.round && g.phase !== 'final') {
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 3 + Math.sin(v.time * 6) * 1.5;
      ctx.stroke();
    }
  }
  // Team score.
  ctx.font = font(bandH * 0.5);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.white;
  ctx.fillText(String(totalScore(g)), side.x + side.w * 0.94, cy);
  if (g.solo) {
    ctx.font = emojiFont(bandH * 0.3);
    ctx.textAlign = 'center';
    ctx.fillText('👤', side.x + side.w * 0.62, cy);
  }
}

function drawMeters(ctx: CanvasRenderingContext2D, L: Layout, g: GameState) {
  const { side, feed } = L;
  const top = feed.y + feed.h;
  const bandH = L.H - top;
  if (bandH < 30) return;
  const cy = top + bandH / 2;
  const barW = side.w * 0.3;
  const barH = Math.min(bandH * 0.22, 34);
  const values = g.phase === 'hold' ? g.live.players : [0, 0];
  const slots = g.solo ? [0] : [0, 1];
  for (const i of slots) {
    const x = g.solo ? side.x + (side.w - barW) / 2 : i === 0 ? side.x + side.w * 0.06 : side.x + side.w * 0.94 - barW;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(x, cy - barH / 2, barW, barH, 6);
    ctx.fill();
    ctx.fillStyle = PLAYER_COLORS[i]!;
    ctx.beginPath();
    ctx.roundRect(x, cy - barH / 2, Math.max(barH * 0.5, barW * (values[i] ?? 0)), barH, 6);
    ctx.fill();
    // Three-star tick marks.
    ctx.fillStyle = C.ink;
    for (const th of [0.5, 0.65, 0.8]) ctx.fillRect(x + barW * th - 1.5, cy - barH / 2, 3, barH);
  }
  if (!g.solo) {
    const s = g.phase === 'hold' ? g.live.sync : 0;
    ctx.font = emojiFont(barH * 1.4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.35 + 0.65 * s;
    ctx.fillText('🔗', side.x + side.w / 2, cy);
    ctx.globalAlpha = 1;
  }
}

function drawToast(ctx: CanvasRenderingContext2D, L: Layout, v: View) {
  if (!v.toast || v.time > v.toast.until) return;
  ctx.save();
  ctx.fillStyle = 'rgba(18,18,42,0.85)';
  const s = Math.min(L.W, L.H) * 0.08;
  ctx.beginPath();
  ctx.roundRect(L.W - s * 3.2, L.H - s * 1.4, s * 3, s * 1.2, 10);
  ctx.fill();
  ctx.font = emojiFont(s * 0.6);
  ctx.fillStyle = C.white;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(v.toast.icon, L.W - s * 1.7, L.H - s * 0.8);
  ctx.restore();
}
