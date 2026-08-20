export function createOrbMotionState(phase) {
  return {
    phase,
    audioSmooth: 0,
    audioFast: 0,
    spinDir: 1,
    spinVel: 0,
    prevA: 0,
    flipQueued: false,
    oscSign: 1,
    spin: phase * 3.7,
    lastT: null,
  };
}

export function advanceOrbMotion(state, time, audioLevel, motion = undefined) {
  const delta = state.lastT === null
    ? 0
    : Math.min(0.1, Math.max(0, time - state.lastT));
  state.lastT = time;

  const input = Math.min(1, Math.max(0, audioLevel));
  const speed = Math.min(2, Math.max(0, motion?.speed ?? 1));
  const driftAmount = Math.min(2, Math.max(0, motion?.drift ?? 1));
  const smoothConstant = input > state.audioSmooth ? 0.11 : 0.3;
  state.audioSmooth += (input - state.audioSmooth)
    * (delta > 0 ? 1 - Math.exp(-delta / smoothConstant) : 0);

  const fastConstant = input > state.audioFast ? 0.04 : 0.18;
  state.audioFast += (input - state.audioFast)
    * (delta > 0 ? 1 - Math.exp(-delta / fastConstant) : 0);

  const phaseVariance = (6.31 * state.phase) % 1;
  const drift = driftAmount * 0.35 * Math.sin(
    time * (0.11 + 0.08 * ((2.17 * state.phase) % 1)) + state.phase,
  );
  const oscillator = Math.sin(time * (0.45 + 0.2 * phaseVariance) + state.phase);
  if (Math.sign(oscillator) !== state.oscSign) {
    state.oscSign = Math.sign(oscillator);
    state.flipQueued = true;
  }
  if (state.flipQueued && state.audioFast < 0.18) {
    state.spinDir = -state.spinDir;
    state.flipQueued = false;
  }

  const targetVelocity = speed * (
    0.65 * (0.65 + 0.7 * phaseVariance) * (1 + drift)
    + state.spinDir * state.audioFast * 2.2
  );
  state.spinVel += (targetVelocity - state.spinVel)
    * (delta > 0 ? 1 - Math.exp(-delta / 0.35) : 0);
  const attack = Math.max(0, state.audioFast - state.prevA);
  state.prevA = state.audioFast;
  state.spinVel += state.spinDir * Math.min(6 * attack, 1.4) * delta * 14 * speed;
  state.spin += state.spinVel * delta;
  return state;
}
