// Records the hold phase so the best moment can be replayed in slow motion,
// kept for the photo strip, and sent to the judges.

const FPS = 15;
const WIDTH = 640;

export interface Frame {
  t: number;
  bmp: ImageBitmap;
}

export class Recorder {
  private frames: Frame[] = [];
  private lastT = -Infinity;
  private pending = 0;

  /** Capture the video at phase time `t` if enough time has passed since the last frame. */
  capture(video: HTMLVideoElement, t: number) {
    if (t - this.lastT < 1 / FPS || this.pending > 2 || video.videoWidth === 0) return;
    this.lastT = t;
    this.pending++;
    const height = Math.round((WIDTH * video.videoHeight) / video.videoWidth);
    createImageBitmap(video, { resizeWidth: WIDTH, resizeHeight: height })
      .then((bmp) => this.frames.push({ t, bmp }))
      .catch(() => undefined)
      .finally(() => this.pending--);
  }

  /** Frames around the peak, oldest first. Everything else is released. */
  takeClip(peakAt: number, before = 1.2, after = 0.4): Frame[] {
    const clip: Frame[] = [];
    for (const f of this.frames) {
      if (f.t >= peakAt - before && f.t <= peakAt + after) clip.push(f);
      else f.bmp.close();
    }
    this.frames = [];
    this.lastT = -Infinity;
    return clip.sort((a, b) => a.t - b.t);
  }

  reset() {
    for (const f of this.frames) f.bmp.close();
    this.frames = [];
    this.lastT = -Infinity;
  }
}

/** The frame closest to `t`. */
export function nearest(clip: Frame[], t: number): Frame | null {
  let best: Frame | null = null;
  for (const f of clip) if (!best || Math.abs(f.t - t) < Math.abs(best.t - t)) best = f;
  return best;
}

/** Mirrored JPEG, base64 without the data: prefix, for the judges. */
export function toJpegBase64(bmp: ImageBitmap): string {
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(bmp, 0, 0);
  return c.toDataURL('image/jpeg', 0.75).split(',')[1] ?? '';
}
