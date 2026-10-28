import { describe, expect, it } from 'vitest';
import { createStepper } from '../src/engine/loop';

function harness() {
  const calls = { updates: 0, alpha: -1 };
  const stepper = createStepper(
    {
      update: () => calls.updates++,
      render: (a) => (calls.alpha = a),
    },
    0.125, // binary-exact step so remainders compare cleanly
  );
  return { calls, stepper };
}

describe('createStepper', () => {
  it('runs one update per whole step and carries the remainder', () => {
    const { calls, stepper } = harness();
    stepper.advance(0.1875);
    expect(calls.updates).toBe(1);
    expect(calls.alpha).toBeCloseTo(0.5);
    stepper.advance(0.0625);
    expect(calls.updates).toBe(2);
    expect(calls.alpha).toBeCloseTo(0);
  });

  it('clamps long pauses', () => {
    const { calls, stepper } = harness();
    stepper.advance(10);
    expect(calls.updates).toBe(2);
  });

  it('ignores negative elapsed time', () => {
    const { calls, stepper } = harness();
    stepper.advance(-1);
    expect(calls.updates).toBe(0);
  });
});
