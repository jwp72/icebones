# @icebones/core

Framework-agnostic 2D skeletal animation runtime. Parses Spine-compatible JSON, manages bone hierarchies, slot/skin systems, and multi-track animation playback. Zero runtime dependencies.

## Installation

```bash
npm install @icebones/core
```

## Basic Usage

```typescript
import {
  SkeletonJson,
  Skeleton,
  AnimationState,
} from '@icebones/core';

// Parse skeleton data from a JSON object
const parser = new SkeletonJson();
const skeletonData = parser.readSkeletonData(jsonData);

// Create a mutable instance
const skeleton = new Skeleton(skeletonData);
const animState = new AnimationState(skeletonData);

// Play an animation on track 0
animState.setAnimation(0, 'idle', true);

// Game loop (dt in seconds)
function update(dt: number) {
  animState.update(dt);
  animState.apply(skeleton);
  skeleton.updateWorldTransform();

  // Read bone world positions for rendering:
  for (const bone of skeleton.bones) {
    console.log(bone.name, bone.worldX, bone.worldY);
  }
}
```

## Skin Composition

```typescript
import { Skin } from '@icebones/core';

const combined = new Skin('player');
const base = skeletonData.findSkin('default');
const helmet = skeletonData.findSkin('iron-helmet');

if (base) combined.addSkin(base);
if (helmet) combined.addSkin(helmet);

skeleton.setSkin(combined);
```

## API Highlights

- `SkeletonJson` -- parse Spine 4.2 JSON into `SkeletonData`
- `Skeleton` -- mutable bone/slot instance with skin switching
- `AnimationState` -- multi-track animation playback with queuing
- `Bone` -- local + world transform with 2x3 affine matrix
- `Slot` -- attachment holder with RGBA color tinting
- `Skin` -- composable attachment maps for equipment systems
- `Color` -- RGBA color (0-1 float) with hex string parsing

## Documentation

See the full [Runtime Guide](../../docs/runtime-guide.md) for detailed API reference, code examples, and integration patterns.
