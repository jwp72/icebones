import { describe, expect, it } from 'vitest';
import { SkeletonJson } from '../SkeletonJson.js';
import { RegionAttachment } from '../Attachment.js';
import { RotateTimeline } from '../Timeline.js';

const EXAMPLE_JSON = {
  skeleton: { width: 256, height: 384 },
  bones: [
    { name: 'root' },
    {
      name: 'hip',
      parent: 'root',
      x: 0,
      y: 170,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      length: 0,
    },
  ],
  slots: [
    {
      name: 'body',
      bone: 'hip',
      attachment: 'body-sprite',
      color: 'ffffffff',
    },
  ],
  skins: [
    {
      name: 'default',
      attachments: {
        body: {
          'body-sprite': {
            type: 'region',
            x: 0,
            y: 0,
            width: 80,
            height: 100,
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
            { time: 1, angle: 5 },
            { time: 2, angle: 0 },
          ],
          translate: [{ time: 0, x: 0, y: 0 }],
          scale: [{ time: 0, x: 1, y: 1 }],
        },
      },
      slots: {
        body: {
          color: [{ time: 0, color: 'ffffffff' }],
          attachment: [{ time: 0, name: 'body-sprite' }],
        },
      },
    },
  },
};

describe('JSON parsing', () => {
  it('parses skeleton metadata', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EXAMPLE_JSON);
    expect(data.width).toBe(256);
    expect(data.height).toBe(384);
  });

  it('parses bones with parent references', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EXAMPLE_JSON);

    expect(data.bones).toHaveLength(2);
    expect(data.bones[0].name).toBe('root');
    expect(data.bones[0].parentIndex).toBe(-1);
    expect(data.bones[1].name).toBe('hip');
    expect(data.bones[1].parentIndex).toBe(0);
    expect(data.bones[1].y).toBe(170);
  });

  it('parses slots with bone references', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EXAMPLE_JSON);

    expect(data.slots).toHaveLength(1);
    expect(data.slots[0].name).toBe('body');
    expect(data.slots[0].boneIndex).toBe(1); // hip
    expect(data.slots[0].attachmentName).toBe('body-sprite');
    expect(data.slots[0].color).toBe('ffffffff');
  });

  it('parses skins with region attachments', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EXAMPLE_JSON);

    expect(data.skins).toHaveLength(1);
    const skin = data.skins[0];
    expect(skin.name).toBe('default');

    const att = skin.getAttachment(0, 'body-sprite');
    expect(att).not.toBeNull();
    expect(att).toBeInstanceOf(RegionAttachment);
    const region = att as RegionAttachment;
    expect(region.width).toBe(80);
    expect(region.height).toBe(100);
  });

  it('parses animations with all timeline types', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EXAMPLE_JSON);

    expect(data.animations).toHaveLength(1);
    const anim = data.animations[0];
    expect(anim.name).toBe('idle');
    expect(anim.duration).toBe(2); // last keyframe is at t=2

    // Check timeline types present
    const types = anim.timelines.map((t) => t.constructor.name);
    expect(types).toContain('RotateTimeline');
    expect(types).toContain('TranslateTimeline');
    expect(types).toContain('ScaleTimeline');
    expect(types).toContain('ColorTimeline');
    expect(types).toContain('AttachmentTimeline');
  });

  it('RotateTimeline has correct keyframe data', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EXAMPLE_JSON);
    const anim = data.animations[0];
    const rotTimeline = anim.timelines.find(
      (t) => t instanceof RotateTimeline,
    ) as RotateTimeline;

    expect(rotTimeline).toBeDefined();
    expect(rotTimeline.boneIndex).toBe(1); // hip
    expect(rotTimeline.times).toEqual([0, 1, 2]);
    expect(rotTimeline.angles).toEqual([0, 5, 0]);
  });

  it('findBone, findSlot, findSkin, findAnimation work', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData(EXAMPLE_JSON);

    expect(data.findBone('root')).not.toBeNull();
    expect(data.findBone('nonexistent')).toBeNull();
    expect(data.findSlot('body')).not.toBeNull();
    expect(data.findSlot('nonexistent')).toBeNull();
    expect(data.findSkin('default')).not.toBeNull();
    expect(data.findSkin('nonexistent')).toBeNull();
    expect(data.findAnimation('idle')).not.toBeNull();
    expect(data.findAnimation('nonexistent')).toBeNull();
  });

  it('handles missing optional fields with defaults', () => {
    const parser = new SkeletonJson();
    const data = parser.readSkeletonData({
      bones: [{ name: 'root' }],
      slots: [],
    });

    expect(data.bones[0].x).toBe(0);
    expect(data.bones[0].y).toBe(0);
    expect(data.bones[0].rotation).toBe(0);
    expect(data.bones[0].scaleX).toBe(1);
    expect(data.bones[0].scaleY).toBe(1);
    expect(data.bones[0].length).toBe(0);
    expect(data.width).toBe(0);
    expect(data.height).toBe(0);
  });
});
