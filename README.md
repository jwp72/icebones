# IceBones

IceBones is a free, web-based 2D skeletal animation editor and runtime. It provides a visual editor for building bone hierarchies, attaching skins, and authoring keyframe animations, plus a lightweight TypeScript runtime that loads exported JSON files and plays them back in any JavaScript environment. The PixiJS renderer package drops animated skeletons straight into a PixiJS 8 stage with a single call.

![Editor Screenshot](docs/screenshot.png)

## Key Features

- **Visual skeleton editor** -- create and manipulate bone hierarchies in a browser-based canvas
- **Keyframe animation** -- author rotate, translate, and scale timelines with linear interpolation and real-time preview
- **Skin system** -- define named skins that map attachments to slots for equipment/costume swapping
- **Spine-compatible JSON** -- exports a Spine 4.2-superset format that existing Spine runtimes can consume
- **Framework-agnostic core** -- `@icebones/core` has zero dependencies and works anywhere TypeScript/JavaScript runs
- **PixiJS 8 renderer** -- `@icebones/pixi` renders skeletons as PixiJS Containers with auto-update, debug drawing, and slot color tinting
- **Undo/redo** -- full command-pattern undo stack in the editor
- **Monorepo** -- clean separation between core runtime, PixiJS renderer, and editor application

## Quick Start -- Editor

```bash
git clone https://github.com/your-org/icebones.git
cd icebones
npm install
cd packages/editor
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`) to launch the editor.

## Quick Start -- Runtime

```bash
npm install @icebones/core @icebones/pixi
```

```typescript
import { SkeletonJson, Skeleton, AnimationState } from '@icebones/core';
import { SkeletonRenderer } from '@icebones/pixi';

// Load skeleton data from exported JSON
const parser = new SkeletonJson();
const skeletonData = parser.readSkeletonData(jsonData);

// Render in PixiJS
const renderer = new SkeletonRenderer(skeletonData);
renderer.animationState.setAnimation(0, 'idle', true);
app.stage.addChild(renderer);
```

## Documentation

| Document | Description |
|---|---|
| [Getting Started](docs/getting-started.md) | Installation, first skeleton walkthrough, basic game integration |
| [Editor Guide](docs/editor-guide.md) | Complete reference for every editor panel, tool, and shortcut |
| [Runtime Guide](docs/runtime-guide.md) | API reference for `@icebones/core` and `@icebones/pixi` |
| [JSON Format](docs/json-format.md) | Data format specification with annotated examples |

## Project Structure

```
packages/
  core/       @icebones/core   -- framework-agnostic runtime (Bone, Skeleton, AnimationState, Skin, SkeletonJson)
  pixi/       @icebones/pixi   -- PixiJS 8 renderer (SkeletonRenderer)
  editor/     @icebones/editor -- React + PixiJS visual editor (Vite dev server)
docs/                          -- documentation
```

## License

MIT

## Contributing

Contributions are welcome. Please open an issue to discuss significant changes before submitting a pull request. Run `npm test` across all workspaces before pushing:

```bash
npm test          # runs tests in every package
npm run lint      # type-checks every package
npm run build     # builds every package
```
