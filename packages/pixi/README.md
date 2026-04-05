# @icebones/pixi

PixiJS 8 renderer for IceBones skeletal animation. Renders a skeleton as a PixiJS `Container` with automatic sprite management, slot color tinting, draw order, debug overlays, and auto-update via the shared Ticker.

## Installation

```bash
npm install @icebones/core @icebones/pixi pixi.js
```

## Basic Usage

```typescript
import { Application, Texture } from 'pixi.js';
import { SkeletonJson } from '@icebones/core';
import { SkeletonRenderer } from '@icebones/pixi';

async function main() {
  const app = new Application();
  await app.init({ width: 800, height: 600, background: 0x1a1a2e });
  document.body.appendChild(app.canvas as HTMLCanvasElement);

  // Parse skeleton data
  const skeletonData = new SkeletonJson().readSkeletonData(jsonData);

  // Create the renderer
  const renderer = new SkeletonRenderer(skeletonData);

  // Provide textures for region attachments
  renderer.setRegionTextures({
    'head':  Texture.from('head.png'),
    'torso': Texture.from('torso.png'),
    'arm':   Texture.from('arm.png'),
  });

  // Play an animation
  renderer.animationState.setAnimation(0, 'idle', true);

  // Position on stage
  renderer.position.set(400, 500);

  // Add to stage -- auto-updates every frame
  app.stage.addChild(renderer);
}

main();
```

## Features

- **Auto-update** -- hooks into the PixiJS shared Ticker automatically. Set `renderer.autoUpdate = false` for manual control.
- **Debug drawing** -- set `renderer.debug = true` to see bone positions (green), bone connections (green lines), and attachment bounds (yellow rectangles).
- **Slot tinting** -- slot colors are applied as PixiJS sprite tint and alpha.
- **Draw order** -- sprites are reordered each frame to match slot array order.
- **Texture resolution** -- textures are resolved by `regionName` first, then attachment `name`.

## API

| Property / Method | Description |
|---|---|
| `skeleton` | The `Skeleton` instance |
| `animationState` | The `AnimationState` instance |
| `autoUpdate` | Boolean. Auto-advance animation each frame (default `true`). |
| `debug` | Boolean. Draw bone/attachment debug overlay (default `false`). |
| `setRegionTextures(textures)` | Provide a `Map<string, Texture>` or `Record<string, Texture>` mapping region names to PixiJS textures. |
| `update(dt)` | Manually advance by `dt` seconds. Called automatically when `autoUpdate` is true. |
| `destroy(options?)` | Clean up Ticker listener and internal state. |

## Documentation

See the full [Runtime Guide](../../docs/runtime-guide.md) for detailed API reference and integration patterns.
