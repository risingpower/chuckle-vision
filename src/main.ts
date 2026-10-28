import '@fontsource/bungee/index.css';
import { Sfx } from './audio/sfx';
import { applyLaughBonus, createGame, currentMove, step, trophyTier, type Difficulty, type GameEvent } from './core/game';
import { localVerdict } from './core/judging';
import { startLoop } from './engine/loop';
import { askCritic } from './net/critic';
import { Confetti } from './render/confetti';
import { CARD_TIMES, drawFrame, layout, type RoundExtras, type View } from './render/scene';
import { createTracker, startCamera, track, type Tracked } from './vision/tracker';
import { Recorder, nearest, toJpegBase64 } from './vision/replay';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const video = document.querySelector<HTMLVideoElement>('#camera')!;
const goButton = document.querySelector<HTMLButtonElement>('#go')!;
const ctx = canvas.getContext('2d')!;

let W = 0;
let H = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const sfx = new Sfx();
const recorder = new Recorder();
const game = createGame();
const view: View = {
  video,
  landmarks: [null, null],
  extras: [],
  confetti: new Confetti(),
  debug: false,
  time: 0,
  toast: null,
  loading: false,
  error: null,
};

let landmarker: PoseLandmarker | null = null;
let tracked: Tracked = { players: [null, null], landmarks: [null, null] };
let lastVideoTime = -1;
let startPressed = false;

// Dev-only: simulated players, so every screen can be checked without a camera.
let simulate: ((g: typeof game) => Tracked['players']) | null = null;
if (import.meta.env.DEV) {
  Object.assign(window, {
    __cv: {
      game,
      view,
      currentMove,
      simulate(fn: typeof simulate) {
        simulate = fn;
        view.loading = false;
        view.error = null;
        goButton.hidden = true;
      },
    },
  });
}

// ---------------------------------------------------------------- start-up

goButton.addEventListener('click', () => void boot());

async function boot() {
  sfx.unlock();
  goButton.hidden = true;
  document.body.style.cursor = 'none';
  view.loading = true;
  void document.documentElement.requestFullscreen?.().catch(() => undefined);
  try {
    await Promise.all([startCamera(video), document.fonts.load('48px Bungee')]);
    landmarker = await createTracker();
    view.loading = false;
  } catch (err) {
    console.error('Start-up failed', err);
    view.error = err instanceof Error ? err.message : String(err);
    view.loading = false;
    goButton.hidden = false;
    document.body.style.cursor = '';
  }
}

// ---------------------------------------------------------------- host keys

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
const DIFFICULTY_ICON: Record<Difficulty, string> = { easy: '●○○', normal: '●●○', hard: '●●●' };

function toast(icon: string) {
  view.toast = { icon, until: view.time + 1.5 };
}

function reset() {
  sfx.stopMusic();
  releaseRounds();
  recorder.reset();
  Object.assign(game, createGame({ solo: game.solo, difficulty: game.difficulty }));
  view.confetti.clear();
}

window.addEventListener('keydown', (e) => {
  sfx.unlock();
  switch (e.key.toLowerCase()) {
    case ' ':
    case 'enter':
      e.preventDefault();
      startPressed = true;
      break;
    case 'r':
      reset();
      toast('↺');
      break;
    case 'd':
      view.debug = !view.debug;
      toast('🦴');
      break;
    case 'e': {
      const next = DIFFICULTIES[(DIFFICULTIES.indexOf(game.difficulty) + 1) % DIFFICULTIES.length]!;
      game.difficulty = next;
      toast(DIFFICULTY_ICON[next]);
      break;
    }
    case '1':
      game.solo = !game.solo;
      reset();
      toast(game.solo ? '👤' : '👥');
      break;
    case 'm':
      sfx.toggleMute();
      toast(sfx.muted ? '🔇' : '🔊');
      break;
    case 'f':
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.().catch(() => undefined);
      break;
    case 's':
      savePicture();
      break;
  }
});

function savePicture() {
  const a = document.createElement('a');
  a.download = `chuckle-vision-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
  toast('📸');
}

// ---------------------------------------------------------------- rounds

function releaseRounds() {
  for (const ex of view.extras) {
    for (const f of ex.clip) if (f.bmp !== ex.photo) f.bmp.close();
    ex.photo?.close();
  }
  view.extras = [];
}

function handle(e: GameEvent) {
  switch (e.type) {
    case 'phase':
      switch (e.phase) {
        case 'attract':
          sfx.stopMusic();
          releaseRounds();
          break;
        case 'calibrate':
          sfx.boing();
          break;
        case 'demo':
          sfx.boing();
          sfx.startMusic();
          break;
        case 'hold':
          recorder.reset();
          sfx.freeze();
          break;
        case 'replay':
          sfx.sting();
          break;
        case 'final': {
          const tier = trophyTier(game);
          if (tier > 0) {
            sfx.fanfare();
            view.confetti.burst(W * 0.18, H * 0.3, 220, 1300);
          } else sfx.fail();
          for (const ex of view.extras) {
            for (const f of ex.clip) if (f.bmp !== ex.photo) f.bmp.close();
            ex.clip = [];
          }
          break;
        }
      }
      break;
    case 'beat':
      sfx.beat(e.n);
      break;
    case 'result': {
      sfx.stopMusic();
      const r = e.result;
      const move = currentMove(game);
      if (r.stars > 0) {
        sfx.success(r.stars);
        const L = layout(W, H, video);
        view.confetti.burst(L.feed.x + L.feed.w / 2, L.feed.y + L.feed.h * 0.4, 60 + r.stars * 60, 900 + r.stars * 250);
        view.confetti.burst(L.stage.w / 2, H * 0.6, 40 * r.stars, 900);
      } else sfx.fail();

      const clip = recorder.takeClip(r.peakAt);
      const photo = nearest(clip, r.peakAt)?.bmp ?? null;
      const ex: RoundExtras = { verdict: localVerdict(r.match, move.icon), claudePending: false, photo, clip };
      const roundIndex = game.results.length - 1;
      view.extras[roundIndex] = ex;
      if (photo) {
        ex.claudePending = true;
        const image = toJpegBase64(photo);
        void askCritic(image, move.id).then((verdict) => {
          if (view.extras[roundIndex] !== ex) return; // game was reset meanwhile
          ex.claudePending = false;
          if (!verdict) return;
          ex.verdict = verdict;
          applyLaughBonus(game, roundIndex, verdict.smiles);
        });
      }
      break;
    }
  }
}

/** Sounds tied to moments inside a phase, fired when `prev -> now` crosses them. */
function timedCues(prev: number, now: number) {
  const crossed = (at: number) => prev < at && now >= at;
  if (game.phase === 'replay') {
    CARD_TIMES.forEach((at, i) => crossed(at) && sfx.card(i));
    const r = game.results[game.results.length - 1];
    if (crossed(3.3) && r && r.laughBonus > 0) sfx.laugh();
  }
}

// ---------------------------------------------------------------- loop

startLoop({
  update(dt) {
    view.time += dt;
    view.confetti.update(dt);
    if (!landmarker && !simulate) return;
    const players = simulate ? simulate(game) : tracked.players;
    const prev = game.t;
    const phase = game.phase;
    const events = step(game, { dt, players, start: startPressed });
    startPressed = false;
    if (game.phase === phase) timedCues(prev, game.t);
    for (const e of events) handle(e);
    if (game.phase === 'hold') recorder.capture(video, game.t);
  },
  render() {
    if (landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      tracked = track(landmarker, video, performance.now(), game.solo);
      view.landmarks = tracked.landmarks;
    }
    drawFrame(ctx, layout(W, H, video), game, view);
  },
});
