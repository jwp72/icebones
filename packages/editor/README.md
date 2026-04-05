# @icebones/editor

Web-based 2D skeletal animation editor built with React, PixiJS 8, and Zustand. Create bone hierarchies, define skins, author keyframe animations, and export to Spine-compatible JSON -- all in the browser.

## Running Locally

```bash
# From the repository root:
npm install
cd packages/editor
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`).

## Building for Production

```bash
npm run build
```

The production build outputs static files to `dist/`. Serve them with any static file server:

```bash
npm run preview    # Vite preview server
```

## Tech Stack

- **React 19** -- UI components
- **PixiJS 8** -- canvas rendering
- **Zustand 5** -- state management (document store, editor store, command store)
- **Vite 6** -- dev server and build tool
- **TypeScript 5** -- type safety

## Editor Features

- Visual bone creation and hierarchy management
- Select, Bone, and Pan tools
- Properties panel for bone and slot editing
- Skin management with slot-to-attachment mapping
- Timeline with keyframe authoring, scrubbing, and real-time playback
- Undo/redo via command pattern
- Import/export Spine-compatible JSON

## Documentation

See the full [Editor Guide](../../docs/editor-guide.md) for a complete reference of every panel, tool, and keyboard shortcut.
