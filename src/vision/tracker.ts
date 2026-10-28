// Camera + MediaPipe pose tracking. Everything runs on the laptop; the model
// and wasm are served locally from public/ (see scripts/fetch-assets.mjs).

import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { observe, type Observation } from '../core/shape';

export interface Tracked {
  /** Slot 0 = screen left, slot 1 = screen right. */
  players: (Observation | null)[];
  /** Raw landmarks per slot, for costumes and the debug skeleton. */
  landmarks: (NormalizedLandmark[] | null)[];
}

export async function startCamera(video: HTMLVideoElement): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
}

export async function createTracker(): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks('/mediapipe');
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: '/models/pose_landmarker_full.task', delegate },
    runningMode: 'VIDEO' as const,
    numPoses: 2,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    return await PoseLandmarker.createFromOptions(vision, options('GPU'));
  } catch (err) {
    console.warn('GPU pose tracking unavailable, falling back to CPU', err);
    return PoseLandmarker.createFromOptions(vision, options('CPU'));
  }
}

/**
 * Run detection on the current video frame and sort people into screen slots.
 * In solo mode the single closest-to-centre person goes in slot 0.
 */
export function track(landmarker: PoseLandmarker, video: HTMLVideoElement, now: number, solo: boolean): Tracked {
  const result = landmarker.detectForVideo(video, now);
  const aspect = video.videoWidth / Math.max(1, video.videoHeight);
  const people = result.landmarks
    .map((lm) => ({ lm, obs: observe(lm, aspect) }))
    .filter((p): p is { lm: NormalizedLandmark[]; obs: Observation } => p.obs !== null)
    .sort((a, b) => a.obs.centerX - b.obs.centerX);

  const out: Tracked = { players: [null, null], landmarks: [null, null] };
  if (solo) {
    const p = people.sort((a, b) => Math.abs(a.obs.centerX - 0.5) - Math.abs(b.obs.centerX - 0.5))[0];
    if (p) {
      out.players[0] = p.obs;
      out.landmarks[0] = p.lm;
    }
    return out;
  }
  if (people.length >= 2) {
    people.slice(0, 2).forEach((p, i) => {
      out.players[i] = p.obs;
      out.landmarks[i] = p.lm;
    });
  } else if (people.length === 1) {
    const p = people[0]!;
    const slot = p.obs.centerX < 0.5 ? 0 : 1;
    out.players[slot] = p.obs;
    out.landmarks[slot] = p.lm;
  }
  return out;
}
