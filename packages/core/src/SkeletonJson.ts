import { Animation } from './Animation.js';
import { Attachment, RegionAttachment } from './Attachment.js';
import { Skin } from './Skin.js';
import { SkeletonData } from './SkeletonData.js';
import type { BoneData, SlotData } from './SkeletonData.js';
import {
  AttachmentTimeline,
  ColorTimeline,
  RotateTimeline,
  ScaleTimeline,
  type Timeline,
  TranslateTimeline,
} from './Timeline.js';
import { Color } from './Color.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Parses Spine 4.2-compatible JSON into SkeletonData.
 */
export class SkeletonJson {
  /**
   * Parse a raw JSON object (already JSON.parse'd) into SkeletonData.
   */
  readSkeletonData(json: any): SkeletonData {
    const data = new SkeletonData();

    // --- skeleton metadata ---
    if (json.skeleton) {
      data.width = json.skeleton.width ?? 0;
      data.height = json.skeleton.height ?? 0;
    }

    // --- bones ---
    if (json.bones) {
      for (let i = 0; i < json.bones.length; i++) {
        const boneJson = json.bones[i];
        const parentIndex = boneJson.parent
          ? data.findBoneIndex(boneJson.parent)
          : -1;
        const bd: BoneData = {
          index: i,
          name: boneJson.name,
          parentIndex,
          length: boneJson.length ?? 0,
          x: boneJson.x ?? 0,
          y: boneJson.y ?? 0,
          rotation: boneJson.rotation ?? 0,
          scaleX: boneJson.scaleX ?? 1,
          scaleY: boneJson.scaleY ?? 1,
        };
        data.bones.push(bd);
      }
    }

    // --- slots ---
    if (json.slots) {
      for (let i = 0; i < json.slots.length; i++) {
        const slotJson = json.slots[i];
        const boneIndex = data.findBoneIndex(slotJson.bone);
        const sd: SlotData = {
          index: i,
          name: slotJson.name,
          boneIndex,
          attachmentName: slotJson.attachment ?? null,
          color: slotJson.color ?? 'ffffffff',
        };
        data.slots.push(sd);
      }
    }

    // --- skins ---
    if (json.skins) {
      for (const skinJson of json.skins) {
        const skin = new Skin(skinJson.name);
        if (skinJson.attachments) {
          for (const slotName of Object.keys(skinJson.attachments)) {
            const slotIndex = data.findSlotIndex(slotName);
            const slotAttachments = skinJson.attachments[slotName];
            for (const attachName of Object.keys(slotAttachments)) {
              const attachJson = slotAttachments[attachName];
              const attachment = this.readAttachment(attachName, attachJson);
              if (attachment) {
                skin.setAttachment(slotIndex, attachName, attachment);
              }
            }
          }
        }
        data.skins.push(skin);
      }
    }

    // --- animations ---
    if (json.animations) {
      for (const animName of Object.keys(json.animations)) {
        const animJson = json.animations[animName];
        const animation = this.readAnimation(animName, animJson, data);
        data.animations.push(animation);
      }
    }

    return data;
  }

  private readAttachment(name: string, json: any): Attachment | null {
    const type = json.type ?? 'region';
    if (type === 'region') {
      const att = new RegionAttachment(name);
      att.x = json.x ?? 0;
      att.y = json.y ?? 0;
      att.rotation = json.rotation ?? 0;
      att.scaleX = json.scaleX ?? 1;
      att.scaleY = json.scaleY ?? 1;
      att.width = json.width ?? 0;
      att.height = json.height ?? 0;
      if (json.name) att.regionName = json.name;
      return att;
    }
    // Unknown attachment types return a base Attachment for forward compatibility.
    return new Attachment(name);
  }

  private readAnimation(name: string, json: any, data: SkeletonData): Animation {
    const timelines: Timeline[] = [];
    let duration = 0;

    // --- bone timelines ---
    if (json.bones) {
      for (const boneName of Object.keys(json.bones)) {
        const boneIndex = data.findBoneIndex(boneName);
        if (boneIndex < 0) continue;
        const boneTimelines = json.bones[boneName];

        if (boneTimelines.rotate) {
          const frames: any[] = boneTimelines.rotate;
          const times: number[] = [];
          const angles: number[] = [];
          for (const f of frames) {
            times.push(f.time);
            angles.push(f.angle ?? 0);
            if (f.time > duration) duration = f.time;
          }
          timelines.push(new RotateTimeline(boneIndex, times, angles));
        }

        if (boneTimelines.translate) {
          const frames: any[] = boneTimelines.translate;
          const times: number[] = [];
          const xs: number[] = [];
          const ys: number[] = [];
          for (const f of frames) {
            times.push(f.time);
            xs.push(f.x ?? 0);
            ys.push(f.y ?? 0);
            if (f.time > duration) duration = f.time;
          }
          timelines.push(new TranslateTimeline(boneIndex, times, xs, ys));
        }

        if (boneTimelines.scale) {
          const frames: any[] = boneTimelines.scale;
          const times: number[] = [];
          const scaleXs: number[] = [];
          const scaleYs: number[] = [];
          for (const f of frames) {
            times.push(f.time);
            scaleXs.push(f.x ?? 1);
            scaleYs.push(f.y ?? 1);
            if (f.time > duration) duration = f.time;
          }
          timelines.push(new ScaleTimeline(boneIndex, times, scaleXs, scaleYs));
        }
      }
    }

    // --- slot timelines ---
    if (json.slots) {
      for (const slotName of Object.keys(json.slots)) {
        const slotIndex = data.findSlotIndex(slotName);
        if (slotIndex < 0) continue;
        const slotTimelines = json.slots[slotName];

        if (slotTimelines.color) {
          const frames: any[] = slotTimelines.color;
          const times: number[] = [];
          const rs: number[] = [];
          const gs: number[] = [];
          const bs: number[] = [];
          const as: number[] = [];
          for (const f of frames) {
            times.push(f.time);
            const c = new Color();
            c.setFromString(f.color ?? 'ffffffff');
            rs.push(c.r);
            gs.push(c.g);
            bs.push(c.b);
            as.push(c.a);
            if (f.time > duration) duration = f.time;
          }
          timelines.push(new ColorTimeline(slotIndex, times, rs, gs, bs, as));
        }

        if (slotTimelines.attachment) {
          const frames: any[] = slotTimelines.attachment;
          const times: number[] = [];
          const names: (string | null)[] = [];
          for (const f of frames) {
            times.push(f.time);
            names.push(f.name ?? null);
            if (f.time > duration) duration = f.time;
          }
          timelines.push(new AttachmentTimeline(slotIndex, times, names));
        }
      }
    }

    return new Animation(name, timelines, duration);
  }
}
