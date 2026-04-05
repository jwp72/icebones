import { describe, expect, it } from 'vitest';
import { SkeletonJson } from '../SkeletonJson.js';
import { Skeleton } from '../Skeleton.js';
import { AnimationState } from '../AnimationState.js';
import { RegionAttachment } from '../Attachment.js';

/**
 * Round-trip integration test: editor export -> runtime import -> render verification.
 *
 * This JSON mirrors what the editor's exportToJSON() method produces for a
 * simple 3-bone character with 2 slots, 1 skin, and 2 animations.
 */
const EDITOR_EXPORT_JSON = {
  skeleton: { icebones: '1.0.0', width: 256, height: 384 },
  bones: [
    { name: 'root' },
    { name: 'hip', parent: 'root', x: 0, y: 170 },
    { name: 'torso', parent: 'hip', x: 0, y: 100, rotation: 5 },
  ],
  slots: [
    { name: 'body', bone: 'hip', attachment: 'body-sprite' },
    { name: 'head', bone: 'torso', attachment: 'head-sprite' },
  ],
  skins: [
    {
      name: 'default',
      attachments: {
        body: {
          'body-sprite': {
            x: 0,
            y: 10,
            width: 80,
            height: 120,
          },
        },
        head: {
          'head-sprite': {
            x: 0,
            y: 0,
            width: 40,
            height: 40,
            name: 'head-region',
          },
        },
      },
    },
    {
      name: 'alternate',
      attachments: {
        body: {
          'body-sprite': {
            x: 0,
            y: 5,
            width: 90,
            height: 130,
            name: 'alt-body-region',
          },
        },
        head: {
          'head-sprite': {
            x: 0,
            y: 0,
            width: 44,
            height: 44,
          },
        },
      },
    },
  ],
  animations: {
    idle: {
      bones: {
        hip: {
          rotate: [
            { time: 0, angle: 0 },
            { time: 0.5, angle: 3 },
            { time: 1, angle: 0 },
          ],
          translate: [
            { time: 0, x: 0, y: 170 },
            { time: 0.5, x: 0, y: 175 },
            { time: 1, x: 0, y: 170 },
          ],
        },
        torso: {
          scale: [
            { time: 0, x: 1, y: 1 },
            { time: 0.5, x: 1.05, y: 1.05 },
            { time: 1, x: 1, y: 1 },
          ],
        },
      },
      slots: {
        body: {
          color: [
            { time: 0, color: 'ffffffff' },
            { time: 0.5, color: 'ff0000ff' },
            { time: 1, color: 'ffffffff' },
          ],
        },
      },
    },
    wave: {
      bones: {
        torso: {
          rotate: [
            { time: 0, angle: 0 },
            { time: 0.3, angle: -15 },
            { time: 0.6, angle: 15 },
            { time: 1, angle: 0 },
          ],
        },
      },
      slots: {
        head: {
          attachment: [
            { time: 0, name: 'head-sprite' },
            { time: 0.5, name: null },
            { time: 0.8, name: 'head-sprite' },
          ],
        },
      },
    },
  },
};

describe('Round-trip integration: editor export -> runtime import -> render', () => {
  it('parses editor export JSON into SkeletonData without errors', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EDITOR_EXPORT_JSON);

    expect(data.width).toBe(256);
    expect(data.height).toBe(384);
    expect(data.bones).toHaveLength(3);
    expect(data.slots).toHaveLength(2);
    expect(data.skins).toHaveLength(2);
    expect(data.animations).toHaveLength(2);
  });

  it('creates a Skeleton from the parsed data', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EDITOR_EXPORT_JSON);
    const skeleton = new Skeleton(data);

    expect(skeleton.bones).toHaveLength(3);
    expect(skeleton.slots).toHaveLength(2);

    // Verify bone hierarchy
    expect(skeleton.bones[0].name).toBe('root');
    expect(skeleton.bones[0].parent).toBeNull();
    expect(skeleton.bones[1].name).toBe('hip');
    expect(skeleton.bones[1].parent).toBe(skeleton.bones[0]);
    expect(skeleton.bones[2].name).toBe('torso');
    expect(skeleton.bones[2].parent).toBe(skeleton.bones[1]);

    // Verify bone local transforms
    expect(skeleton.bones[1].y).toBe(170);
    expect(skeleton.bones[2].y).toBe(100);
    expect(skeleton.bones[2].rotation).toBe(5);

    // Verify slots reference correct bones
    expect(skeleton.slots[0].name).toBe('body');
    expect(skeleton.slots[0].bone).toBe(skeleton.bones[1]);
    expect(skeleton.slots[1].name).toBe('head');
    expect(skeleton.slots[1].bone).toBe(skeleton.bones[2]);
  });

  it('sets a skin and verifies slot attachments update', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EDITOR_EXPORT_JSON);
    const skeleton = new Skeleton(data);

    // Before setting skin, no attachments
    expect(skeleton.slots[0].attachment).toBeNull();
    expect(skeleton.slots[1].attachment).toBeNull();

    // Set default skin
    const defaultSkin = data.findSkin('default')!;
    expect(defaultSkin).not.toBeNull();
    skeleton.setSkin(defaultSkin);

    // Attachments should now be populated
    expect(skeleton.slots[0].attachment).not.toBeNull();
    expect(skeleton.slots[0].attachment!.name).toBe('body-sprite');
    expect(skeleton.slots[0].attachment).toBeInstanceOf(RegionAttachment);

    const bodyRegion = skeleton.slots[0].attachment as RegionAttachment;
    expect(bodyRegion.width).toBe(80);
    expect(bodyRegion.height).toBe(120);
    expect(bodyRegion.y).toBe(10);
    // regionName defaults to attachment name when no 'name' field present
    expect(bodyRegion.regionName).toBe('body-sprite');

    expect(skeleton.slots[1].attachment).not.toBeNull();
    expect(skeleton.slots[1].attachment!.name).toBe('head-sprite');
    const headRegion = skeleton.slots[1].attachment as RegionAttachment;
    expect(headRegion.width).toBe(40);
    expect(headRegion.height).toBe(40);
    // This attachment has a custom regionName via the 'name' field
    expect(headRegion.regionName).toBe('head-region');
  });

  it('switches skins and verifies attachment dimensions change', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EDITOR_EXPORT_JSON);
    const skeleton = new Skeleton(data);

    // Set default skin
    skeleton.setSkin(data.findSkin('default')!);
    const bodyDefault = skeleton.slots[0].attachment as RegionAttachment;
    expect(bodyDefault.width).toBe(80);
    expect(bodyDefault.height).toBe(120);

    // Switch to alternate skin
    skeleton.setSkin(data.findSkin('alternate')!);
    const bodyAlt = skeleton.slots[0].attachment as RegionAttachment;
    expect(bodyAlt.width).toBe(90);
    expect(bodyAlt.height).toBe(130);
    expect(bodyAlt.regionName).toBe('alt-body-region');
  });

  it('plays the idle animation and verifies bone transforms change', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EDITOR_EXPORT_JSON);
    const skeleton = new Skeleton(data);
    const animState = new AnimationState(data);

    // Set skin so slot attachments are available
    skeleton.setSkin(data.findSkin('default')!);

    // Start playing the idle animation
    const entry = animState.setAnimation(0, 'idle', false);
    expect(entry).not.toBeNull();

    // Advance to the midpoint (0.5s)
    animState.update(0.5);
    animState.apply(skeleton);

    // Hip should have rotated to 3 degrees and translated to y=175
    expect(skeleton.bones[1].rotation).toBeCloseTo(3);
    expect(skeleton.bones[1].y).toBeCloseTo(175);

    // Torso scale should be at 1.05
    expect(skeleton.bones[2].scaleX).toBeCloseTo(1.05);
    expect(skeleton.bones[2].scaleY).toBeCloseTo(1.05);

    // Verify color timeline was applied: at t=0.5, slot body color should be red
    expect(skeleton.slots[0].color.r).toBeCloseTo(1);
    expect(skeleton.slots[0].color.g).toBeCloseTo(0);
    expect(skeleton.slots[0].color.b).toBeCloseTo(0);
    expect(skeleton.slots[0].color.a).toBeCloseTo(1);

    // Advance to end (another 0.5s)
    animState.update(0.5);
    animState.apply(skeleton);

    // Should be back to starting values
    expect(skeleton.bones[1].rotation).toBeCloseTo(0);
    expect(skeleton.bones[1].y).toBeCloseTo(170);
    expect(skeleton.bones[2].scaleX).toBeCloseTo(1);
    expect(skeleton.bones[2].scaleY).toBeCloseTo(1);
  });

  it('plays the wave animation with attachment timeline', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EDITOR_EXPORT_JSON);
    const skeleton = new Skeleton(data);
    const animState = new AnimationState(data);

    skeleton.setSkin(data.findSkin('default')!);

    // Start wave animation
    animState.setAnimation(0, 'wave', false);

    // At t=0, head attachment should be 'head-sprite'
    animState.update(0);
    animState.apply(skeleton);
    expect(skeleton.slots[1].attachment).not.toBeNull();
    expect(skeleton.slots[1].attachment!.name).toBe('head-sprite');

    // At t=0.5, head attachment should be null
    animState.update(0.5);
    animState.apply(skeleton);
    expect(skeleton.slots[1].attachment).toBeNull();

    // At t=0.8, head attachment should be back
    animState.update(0.3);
    animState.apply(skeleton);
    expect(skeleton.slots[1].attachment).not.toBeNull();
    expect(skeleton.slots[1].attachment!.name).toBe('head-sprite');
  });

  it('world transforms are computed correctly after animation', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EDITOR_EXPORT_JSON);
    const skeleton = new Skeleton(data);
    const animState = new AnimationState(data);

    skeleton.setSkin(data.findSkin('default')!);
    animState.setAnimation(0, 'idle', false);

    // Update to midpoint
    animState.update(0.5);
    animState.apply(skeleton);
    skeleton.updateWorldTransform();

    // Root should be at origin
    expect(skeleton.bones[0].worldX).toBeCloseTo(0);
    expect(skeleton.bones[0].worldY).toBeCloseTo(0);

    // Hip is child of root, at translate (0, 175) after animation
    expect(skeleton.bones[1].worldX).toBeCloseTo(0);
    expect(skeleton.bones[1].worldY).toBeCloseTo(175);

    // Torso is child of hip, offset by (0, 100) in hip-local space
    // Hip has rotation of 3 degrees applied by animation
    // Bone world transform: worldX = parent.a * x + parent.b * y + parent.worldX
    //   where parent.a = cos(rot), parent.b = sin(rot) (from Bone.updateWorldTransform)
    const hipRad = (3 * Math.PI) / 180;
    // torso local is (0, 100), hip world is (0, 175)
    // hip.a = cos(3deg), hip.b = sin(3deg), hip.c = -sin(3deg), hip.d = cos(3deg)
    const expectedTorsoX = Math.cos(hipRad) * 0 + Math.sin(hipRad) * 100 + 0;
    const expectedTorsoY = -Math.sin(hipRad) * 0 + Math.cos(hipRad) * 100 + 175;
    expect(skeleton.bones[2].worldX).toBeCloseTo(expectedTorsoX, 1);
    expect(skeleton.bones[2].worldY).toBeCloseTo(expectedTorsoY, 1);
  });

  it('looping animation cycles correctly', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EDITOR_EXPORT_JSON);
    const skeleton = new Skeleton(data);
    const animState = new AnimationState(data);

    animState.setAnimation(0, 'idle', true);

    // Advance past one full cycle (duration=1.0) to t=1.5
    // With looping, 1.5 % 1.0 = 0.5, which is the midpoint
    animState.update(1.5);
    animState.apply(skeleton);

    expect(skeleton.bones[1].rotation).toBeCloseTo(3); // same as t=0.5
    expect(skeleton.bones[1].y).toBeCloseTo(175);
  });

  it('multiple animations can be queued', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EDITOR_EXPORT_JSON);
    const skeleton = new Skeleton(data);
    const animState = new AnimationState(data);

    skeleton.setSkin(data.findSkin('default')!);

    // Queue idle then wave
    animState.setAnimation(0, 'idle', false);
    animState.addAnimation(0, 'wave', false, 0);

    // Play through idle (duration=1.0)
    animState.update(1.0);
    // Should transition to wave now
    animState.apply(skeleton);

    // At the start of wave, torso rotation should be 0
    expect(skeleton.bones[2].rotation).toBeCloseTo(0, 0);
  });

  it('animation timeline types are correctly identified', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EDITOR_EXPORT_JSON);

    const idle = data.findAnimation('idle')!;
    expect(idle).not.toBeNull();

    // idle has: hip.rotate, hip.translate, torso.scale, body.color
    const timelineTypes = idle.timelines.map((t) => t.constructor.name);
    expect(timelineTypes).toContain('RotateTimeline');
    expect(timelineTypes).toContain('TranslateTimeline');
    expect(timelineTypes).toContain('ScaleTimeline');
    expect(timelineTypes).toContain('ColorTimeline');

    const wave = data.findAnimation('wave')!;
    expect(wave).not.toBeNull();

    // wave has: torso.rotate, head.attachment
    const waveTypes = wave.timelines.map((t) => t.constructor.name);
    expect(waveTypes).toContain('RotateTimeline');
    expect(waveTypes).toContain('AttachmentTimeline');
  });

  it('RegionAttachment.computeWorldVertices works with animated bones', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EDITOR_EXPORT_JSON);
    const skeleton = new Skeleton(data);
    const animState = new AnimationState(data);

    skeleton.setSkin(data.findSkin('default')!);
    animState.setAnimation(0, 'idle', false);
    animState.update(0);
    animState.apply(skeleton);
    skeleton.updateWorldTransform();

    const bodyAttachment = skeleton.slots[0].attachment as RegionAttachment;
    expect(bodyAttachment).toBeInstanceOf(RegionAttachment);

    const verts: number[] = new Array(8);
    bodyAttachment.computeWorldVertices(skeleton.slots[0].bone, verts, 0);

    // Vertices should be 4 corners of an 80x120 rect centered at the bone's world pos + attachment offset
    // All 8 values should be finite numbers
    for (let i = 0; i < 8; i++) {
      expect(Number.isFinite(verts[i])).toBe(true);
    }

    // The 4 corners should form a valid quadrilateral (non-zero area)
    // Compute area using shoelace formula
    let area = 0;
    for (let i = 0; i < 4; i++) {
      const x0 = verts[i * 2];
      const y0 = verts[i * 2 + 1];
      const x1 = verts[((i + 1) % 4) * 2];
      const y1 = verts[((i + 1) % 4) * 2 + 1];
      area += x0 * y1 - x1 * y0;
    }
    area = Math.abs(area) / 2;
    // Area should be approximately 80 * 120 = 9600 (may differ slightly due to attachment y offset)
    expect(area).toBeGreaterThan(0);
    expect(area).toBeCloseTo(80 * 120, -1); // within order of magnitude
  });

  it('complete pipeline: parse -> skeleton -> skin -> animate -> world transform', () => {
    // This is the end-to-end smoke test
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EDITOR_EXPORT_JSON);
    const skeleton = new Skeleton(data);
    const animState = new AnimationState(data);

    // 1. Set skin
    skeleton.setSkin(data.findSkin('default')!);
    expect(skeleton.slots[0].attachment).not.toBeNull();
    expect(skeleton.slots[1].attachment).not.toBeNull();

    // 2. Start animation
    animState.setAnimation(0, 'idle', true);

    // 3. Simulate 60 frames at 60fps (1 second)
    const dt = 1 / 60;
    for (let i = 0; i < 60; i++) {
      animState.update(dt);
      animState.apply(skeleton);
      skeleton.updateWorldTransform();

      // Verify no NaN or Infinity values in bone transforms
      for (const bone of skeleton.bones) {
        expect(Number.isFinite(bone.worldX)).toBe(true);
        expect(Number.isFinite(bone.worldY)).toBe(true);
        expect(Number.isFinite(bone.a)).toBe(true);
        expect(Number.isFinite(bone.b)).toBe(true);
        expect(Number.isFinite(bone.c)).toBe(true);
        expect(Number.isFinite(bone.d)).toBe(true);
      }

      // Verify slot colors are valid
      for (const slot of skeleton.slots) {
        expect(slot.color.r).toBeGreaterThanOrEqual(0);
        expect(slot.color.r).toBeLessThanOrEqual(1);
        expect(slot.color.a).toBeGreaterThanOrEqual(0);
        expect(slot.color.a).toBeLessThanOrEqual(1);
      }
    }

    // After exactly 1 second of looping idle animation (duration=1.0),
    // we should be back very close to the start
    expect(skeleton.bones[1].rotation).toBeCloseTo(0, 0);
  });
});
