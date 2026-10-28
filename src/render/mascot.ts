// Bop, the mascot: a round, colourful blob with no skin tone, gender or
// nationality. Its limbs are driven by the same Shape players are scored on.

import type { Shape } from '../core/shape';
import { C } from './palette';

export type Mood = 'smug' | 'happy' | 'sad' | 'focus' | 'shock';

export interface MascotOptions {
  mood: Mood;
  /** Vertical squash, 1 = normal; below 1 looks deflated. */
  squash?: number;
  /** Whole-body rotation in radians (backflips). */
  spin?: number;
  /** Icy outline while frozen. */
  frozen?: boolean;
  /** 0..1 eyelid closure for blinking. */
  blink?: number;
  body?: string;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Draw Bop with hips at (x, y). `h` is roughly the body height in pixels. */
export function drawMascot(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, shape: Shape, o: MascotOptions) {
  const squash = o.squash ?? 1;
  const body = o.body ?? C.sun;
  ctx.save();
  ctx.translate(x, y - h * 0.4);
  if (o.spin) ctx.rotate(o.spin);
  ctx.translate(0, h * 0.4);
  ctx.scale(1 / Math.sqrt(squash), squash);

  const dir = { x: Math.cos(rad(shape.torso)), y: Math.sin(rad(shape.torso)) };
  const left = { x: dir.y, y: -dir.x }; // perpendicular towards the screen's left when upright
  const sc = { x: dir.x * h * 0.62, y: dir.y * h * 0.62 };
  const centre = { x: dir.x * h * 0.36, y: dir.y * h * 0.36 };
  const outline = Math.max(3, h * 0.035);

  // Legs and shoes.
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const hx = side * h * 0.16;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = h * 0.1;
    ctx.beginPath();
    ctx.moveTo(hx, 0);
    ctx.lineTo(hx + side * h * 0.03, h * 0.26);
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.ellipse(hx + side * h * 0.07, h * 0.29, h * 0.11, h * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Body blob.
  const bodyRot = rad(shape.torso) + Math.PI / 2;
  ctx.fillStyle = body;
  ctx.strokeStyle = o.frozen ? C.frost : C.ink;
  ctx.lineWidth = o.frozen ? outline * 2.2 : outline;
  ctx.beginPath();
  ctx.ellipse(centre.x, centre.y, h * 0.4, h * 0.5, bodyRot, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (o.frozen) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = outline * 0.6;
    ctx.stroke();
  }

  // Face sits on the upper body, rotated with the torso.
  ctx.save();
  ctx.translate(centre.x + dir.x * h * 0.12, centre.y + dir.y * h * 0.12);
  ctx.rotate(bodyRot);
  drawFace(ctx, h, o);
  ctx.restore();

  // Arms: upper then fore, with a white glove.
  for (const side of ['l', 'r'] as const) {
    const sign = side === 'l' ? 1 : -1;
    const shoulder = { x: sc.x + left.x * h * 0.3 * sign, y: sc.y + left.y * h * 0.3 * sign };
    const upper = rad(side === 'l' ? shape.lUpper : shape.rUpper);
    const fore = rad(side === 'l' ? shape.lFore : shape.rFore);
    const elbow = { x: shoulder.x + Math.cos(upper) * h * 0.4, y: shoulder.y + Math.sin(upper) * h * 0.4 };
    const hand = { x: elbow.x + Math.cos(fore) * h * 0.36, y: elbow.y + Math.sin(fore) * h * 0.36 };
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(shoulder.x, shoulder.y);
      ctx.lineTo(elbow.x, elbow.y);
      ctx.lineTo(hand.x, hand.y);
    };
    ctx.lineJoin = 'round';
    path();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = h * 0.13;
    ctx.stroke();
    path();
    ctx.strokeStyle = body;
    ctx.lineWidth = h * 0.13 - outline * 2;
    ctx.stroke();
    drawGlove(ctx, hand.x, hand.y, h * 0.1, fore, outline);
  }
  ctx.restore();
}

export function drawGlove(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number, outline: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = C.white;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = outline;
  ctx.beginPath();
  ctx.ellipse(r * 0.2, 0, r * 1.1, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath(); // thumb
  ctx.ellipse(-r * 0.1, -r * 0.9, r * 0.35, r * 0.45, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawFace(ctx: CanvasRenderingContext2D, h: number, o: MascotOptions) {
  const eyeX = h * 0.14;
  const eyeY = -h * 0.08;
  const eyeR = h * 0.1;
  const lw = Math.max(3, h * 0.03);
  ctx.lineWidth = lw;
  ctx.strokeStyle = C.ink;
  ctx.fillStyle = C.ink;
  ctx.lineCap = 'round';

  for (const s of [-1, 1]) {
    const ex = s * eyeX;
    if (o.mood === 'happy') {
      ctx.beginPath();
      ctx.arc(ex, eyeY + eyeR * 0.3, eyeR * 0.7, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeR * 0.85, eyeR, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const pupilY = o.mood === 'sad' ? eyeR * 0.35 : 0;
    const pupilR = o.mood === 'shock' ? eyeR * 0.22 : eyeR * 0.42;
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(ex + s * eyeR * 0.1, eyeY + pupilY, pupilR, 0, Math.PI * 2);
    ctx.fill();
    // Eyelids: smug is permanently half shut; blink closes both.
    const lid = Math.max(o.mood === 'smug' ? 0.5 : 0, o.blink ?? 0);
    if (lid > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeR * 0.85, eyeR, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = o.body ?? C.sun;
      ctx.fillRect(ex - eyeR, eyeY - eyeR, eyeR * 2, eyeR * 2 * lid);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(ex - eyeR * 0.85, eyeY - eyeR + eyeR * 2 * lid);
      ctx.lineTo(ex + eyeR * 0.85, eyeY - eyeR + eyeR * 2 * lid);
      ctx.stroke();
    }
    // Eyebrows.
    ctx.beginPath();
    const by = eyeY - eyeR * 1.45;
    if (o.mood === 'sad') {
      ctx.moveTo(ex - s * eyeR * 0.8, by - eyeR * 0.1);
      ctx.lineTo(ex + s * eyeR * 0.6, by + eyeR * 0.35);
    } else if (o.mood === 'focus') {
      ctx.moveTo(ex - s * eyeR * 0.8, by + eyeR * 0.4);
      ctx.lineTo(ex + s * eyeR * 0.6, by - eyeR * 0.1);
    } else if (o.mood === 'smug' && s === 1) {
      ctx.moveTo(ex - eyeR * 0.7, by - eyeR * 0.35);
      ctx.quadraticCurveTo(ex, by - eyeR * 0.75, ex + eyeR * 0.7, by - eyeR * 0.2);
    } else {
      ctx.moveTo(ex - eyeR * 0.7, by - (o.mood === 'shock' ? eyeR * 0.4 : 0));
      ctx.lineTo(ex + eyeR * 0.7, by - (o.mood === 'shock' ? eyeR * 0.4 : 0));
    }
    ctx.stroke();
  }

  // Cheeks.
  ctx.fillStyle = 'rgba(255, 90, 54, 0.45)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * h * 0.25, eyeY + h * 0.12, h * 0.06, h * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mouth.
  const my = h * 0.13;
  ctx.strokeStyle = C.ink;
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  switch (o.mood) {
    case 'happy':
      ctx.moveTo(-h * 0.13, my - h * 0.02);
      ctx.quadraticCurveTo(0, my + h * 0.2, h * 0.13, my - h * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C.tomato;
      ctx.beginPath();
      ctx.ellipse(0, my + h * 0.06, h * 0.05, h * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'sad':
      ctx.moveTo(-h * 0.09, my + h * 0.05);
      ctx.quadraticCurveTo(0, my - h * 0.05, h * 0.09, my + h * 0.05);
      ctx.stroke();
      ctx.fillStyle = C.cyan; // tear
      ctx.beginPath();
      ctx.ellipse(-eyeX - h * 0.02, eyeY + eyeR * 1.6, h * 0.025, h * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'smug':
      ctx.moveTo(-h * 0.08, my + h * 0.01);
      ctx.quadraticCurveTo(h * 0.04, my + h * 0.03, h * 0.11, my - h * 0.04);
      ctx.stroke();
      break;
    case 'focus':
      ctx.ellipse(0, my, h * 0.035, h * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'shock':
      ctx.ellipse(0, my + h * 0.02, h * 0.06, h * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}
