import assert from 'node:assert/strict';
import test from 'node:test';
import { clamp, lerp, lin, ramp, smooth, within } from '../src/scene/math.js';
import { shouldActivateMarquee } from '../src/ui/carousel.ts';

test('scene math utilities clamp, interpolate, smoothstep, and ramp accurately', () => {
  assert.equal(clamp(-2, 0, 1), 0);
  assert.equal(clamp(3, 0, 1), 1);
  assert.equal(lerp(10, 20, 0.25), 12.5);
  assert.equal(smooth(0), 0);
  assert.equal(smooth(0.5), 0.5);
  assert.equal(smooth(1), 1);
  assert.equal(within(0.25, 0.2, 0.3), 0.5);
  assert.equal(ramp(0.25, [0.2, 0.3]), 0.5);
  assert.equal(
    lin(0.5, [
      [0, 10],
      [1, 30],
    ]),
    20,
  );
});

test('client showcase disables marquee for fewer than 4 clients and enables for 4+', () => {
  assert.equal(shouldActivateMarquee(1, false), false);
  assert.equal(shouldActivateMarquee(3, false), false);
  assert.equal(shouldActivateMarquee(4, false), true);
  assert.equal(shouldActivateMarquee(6, true), false);
});
