import { startLoop } from './engine/loop';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// Placeholder scene until the game spec lands: a dot orbiting the centre.
let t = 0;

startLoop({
  update(dt) {
    t += dt;
  },
  render() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f5c518';
    ctx.beginPath();
    ctx.arc(w / 2 + Math.cos(t) * 80, h / 2 + Math.sin(t) * 80, 12, 0, Math.PI * 2);
    ctx.fill();
  },
});
