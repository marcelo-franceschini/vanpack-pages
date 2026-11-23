import assert from 'node:assert/strict';
import test from 'node:test';
import { clamp, damp, lerp, ramp, smooth } from '../src/engine/math.ts';
import {
  MAX_PITCH,
  applyDragDelta,
  createTurntableState,
  stepTurntable,
} from '../src/scenes/catalog/physics.ts';
import { shouldActivateMarquee } from '../src/ui/carousel.ts';
import { chapterIndexFromProgress, scrollTargetForChapter } from '../src/ui/story.ts';

test('math utilities clamp, interpolate, smoothstep, and damp accurately', () => {
  assert.equal(clamp(-2, 0, 1), 0);
  assert.equal(clamp(3, 0, 1), 1);
  assert.equal(lerp(10, 20, 0.25), 12.5);
  assert.equal(smooth(0), 0);
  assert.equal(smooth(0.5), 0.5);
  assert.equal(smooth(1), 1);
  assert.equal(ramp(0.25, 0.2, 0.3), 0.5);
  const damped = damp(0, 10, 6, 0.1);
  assert.ok(damped > 4 && damped < 6);
});

test('story chapter mapping and scroll target calculation cover all 5 chapters cleanly', () => {
  assert.equal(chapterIndexFromProgress(0), 0);
  assert.equal(chapterIndexFromProgress(0.24), 1);
  assert.equal(chapterIndexFromProgress(0.49), 2);
  assert.equal(chapterIndexFromProgress(0.74), 3);
  assert.equal(chapterIndexFromProgress(0.96), 4);

  const y0 = scrollTargetForChapter(0, 5000, 1000, 0);
  const y2 = scrollTargetForChapter(0, 5000, 1000, 2);
  const y4 = scrollTargetForChapter(0, 5000, 1000, 4);
  assert.equal(y0, 0);
  assert.ok(y2 > y0 && y4 > y2);
});

test('catalog turntable clamps vertical pitch, glides with inertia, and springs back to horizon', () => {
  const state = createTurntableState(0);
  state.dragging = true;
  applyDragDelta(state, 120, 400, 1 / 60);

  assert.equal(state.pitch, MAX_PITCH, 'vertical pitch must clamp to MAX_PITCH');
  assert.ok(state.yaw > 0.5);
  assert.ok(state.yawVel > 0);

  state.dragging = false;
  const yawAtRelease = state.yaw;
  for (let i = 0; i < 60; i++) {
    stepTurntable(state, 1 / 60, false);
  }
  assert.ok(state.yaw > yawAtRelease, 'inertial glide continues after drag release');
  assert.ok(Math.abs(state.pitch) < 0.05, 'vertical pitch smoothly springs back toward neutral');
});

test('client showcase disables marquee for fewer than 4 clients and enables for 4+', () => {
  assert.equal(shouldActivateMarquee(1, false), false);
  assert.equal(shouldActivateMarquee(3, false), false);
  assert.equal(shouldActivateMarquee(4, false), true);
  assert.equal(shouldActivateMarquee(6, true), false);
});
