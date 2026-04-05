// Re-export the PixiJS renderer.
export { SkeletonRenderer } from './SkeletonRenderer.js';

// Re-export everything from @icebones/core for convenience,
// so consumers can import both renderer and core types from a single package.
export {
  Color,
  Bone,
  Attachment,
  RegionAttachment,
  Slot,
  Skin,
  SkeletonData,
  Skeleton,
  Timeline,
  RotateTimeline,
  TranslateTimeline,
  ScaleTimeline,
  ColorTimeline,
  AttachmentTimeline,
  Animation,
  AnimationState,
  TrackEntry,
  SkeletonJson,
} from '@icebones/core';

export type { BoneData, SlotData } from '@icebones/core';
