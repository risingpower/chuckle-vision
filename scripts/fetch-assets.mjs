// Copies the MediaPipe wasm runtime and downloads the pose model into public/,
// so the game runs with no network once set up. Runs before dev and build.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';

const WASM_SRC = 'node_modules/@mediapipe/tasks-vision/wasm';
const WASM_DEST = 'public/mediapipe';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';
const MODEL_DEST = 'public/models/pose_landmarker_full.task';

cpSync(WASM_SRC, WASM_DEST, { recursive: true });

if (!existsSync(MODEL_DEST)) {
  mkdirSync('public/models', { recursive: true });
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Pose model download failed: HTTP ${res.status}`);
  writeFileSync(MODEL_DEST, Buffer.from(await res.arrayBuffer()));
  console.log(`Downloaded ${MODEL_DEST}`);
}
