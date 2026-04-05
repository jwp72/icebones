import { create } from 'zustand';

// ─── Node types for the editor document ─────────────────────────────────────

export interface BoneNode {
  id: string;
  name: string;
  parentId: string | null;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  length: number;
}

export interface SlotNode {
  id: string;
  name: string;
  boneId: string;
  attachmentName: string | null;
  color: string; // hex "rrggbbaa"
}

export interface SkinAttachment {
  name: string;
  regionName: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SkinNode {
  id: string;
  name: string;
  attachments: Map<string, SkinAttachment>; // "slotId:attachmentName" -> attachment
}

export interface KeyframeNode {
  time: number;
  value: Record<string, number | string | null>;
}

export interface TimelineNode {
  type: string; // 'rotate' | 'translate' | 'scale' | 'color' | 'attachment'
  targetId: string; // boneId or slotId
  keyframes: KeyframeNode[];
}

export interface AnimNode {
  id: string;
  name: string;
  duration: number;
  timelines: TimelineNode[];
}

// ─── Store interface ─────────────────────────────────────────────────────────

interface DocumentState {
  bones: BoneNode[];
  slots: SlotNode[];
  skins: SkinNode[];
  animations: AnimNode[];
  images: Map<string, string>; // regionName -> data URL (base64)
  width: number;
  height: number;

  addBone: (parentId: string | null, name: string, x: number, y: number) => string;
  removeBone: (id: string) => void;
  updateBone: (id: string, updates: Partial<BoneNode>) => void;
  addSlot: (boneId: string, name: string) => string;
  removeSlot: (id: string) => void;
  updateSlot: (id: string, updates: Partial<SlotNode>) => void;
  addSkin: (name: string) => string;
  removeSkin: (id: string) => void;
  addAnimation: (name: string, duration: number) => string;
  removeAnimation: (id: string) => void;
  updateAnimation: (id: string, updates: Partial<AnimNode>) => void;
  addKeyframe: (animId: string, timelineType: string, targetId: string, time: number, value: Record<string, number | string | null>) => void;
  removeKeyframe: (animId: string, timelineType: string, targetId: string, time: number) => void;
  addImage: (name: string, dataUrl: string) => void;
  removeImage: (name: string) => void;

  exportJSON: () => Record<string, unknown>;
  importJSON: (json: Record<string, unknown>) => void;
  reset: () => void;
}

let nextId = 1;
function genId(): string {
  return `id_${nextId++}`;
}

const initialState = {
  bones: [] as BoneNode[],
  slots: [] as SlotNode[],
  skins: [] as SkinNode[],
  animations: [] as AnimNode[],
  images: new Map<string, string>(),
  width: 256,
  height: 384,
};

export const useDocumentStore = create<DocumentState>()((set, get) => ({
  ...initialState,

  addBone(parentId, name, x, y) {
    const id = genId();
    const bone: BoneNode = {
      id,
      name,
      parentId,
      x,
      y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      length: 0,
    };
    set((s) => ({ bones: [...s.bones, bone] }));
    return id;
  },

  removeBone(id) {
    set((s) => {
      // Also remove children recursively
      const toRemove = new Set<string>();
      const collect = (boneId: string) => {
        toRemove.add(boneId);
        for (const b of s.bones) {
          if (b.parentId === boneId) collect(b.id);
        }
      };
      collect(id);

      return {
        bones: s.bones.filter((b) => !toRemove.has(b.id)),
        slots: s.slots.filter((sl) => !toRemove.has(sl.boneId)),
      };
    });
  },

  updateBone(id, updates) {
    set((s) => ({
      bones: s.bones.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    }));
  },

  addSlot(boneId, name) {
    const id = genId();
    const slot: SlotNode = {
      id,
      name,
      boneId,
      attachmentName: null,
      color: 'ffffffff',
    };
    set((s) => ({ slots: [...s.slots, slot] }));
    return id;
  },

  removeSlot(id) {
    set((s) => ({ slots: s.slots.filter((sl) => sl.id !== id) }));
  },

  updateSlot(id, updates) {
    set((s) => ({
      slots: s.slots.map((sl) => (sl.id === id ? { ...sl, ...updates } : sl)),
    }));
  },

  addSkin(name) {
    const id = genId();
    const skin: SkinNode = { id, name, attachments: new Map() };
    set((s) => ({ skins: [...s.skins, skin] }));
    return id;
  },

  removeSkin(id) {
    set((s) => ({ skins: s.skins.filter((sk) => sk.id !== id) }));
  },

  addAnimation(name, duration) {
    const id = genId();
    const anim: AnimNode = { id, name, duration, timelines: [] };
    set((s) => ({ animations: [...s.animations, anim] }));
    return id;
  },

  removeAnimation(id) {
    set((s) => ({ animations: s.animations.filter((a) => a.id !== id) }));
  },

  updateAnimation(id, updates) {
    set((s) => ({
      animations: s.animations.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }));
  },

  addKeyframe(animId, timelineType, targetId, time, value) {
    set((s) => ({
      animations: s.animations.map((anim) => {
        if (anim.id !== animId) return anim;

        const timelines = [...anim.timelines];
        let tl = timelines.find(
          (t) => t.type === timelineType && t.targetId === targetId,
        );

        if (!tl) {
          tl = { type: timelineType, targetId, keyframes: [] };
          timelines.push(tl);
        } else {
          // Clone for immutability
          const idx = timelines.indexOf(tl);
          tl = { ...tl, keyframes: [...tl.keyframes] };
          timelines[idx] = tl;
        }

        // Replace existing keyframe at same time, or insert
        const existingIdx = tl.keyframes.findIndex((k) => Math.abs(k.time - time) < 0.001);
        if (existingIdx >= 0) {
          tl.keyframes[existingIdx] = { time, value };
        } else {
          tl.keyframes.push({ time, value });
          tl.keyframes.sort((a, b) => a.time - b.time);
        }

        // Recompute duration
        let duration = anim.duration;
        for (const t of timelines) {
          for (const kf of t.keyframes) {
            if (kf.time > duration) duration = kf.time;
          }
        }

        return { ...anim, timelines, duration };
      }),
    }));
  },

  addImage(name, dataUrl) {
    set((s) => {
      const images = new Map(s.images);
      images.set(name, dataUrl);
      return { images };
    });
  },

  removeImage(name) {
    set((s) => {
      const images = new Map(s.images);
      images.delete(name);
      return { images };
    });
  },

  removeKeyframe(animId, timelineType, targetId, time) {
    set((s) => ({
      animations: s.animations.map((anim) => {
        if (anim.id !== animId) return anim;

        const timelines = anim.timelines
          .map((tl) => {
            if (tl.type !== timelineType || tl.targetId !== targetId) return tl;
            return {
              ...tl,
              keyframes: tl.keyframes.filter(
                (k) => Math.abs(k.time - time) >= 0.001,
              ),
            };
          })
          .filter((tl) => tl.keyframes.length > 0);

        return { ...anim, timelines };
      }),
    }));
  },

  exportJSON() {
    const { bones, slots, skins, animations, images, width, height } = get();
    return exportToJSON(bones, slots, skins, animations, images, width, height);
  },

  importJSON(json) {
    const result = importFromJSON(json);
    set(result);
  },

  reset() {
    nextId = 1;
    set({ ...initialState, images: new Map<string, string>() });
  },
}));

// ─── Export / Import helpers ─────────────────────────────────────────────────

function exportToJSON(
  bones: BoneNode[],
  slots: SlotNode[],
  skins: SkinNode[],
  animations: AnimNode[],
  images: Map<string, string>,
  width: number,
  height: number,
): Record<string, unknown> {
  // Build bone name lookup for parent references
  const boneById = new Map<string, BoneNode>();
  for (const b of bones) boneById.set(b.id, b);

  const jsonBones = bones.map((b) => {
    const entry: Record<string, unknown> = { name: b.name };
    const parent = b.parentId ? boneById.get(b.parentId) : null;
    if (parent) entry.parent = parent.name;
    if (b.length) entry.length = b.length;
    if (b.x) entry.x = b.x;
    if (b.y) entry.y = b.y;
    if (b.rotation) entry.rotation = b.rotation;
    if (b.scaleX !== 1) entry.scaleX = b.scaleX;
    if (b.scaleY !== 1) entry.scaleY = b.scaleY;
    return entry;
  });

  const slotById = new Map<string, SlotNode>();
  for (const sl of slots) slotById.set(sl.id, sl);

  const jsonSlots = slots.map((sl) => {
    const bone = boneById.get(sl.boneId);
    const entry: Record<string, unknown> = {
      name: sl.name,
      bone: bone ? bone.name : 'root',
    };
    if (sl.attachmentName) entry.attachment = sl.attachmentName;
    if (sl.color && sl.color !== 'ffffffff') entry.color = sl.color;
    return entry;
  });

  const jsonSkins = skins.map((sk) => {
    const attachments: Record<string, Record<string, unknown>> = {};
    for (const [compositeKey, att] of sk.attachments) {
      // Key format: "slotId:attachmentName"
      const sepIdx = compositeKey.indexOf(':');
      const slotId = sepIdx >= 0 ? compositeKey.substring(0, sepIdx) : compositeKey;
      const slot = slotById.get(slotId);
      const slotName = slot ? slot.name : slotId;
      if (!attachments[slotName]) attachments[slotName] = {};
      attachments[slotName][att.name] = {
        x: att.x,
        y: att.y,
        width: att.width,
        height: att.height,
        ...(att.regionName !== att.name ? { name: att.regionName } : {}),
      };
    }
    return { name: sk.name, attachments };
  });

  const jsonAnimations: Record<string, unknown> = {};
  for (const anim of animations) {
    const animObj: Record<string, Record<string, Record<string, unknown[]>>> = {};

    for (const tl of anim.timelines) {
      // Determine if this is a bone or slot timeline
      const bone = boneById.get(tl.targetId);
      const slot = slotById.get(tl.targetId);

      if (bone && (tl.type === 'rotate' || tl.type === 'translate' || tl.type === 'scale')) {
        if (!animObj.bones) animObj.bones = {};
        if (!animObj.bones[bone.name]) animObj.bones[bone.name] = {};

        if (tl.type === 'rotate') {
          animObj.bones[bone.name].rotate = tl.keyframes.map((kf) => ({
            time: kf.time,
            angle: kf.value.angle ?? 0,
          }));
        } else if (tl.type === 'translate') {
          animObj.bones[bone.name].translate = tl.keyframes.map((kf) => ({
            time: kf.time,
            x: kf.value.x ?? 0,
            y: kf.value.y ?? 0,
          }));
        } else if (tl.type === 'scale') {
          animObj.bones[bone.name].scale = tl.keyframes.map((kf) => ({
            time: kf.time,
            x: kf.value.x ?? 1,
            y: kf.value.y ?? 1,
          }));
        }
      } else if (slot && (tl.type === 'color' || tl.type === 'attachment')) {
        if (!animObj.slots) animObj.slots = {};
        if (!animObj.slots[slot.name]) animObj.slots[slot.name] = {};

        if (tl.type === 'color') {
          animObj.slots[slot.name].color = tl.keyframes.map((kf) => ({
            time: kf.time,
            color: kf.value.color ?? 'ffffffff',
          }));
        } else if (tl.type === 'attachment') {
          animObj.slots[slot.name].attachment = tl.keyframes.map((kf) => ({
            time: kf.time,
            name: kf.value.name ?? null,
          }));
        }
      }
    }

    jsonAnimations[anim.name] = animObj;
  }

  // Build images metadata for export (base64 data URLs stored separately)
  const jsonImages: Record<string, string> = {};
  for (const [name, dataUrl] of images) {
    jsonImages[name] = dataUrl;
  }

  return {
    skeleton: { icebones: '1.0.0', width, height },
    bones: jsonBones,
    slots: jsonSlots,
    skins: jsonSkins,
    animations: jsonAnimations,
    ...(images.size > 0 ? { images: jsonImages } : {}),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function importFromJSON(json: Record<string, any>): {
  bones: BoneNode[];
  slots: SlotNode[];
  skins: SkinNode[];
  animations: AnimNode[];
  images: Map<string, string>;
  width: number;
  height: number;
} {
  nextId = 1;
  const bones: BoneNode[] = [];
  const slots: SlotNode[] = [];
  const skins: SkinNode[] = [];
  const animations: AnimNode[] = [];
  const images = new Map<string, string>();

  // Read dimensions from skeleton metadata
  const skeletonMeta = json.skeleton ?? {};
  const width: number = skeletonMeta.width ?? 256;
  const height: number = skeletonMeta.height ?? 384;

  const boneNameToId = new Map<string, string>();

  // Import bones
  if (json.bones) {
    for (const bJson of json.bones) {
      const id = genId();
      const parentId = bJson.parent ? (boneNameToId.get(bJson.parent) ?? null) : null;
      boneNameToId.set(bJson.name, id);
      bones.push({
        id,
        name: bJson.name,
        parentId,
        x: bJson.x ?? 0,
        y: bJson.y ?? 0,
        rotation: bJson.rotation ?? 0,
        scaleX: bJson.scaleX ?? 1,
        scaleY: bJson.scaleY ?? 1,
        length: bJson.length ?? 0,
      });
    }
  }

  // Import slots
  const slotNameToId = new Map<string, string>();
  if (json.slots) {
    for (const sJson of json.slots) {
      const id = genId();
      const boneId = boneNameToId.get(sJson.bone) ?? '';
      slotNameToId.set(sJson.name, id);
      slots.push({
        id,
        name: sJson.name,
        boneId,
        attachmentName: sJson.attachment ?? null,
        color: sJson.color ?? 'ffffffff',
      });
    }
  }

  // Import skins
  if (json.skins) {
    for (const skJson of json.skins) {
      const id = genId();
      const attachments = new Map<string, SkinAttachment>();
      if (skJson.attachments) {
        for (const slotName of Object.keys(skJson.attachments)) {
          const slotId = slotNameToId.get(slotName) ?? slotName;
          const slotAtts = skJson.attachments[slotName];
          for (const attName of Object.keys(slotAtts)) {
            const attJson = slotAtts[attName];
            attachments.set(`${slotId}:${attName}`, {
              name: attName,
              regionName: attJson.name ?? attName,
              x: attJson.x ?? 0,
              y: attJson.y ?? 0,
              width: attJson.width ?? 0,
              height: attJson.height ?? 0,
            });
          }
        }
      }
      skins.push({ id, name: skJson.name, attachments });
    }
  }

  // Import animations
  if (json.animations) {
    for (const animName of Object.keys(json.animations)) {
      const animJson = json.animations[animName];
      const id = genId();
      const timelines: TimelineNode[] = [];
      let duration = 0;

      // Bone timelines
      if (animJson.bones) {
        for (const boneName of Object.keys(animJson.bones)) {
          const boneId = boneNameToId.get(boneName) ?? boneName;
          const boneTimelines = animJson.bones[boneName];

          if (boneTimelines.rotate) {
            const keyframes: KeyframeNode[] = boneTimelines.rotate.map((f: any) => ({
              time: f.time,
              value: { angle: f.angle ?? 0 },
            }));
            timelines.push({ type: 'rotate', targetId: boneId, keyframes });
            for (const kf of keyframes) if (kf.time > duration) duration = kf.time;
          }

          if (boneTimelines.translate) {
            const keyframes: KeyframeNode[] = boneTimelines.translate.map((f: any) => ({
              time: f.time,
              value: { x: f.x ?? 0, y: f.y ?? 0 },
            }));
            timelines.push({ type: 'translate', targetId: boneId, keyframes });
            for (const kf of keyframes) if (kf.time > duration) duration = kf.time;
          }

          if (boneTimelines.scale) {
            const keyframes: KeyframeNode[] = boneTimelines.scale.map((f: any) => ({
              time: f.time,
              value: { x: f.x ?? 1, y: f.y ?? 1 },
            }));
            timelines.push({ type: 'scale', targetId: boneId, keyframes });
            for (const kf of keyframes) if (kf.time > duration) duration = kf.time;
          }
        }
      }

      // Slot timelines
      if (animJson.slots) {
        for (const slotName of Object.keys(animJson.slots)) {
          const slotId = slotNameToId.get(slotName) ?? slotName;
          const slotTimelines = animJson.slots[slotName];

          if (slotTimelines.color) {
            const keyframes: KeyframeNode[] = slotTimelines.color.map((f: any) => ({
              time: f.time,
              value: { color: f.color ?? 'ffffffff' },
            }));
            timelines.push({ type: 'color', targetId: slotId, keyframes });
            for (const kf of keyframes) if (kf.time > duration) duration = kf.time;
          }

          if (slotTimelines.attachment) {
            const keyframes: KeyframeNode[] = slotTimelines.attachment.map((f: any) => ({
              time: f.time,
              value: { name: f.name ?? null },
            }));
            timelines.push({ type: 'attachment', targetId: slotId, keyframes });
            for (const kf of keyframes) if (kf.time > duration) duration = kf.time;
          }
        }
      }

      animations.push({ id, name: animName, duration, timelines });
    }
  }

  // Import images
  if (json.images) {
    for (const [name, dataUrl] of Object.entries(json.images)) {
      if (typeof dataUrl === 'string') {
        images.set(name, dataUrl);
      }
    }
  }

  // Fix: compute nextId from the max numeric suffix across all generated IDs
  // to prevent collisions when creating new nodes after import
  let maxNum = 0;
  const allIds = [
    ...bones.map((b) => b.id),
    ...slots.map((s) => s.id),
    ...skins.map((s) => s.id),
    ...animations.map((a) => a.id),
  ];
  for (const id of allIds) {
    const match = id.match(/_(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  nextId = maxNum + 1;

  return { bones, slots, skins, animations, images, width, height };
}
