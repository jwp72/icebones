import { describe, expect, it } from 'vitest';
import { Animation } from '../Animation.js';
import { AnimationState } from '../AnimationState.js';
import { Skeleton } from '../Skeleton.js';
import { SkeletonData } from '../SkeletonData.js';
import { RotateTimeline, TranslateTimeline, ScaleTimeline } from '../Timeline.js';

function makeSimpleData(): SkeletonData {
  const data = new SkeletonData();
  data.bones.push({
    index: 0,
    name: 'root',
    parentIndex: -1,
    length: 0,
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  });
  data.bones.push({
    index: 1,
    name: 'hip',
    parentIndex: 0,
    length: 0,
    x: 0,
    y: 170,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  });
  return data;
}

describe('Animation playback', () => {
  it('RotateTimeline interpolates between keyframes', () => {
    const data = makeSimpleData();

    // Animation: bone 1 (hip) rotates 0° → 10° over 1 second
    const rotateTimeline = new RotateTimeline(1, [0, 1], [0, 10]);
    const animation = new Animation('test', [rotateTimeline], 1);
    data.animations.push(animation);

    const skeleton = new Skeleton(data);
    const state = new AnimationState(data);

    state.setAnimation(0, 'test', false);
    state.update(0.5); // halfway
    state.apply(skeleton);

    expect(skeleton.bones[1].rotation).toBeCloseTo(5); // linear interpolation at 50%
  });

  it('RotateTimeline clamps to last keyframe past duration', () => {
    const data = makeSimpleData();

    const rotateTimeline = new RotateTimeline(1, [0, 1], [0, 20]);
    const animation = new Animation('test', [rotateTimeline], 1);
    data.animations.push(animation);

    const skeleton = new Skeleton(data);
    const state = new AnimationState(data);

    state.setAnimation(0, 'test', false);
    state.update(2); // past end
    state.apply(skeleton);

    expect(skeleton.bones[1].rotation).toBeCloseTo(20);
  });

  it('TranslateTimeline interpolates x and y', () => {
    const data = makeSimpleData();

    const translateTimeline = new TranslateTimeline(1, [0, 2], [0, 100], [0, 200]);
    const animation = new Animation('move', [translateTimeline], 2);
    data.animations.push(animation);

    const skeleton = new Skeleton(data);
    const state = new AnimationState(data);

    state.setAnimation(0, 'move', false);
    state.update(1); // halfway through a 2s animation
    state.apply(skeleton);

    expect(skeleton.bones[1].x).toBeCloseTo(50);
    expect(skeleton.bones[1].y).toBeCloseTo(100);
  });

  it('ScaleTimeline interpolates scaleX and scaleY', () => {
    const data = makeSimpleData();

    const scaleTimeline = new ScaleTimeline(0, [0, 1], [1, 2], [1, 3]);
    const animation = new Animation('grow', [scaleTimeline], 1);
    data.animations.push(animation);

    const skeleton = new Skeleton(data);
    const state = new AnimationState(data);

    state.setAnimation(0, 'grow', false);
    state.update(0.5);
    state.apply(skeleton);

    expect(skeleton.bones[0].scaleX).toBeCloseTo(1.5);
    expect(skeleton.bones[0].scaleY).toBeCloseTo(2);
  });

  it('looping animation wraps time around', () => {
    const data = makeSimpleData();

    // Animation: 0° at t=0, 10° at t=1, 0° at t=2
    const rotateTimeline = new RotateTimeline(1, [0, 1, 2], [0, 10, 0]);
    const animation = new Animation('bounce', [rotateTimeline], 2);
    data.animations.push(animation);

    const skeleton = new Skeleton(data);
    const state = new AnimationState(data);

    state.setAnimation(0, 'bounce', true);
    state.update(2.5); // wraps to t=0.5
    state.apply(skeleton);

    expect(skeleton.bones[1].rotation).toBeCloseTo(5); // halfway between 0° and 10°
  });

  it('AnimationState.addAnimation queues animations', () => {
    const data = makeSimpleData();

    const rotA = new RotateTimeline(1, [0, 1], [0, 10]);
    const animA = new Animation('first', [rotA], 1);
    const rotB = new RotateTimeline(1, [0, 1], [20, 30]);
    const animB = new Animation('second', [rotB], 1);
    data.animations.push(animA);
    data.animations.push(animB);

    const skeleton = new Skeleton(data);
    const state = new AnimationState(data);

    state.setAnimation(0, 'first', false);
    state.addAnimation(0, 'second', false, 0);

    // Play through first animation to completion
    state.update(1.0);
    // Now should have transitioned to second animation
    state.apply(skeleton);

    // After switching, second anim should be playing. At time ~0, rotation = 20
    expect(skeleton.bones[1].rotation).toBeCloseTo(20);
  });
});
