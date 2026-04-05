import type { Skeleton } from './Skeleton.js';

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

/**
 * Base class for keyframe sequences that animate a single property.
 */
export abstract class Timeline {
  abstract apply(skeleton: Skeleton, time: number): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Binary-search for the last keyframe whose time <= given time.
 * Returns the index of the frame to interpolate FROM.
 */
function search(times: number[], time: number): number {
  let lo = 0;
  let hi = times.length - 1;
  // If time is before the first keyframe, return 0
  if (time <= times[0]) return 0;
  // If time is at or past the last keyframe, return last index
  if (time >= times[hi]) return hi;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >>> 1;
    if (times[mid] <= time) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Linear interpolation factor between two keyframes at frame/frame+1.
 */
function lerp(times: number[], frame: number, time: number): number {
  if (frame >= times.length - 1) return 0;
  const t0 = times[frame];
  const t1 = times[frame + 1];
  const dur = t1 - t0;
  if (dur === 0) return 0;
  return Math.max(0, Math.min(1, (time - t0) / dur));
}

// ---------------------------------------------------------------------------
// RotateTimeline
// ---------------------------------------------------------------------------

export class RotateTimeline extends Timeline {
  boneIndex: number;
  times: number[];
  angles: number[];

  constructor(boneIndex: number, times: number[], angles: number[]) {
    super();
    this.boneIndex = boneIndex;
    this.times = times;
    this.angles = angles;
  }

  apply(skeleton: Skeleton, time: number): void {
    const bone = skeleton.bones[this.boneIndex];
    if (!bone) return;
    const frame = search(this.times, time);
    if (frame >= this.times.length - 1) {
      bone.rotation = this.angles[frame];
      return;
    }
    const t = lerp(this.times, frame, time);
    bone.rotation = this.angles[frame] + (this.angles[frame + 1] - this.angles[frame]) * t;
  }
}

// ---------------------------------------------------------------------------
// TranslateTimeline
// ---------------------------------------------------------------------------

export class TranslateTimeline extends Timeline {
  boneIndex: number;
  times: number[];
  xs: number[];
  ys: number[];

  constructor(boneIndex: number, times: number[], xs: number[], ys: number[]) {
    super();
    this.boneIndex = boneIndex;
    this.times = times;
    this.xs = xs;
    this.ys = ys;
  }

  apply(skeleton: Skeleton, time: number): void {
    const bone = skeleton.bones[this.boneIndex];
    if (!bone) return;
    const frame = search(this.times, time);
    if (frame >= this.times.length - 1) {
      bone.x = this.xs[frame];
      bone.y = this.ys[frame];
      return;
    }
    const t = lerp(this.times, frame, time);
    bone.x = this.xs[frame] + (this.xs[frame + 1] - this.xs[frame]) * t;
    bone.y = this.ys[frame] + (this.ys[frame + 1] - this.ys[frame]) * t;
  }
}

// ---------------------------------------------------------------------------
// ScaleTimeline
// ---------------------------------------------------------------------------

export class ScaleTimeline extends Timeline {
  boneIndex: number;
  times: number[];
  scaleXs: number[];
  scaleYs: number[];

  constructor(boneIndex: number, times: number[], scaleXs: number[], scaleYs: number[]) {
    super();
    this.boneIndex = boneIndex;
    this.times = times;
    this.scaleXs = scaleXs;
    this.scaleYs = scaleYs;
  }

  apply(skeleton: Skeleton, time: number): void {
    const bone = skeleton.bones[this.boneIndex];
    if (!bone) return;
    const frame = search(this.times, time);
    if (frame >= this.times.length - 1) {
      bone.scaleX = this.scaleXs[frame];
      bone.scaleY = this.scaleYs[frame];
      return;
    }
    const t = lerp(this.times, frame, time);
    bone.scaleX = this.scaleXs[frame] + (this.scaleXs[frame + 1] - this.scaleXs[frame]) * t;
    bone.scaleY = this.scaleYs[frame] + (this.scaleYs[frame + 1] - this.scaleYs[frame]) * t;
  }
}

// ---------------------------------------------------------------------------
// ColorTimeline
// ---------------------------------------------------------------------------

export class ColorTimeline extends Timeline {
  slotIndex: number;
  times: number[];
  rs: number[];
  gs: number[];
  bs: number[];
  as: number[];

  constructor(
    slotIndex: number,
    times: number[],
    rs: number[],
    gs: number[],
    bs: number[],
    as: number[],
  ) {
    super();
    this.slotIndex = slotIndex;
    this.times = times;
    this.rs = rs;
    this.gs = gs;
    this.bs = bs;
    this.as = as;
  }

  apply(skeleton: Skeleton, time: number): void {
    const slot = skeleton.slots[this.slotIndex];
    if (!slot) return;
    const frame = search(this.times, time);
    if (frame >= this.times.length - 1) {
      slot.color.set(this.rs[frame], this.gs[frame], this.bs[frame], this.as[frame]);
      return;
    }
    const t = lerp(this.times, frame, time);
    slot.color.set(
      this.rs[frame] + (this.rs[frame + 1] - this.rs[frame]) * t,
      this.gs[frame] + (this.gs[frame + 1] - this.gs[frame]) * t,
      this.bs[frame] + (this.bs[frame + 1] - this.bs[frame]) * t,
      this.as[frame] + (this.as[frame + 1] - this.as[frame]) * t,
    );
  }
}

// ---------------------------------------------------------------------------
// AttachmentTimeline
// ---------------------------------------------------------------------------

export class AttachmentTimeline extends Timeline {
  slotIndex: number;
  times: number[];
  names: (string | null)[];

  constructor(slotIndex: number, times: number[], names: (string | null)[]) {
    super();
    this.slotIndex = slotIndex;
    this.times = times;
    this.names = names;
  }

  apply(skeleton: Skeleton, time: number): void {
    const slot = skeleton.slots[this.slotIndex];
    if (!slot) return;
    const frame = search(this.times, time);
    const name = this.names[frame];
    if (name === null) {
      slot.attachment = null;
    } else if (skeleton.skin) {
      const attachment = skeleton.skin.getAttachment(this.slotIndex, name);
      slot.attachment = attachment;
    }
  }
}
