// Fixed-timestep game loop. Simulation advances in constant `step` increments;
// render receives alpha (0..1) for interpolating between the last two states.

export interface LoopHandlers {
  update(dt: number): void;
  render(alpha: number): void;
}

export interface Stepper {
  /** Feed elapsed real time (seconds); runs zero or more updates, then one render. */
  advance(elapsed: number): void;
}

const MAX_FRAME = 0.25; // clamp long pauses (tab switch) to avoid a spiral of death

export function createStepper(handlers: LoopHandlers, step = 1 / 60): Stepper {
  let acc = 0;
  return {
    advance(elapsed) {
      acc += Math.min(Math.max(elapsed, 0), MAX_FRAME);
      while (acc >= step) {
        handlers.update(step);
        acc -= step;
      }
      handlers.render(acc / step);
    },
  };
}

/** Drives a stepper from requestAnimationFrame. Returns a stop function. */
export function startLoop(handlers: LoopHandlers, step?: number): () => void {
  const stepper = createStepper(handlers, step);
  let last = performance.now();
  let id = requestAnimationFrame(function frame(now) {
    stepper.advance((now - last) / 1000);
    last = now;
    id = requestAnimationFrame(frame);
  });
  return () => cancelAnimationFrame(id);
}
