import { describe, expect, it } from 'vitest';
import { RegionAttachment } from '../Attachment.js';
import { Skeleton } from '../Skeleton.js';
import { SkeletonData } from '../SkeletonData.js';
import { SkeletonJson } from '../SkeletonJson.js';
import { Skin } from '../Skin.js';

const EXAMPLE_JSON = {
  skeleton: { width: 256, height: 384 },
  bones: [
    { name: 'root' },
    { name: 'hip', parent: 'root', x: 0, y: 170 },
    { name: 'torso', parent: 'hip', x: 0, y: 100 },
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
          'body-sprite': { type: 'region', width: 80, height: 100 },
        },
        head: {
          'head-sprite': { type: 'region', width: 40, height: 40 },
        },
      },
    },
  ],
  animations: {},
};

describe('Skeleton instantiation', () => {
  it('creates bones matching SkeletonData', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EXAMPLE_JSON);
    const skeleton = new Skeleton(data);

    expect(skeleton.bones).toHaveLength(3);
    expect(skeleton.bones[0].name).toBe('root');
    expect(skeleton.bones[1].name).toBe('hip');
    expect(skeleton.bones[2].name).toBe('torso');
  });

  it('bone hierarchy is wired correctly', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EXAMPLE_JSON);
    const skeleton = new Skeleton(data);

    expect(skeleton.bones[0].parent).toBeNull();
    expect(skeleton.bones[1].parent).toBe(skeleton.bones[0]);
    expect(skeleton.bones[2].parent).toBe(skeleton.bones[1]);
  });

  it('bones have correct local transforms from data', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EXAMPLE_JSON);
    const skeleton = new Skeleton(data);

    expect(skeleton.bones[1].y).toBe(170);
    expect(skeleton.bones[2].y).toBe(100);
  });

  it('creates slots matching SkeletonData', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EXAMPLE_JSON);
    const skeleton = new Skeleton(data);

    expect(skeleton.slots).toHaveLength(2);
    expect(skeleton.slots[0].name).toBe('body');
    expect(skeleton.slots[0].bone).toBe(skeleton.bones[1]); // hip
    expect(skeleton.slots[1].name).toBe('head');
    expect(skeleton.slots[1].bone).toBe(skeleton.bones[2]); // torso
  });

  it('setSkin applies attachments from skin', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EXAMPLE_JSON);
    const skeleton = new Skeleton(data);

    // Before setting skin, no attachments
    expect(skeleton.slots[0].attachment).toBeNull();

    const defaultSkin = data.findSkin('default')!;
    skeleton.setSkin(defaultSkin);

    expect(skeleton.slots[0].attachment).not.toBeNull();
    expect(skeleton.slots[0].attachment!.name).toBe('body-sprite');
    expect(skeleton.slots[1].attachment).not.toBeNull();
    expect(skeleton.slots[1].attachment!.name).toBe('head-sprite');
  });

  it('setSkin with null clears attachments', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EXAMPLE_JSON);
    const skeleton = new Skeleton(data);

    const defaultSkin = data.findSkin('default')!;
    skeleton.setSkin(defaultSkin);
    expect(skeleton.slots[0].attachment).not.toBeNull();

    skeleton.setSkin(null);
    expect(skeleton.slots[0].attachment).toBeNull();
    expect(skeleton.slots[1].attachment).toBeNull();
  });

  it('findBone and findSlot work on skeleton instance', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EXAMPLE_JSON);
    const skeleton = new Skeleton(data);

    expect(skeleton.findBone('hip')).toBe(skeleton.bones[1]);
    expect(skeleton.findBone('nonexistent')).toBeNull();
    expect(skeleton.findSlot('body')).toBe(skeleton.slots[0]);
    expect(skeleton.findSlot('nonexistent')).toBeNull();
  });

  it('updateWorldTransform computes world transforms for all bones', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EXAMPLE_JSON);
    const skeleton = new Skeleton(data);

    skeleton.updateWorldTransform();

    expect(skeleton.bones[0].worldX).toBeCloseTo(0);
    expect(skeleton.bones[0].worldY).toBeCloseTo(0);
    expect(skeleton.bones[1].worldX).toBeCloseTo(0);
    expect(skeleton.bones[1].worldY).toBeCloseTo(170);
    expect(skeleton.bones[2].worldX).toBeCloseTo(0);
    expect(skeleton.bones[2].worldY).toBeCloseTo(270);
  });

  it('switching skins swaps attachments', () => {
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
    data.slots.push({
      index: 0,
      name: 'body',
      boneIndex: 0,
      attachmentName: 'body',
      color: 'ffffffff',
    });

    const skinA = new Skin('skinA');
    const attA = new RegionAttachment('body-a');
    skinA.setAttachment(0, 'body', attA);

    const skinB = new Skin('skinB');
    const attB = new RegionAttachment('body-b');
    skinB.setAttachment(0, 'body', attB);

    data.skins.push(skinA, skinB);

    const skeleton = new Skeleton(data);

    skeleton.setSkin(skinA);
    expect(skeleton.slots[0].attachment).toBe(attA);

    skeleton.setSkin(skinB);
    expect(skeleton.slots[0].attachment).toBe(attB);
  });
});
