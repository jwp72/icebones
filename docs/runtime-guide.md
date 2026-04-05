# Runtime Guide

API reference for the `@icebones/core` and `@icebones/pixi` packages.

## Overview

| Package | Purpose |
|---|---|
| `@icebones/core` | Framework-agnostic runtime. Parses skeleton JSON, manages bones, slots, skins, and animation playback. Zero dependencies. |
| `@icebones/pixi` | PixiJS 8 renderer. Extends `Container` to draw a skeleton with sprites, slot tinting, debug overlays, and auto-update via the shared Ticker. |

## Installation

```bash
npm install @icebones/core @icebones/pixi pixi.js
```

If you only need the data model (e.g., for a custom renderer or server-side processing), install the core alone:

```bash
npm install @icebones/core
```

---

## Loading a Skeleton

```typescript
import { SkeletonJson } from '@icebones/core';

const parser = new SkeletonJson();
const skeletonData = parser.readSkeletonData(jsonData);
```

`readSkeletonData` accepts a plain JavaScript object (the result of `JSON.parse`). It returns a `SkeletonData` instance containing immutable bone definitions, slot definitions, skin definitions, and animation definitions.

---

## Creating an Instance

`SkeletonData` is a shared definition. To create a mutable instance you can animate and render:

```typescript
import { Skeleton, AnimationState } from '@icebones/core';

const skeleton = new Skeleton(skeletonData);
const animState = new AnimationState(skeletonData);
```

- `Skeleton` owns live `Bone` and `Slot` arrays whose transforms can be modified.
- `AnimationState` manages playback across multiple tracks.

---

## Playing Animations

### setAnimation

Replace the current animation on a track:

```typescript
const entry = animState.setAnimation(0, 'run', true);
// track 0, animation name 'run', loop = true
```

Returns a `TrackEntry` or `null` if the animation name was not found.

### addAnimation

Queue an animation to play after the current one finishes:

```typescript
animState.addAnimation(0, 'idle', true, 0);
// After 'run' ends, play 'idle' with no delay
```

The `delay` parameter (in seconds) inserts a pause before the queued animation starts. If `0`, it starts immediately when the preceding animation ends.

### Update / Apply Loop

Call `update` each frame with the elapsed time in seconds, then `apply` to write the animation state to the skeleton, then `updateWorldTransform` to recompute bone matrices:

```typescript
function gameLoop(dt: number) {
  animState.update(dt);
  animState.apply(skeleton);
  skeleton.updateWorldTransform();
  // ... render the skeleton
}
```

### Clearing Tracks

```typescript
animState.clearTrack(0);   // Clear track 0
animState.clearTracks();    // Clear all tracks
```

---

## Skin Composition (Equipment System)

Skins map `(slotIndex, attachmentName)` pairs to `Attachment` instances. You can compose multiple skins at runtime to build an equipment system:

```typescript
import { Skin } from '@icebones/core';

// Load base skins from the skeleton data
const baseSkin = skeletonData.findSkin('default');
const helmetSkin = skeletonData.findSkin('iron-helmet');
const armorSkin = skeletonData.findSkin('leather-armor');

// Create a composite skin
const combined = new Skin('combined');
if (baseSkin) combined.addSkin(baseSkin);
if (helmetSkin) combined.addSkin(helmetSkin);
if (armorSkin) combined.addSkin(armorSkin);

// Apply to the skeleton
skeleton.setSkin(combined);
```

`addSkin` copies all attachment entries from the source skin into the target, overwriting duplicates. After changing the skin, call `setSlotsToSetupPose()` (which `setSkin` does automatically) to refresh slot attachments.

---

## Color Tinting (Team Colors)

Each slot has a `Color` (RGBA, 0-1 float range). You can tint individual slots at runtime:

```typescript
const jerseySlot = skeleton.findSlot('jersey');
if (jerseySlot) {
  jerseySlot.color.set(1.0, 0.2, 0.2, 1.0); // red tint
}
```

The `Color` class also supports parsing hex strings:

```typescript
jerseySlot.color.setFromString('ff3333ff'); // RRGGBBAA hex
jerseySlot.color.setFromString('#ff3333');  // RRGGBB (alpha defaults to 1)
```

When using the PixiJS renderer, slot colors are automatically applied as sprite tint and alpha.

---

## Rendering with PixiJS

```typescript
import { Application } from 'pixi.js';
import { SkeletonJson } from '@icebones/core';
import { SkeletonRenderer } from '@icebones/pixi';

const app = new Application();
await app.init({ width: 800, height: 600 });
document.body.appendChild(app.canvas as HTMLCanvasElement);

const skeletonData = new SkeletonJson().readSkeletonData(jsonData);
const renderer = new SkeletonRenderer(skeletonData);

renderer.animationState.setAnimation(0, 'idle', true);
app.stage.addChild(renderer);
```

### setRegionTextures

Supply textures for region attachments. Textures are resolved by `regionName` first, then by attachment `name` as a fallback.

```typescript
import { Texture } from 'pixi.js';

renderer.setRegionTextures({
  'head':  Texture.from('head.png'),
  'torso': Texture.from('torso.png'),
  'arm':   Texture.from('arm.png'),
});

// Or with a Map:
const texMap = new Map<string, Texture>();
texMap.set('head', Texture.from('head.png'));
renderer.setRegionTextures(texMap);
```

### autoUpdate

When `true` (the default), the renderer hooks into the PixiJS shared Ticker and calls `update(dt)` every frame automatically. Set to `false` to control timing manually:

```typescript
renderer.autoUpdate = false;

// In your game loop:
renderer.update(dt); // dt in seconds
```

### Debug Mode

Enable debug overlays to visualize bone positions (green circles), bone connections (green lines), and region attachment bounds (yellow rectangles):

```typescript
renderer.debug = true;
```

### Accessing the Skeleton and AnimationState

```typescript
renderer.skeleton;       // Skeleton instance
renderer.animationState; // AnimationState instance
```

### Cleanup

Call `destroy()` to remove the Ticker listener and clean up internal state:

```typescript
renderer.destroy();
```

---

## Core API Reference

### Data Classes (Immutable)

| Class | Description |
|---|---|
| `SkeletonData` | Top-level definition: bones, slots, skins, animations. Provides `findBone(name)`, `findSlot(name)`, `findSkin(name)`, `findAnimation(name)` lookup methods. |
| `BoneData` | Bone definition: `index`, `name`, `parentIndex`, `length`, `x`, `y`, `rotation`, `scaleX`, `scaleY`. (TypeScript interface) |
| `SlotData` | Slot definition: `index`, `name`, `boneIndex`, `attachmentName`, `color`. (TypeScript interface) |

### Instance Classes (Mutable)

| Class | Description |
|---|---|
| `Skeleton` | Mutable skeleton instance. Owns `bones: Bone[]` and `slots: Slot[]`. Methods: `setSkin(skin)`, `setSlotsToSetupPose()`, `updateWorldTransform()`, `findBone(name)`, `findSlot(name)`, `findBoneIndex(name)`, `findSlotIndex(name)`. |
| `Bone` | Single bone with local transform (`x`, `y`, `rotation`, `scaleX`, `scaleY`, `length`) and computed world transform (`a`, `b`, `c`, `d`, `worldX`, `worldY`). Call `updateWorldTransform()` to compute world from local + parent. |
| `Slot` | Holds a reference to its `bone`, the current `attachment`, and a `color: Color`. Has an `attachmentName` for the setup pose. |
| `Color` | RGBA color (0-1 float range). Methods: `set(r, g, b, a)`, `setFromString(hex)`, `clone()`. Accepts `RRGGBBAA` or `RRGGBB` hex. |

### Attachments

| Class | Description |
|---|---|
| `Attachment` | Base class. Has a `name` property. |
| `RegionAttachment` | Rectangular sprite attachment. Properties: `x`, `y`, `rotation`, `scaleX`, `scaleY`, `width`, `height`, `regionName`. Method: `computeWorldVertices(bone, output, offset)` returns 8 floats (4 corners). |

### Skins

| Class | Description |
|---|---|
| `Skin` | Named set of `(slotIndex, attachmentName) -> Attachment` mappings. Methods: `setAttachment(slotIndex, name, attachment)`, `getAttachment(slotIndex, name)`, `addSkin(other)`, `getEntries()`. |

### Animation

| Class | Description |
|---|---|
| `Animation` | Named animation with a `duration` and a list of `Timeline` objects. Method: `apply(skeleton, time)`. |
| `AnimationState` | Multi-track animation player. Methods: `setAnimation(track, name, loop)`, `addAnimation(track, name, loop, delay)`, `update(dt)`, `apply(skeleton)`, `clearTrack(index)`, `clearTracks()`. |
| `TrackEntry` | Linked-list node for a playing/queued animation. Properties: `animation`, `time`, `loop`, `next`. |

### Timeline Types

| Class | Target | Keyframe Values |
|---|---|---|
| `RotateTimeline` | Bone (by index) | `times[]`, `angles[]` (degrees) |
| `TranslateTimeline` | Bone (by index) | `times[]`, `xs[]`, `ys[]` |
| `ScaleTimeline` | Bone (by index) | `times[]`, `scaleXs[]`, `scaleYs[]` |
| `ColorTimeline` | Slot (by index) | `times[]`, `rs[]`, `gs[]`, `bs[]`, `as[]` (0-1 floats) |
| `AttachmentTimeline` | Slot (by index) | `times[]`, `names[]` (attachment name or null) |

All timelines use binary search for keyframe lookup and linear interpolation between frames.

### JSON Parser

| Class | Description |
|---|---|
| `SkeletonJson` | Parses Spine 4.2-compatible JSON into `SkeletonData`. Single method: `readSkeletonData(json)`. |

### PixiJS Renderer

| Class | Description |
|---|---|
| `SkeletonRenderer` | Extends PixiJS `Container`. Constructor takes `SkeletonData`. Exposes `skeleton`, `animationState`, `autoUpdate`, `debug`. Methods: `setRegionTextures(textures)`, `update(dt)`, `destroy()`. |
