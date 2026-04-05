import { useRef, useEffect, useCallback } from 'react';
import { Application, Graphics, Container } from 'pixi.js';
import { useDocumentStore, type BoneNode } from '../store/documentStore';
import { useEditorStore } from '../store/editorStore';
import { useCommandStore } from '../store/commandStore';

/**
 * The main PixiJS canvas viewport.
 * Renders the skeleton bones and handles user interaction for bone creation and selection.
 */
export function Viewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const stageContainerRef = useRef<Container | null>(null);
  const gridGraphicsRef = useRef<Graphics | null>(null);
  const bonesGraphicsRef = useRef<Graphics | null>(null);
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const spaceHeldRef = useRef(false);
  const animFrameRef = useRef(0);

  const renderLoop = useCallback(() => {
    drawBones();
    animFrameRef.current = requestAnimationFrame(renderLoop);
  }, []);

  // Initialize PixiJS
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let destroyed = false;
    const app = new Application();

    app.init({
      background: 0x1a1a2e,
      resizeTo: el,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    }).then(() => {
      if (destroyed) {
        app.destroy(true);
        return;
      }

      el.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;

      // Create world container for panning/zooming
      const worldContainer = new Container();
      app.stage.addChild(worldContainer);
      stageContainerRef.current = worldContainer;

      // Grid graphics
      const gridGfx = new Graphics();
      worldContainer.addChild(gridGfx);
      gridGraphicsRef.current = gridGfx;

      // Bones graphics
      const bonesGfx = new Graphics();
      worldContainer.addChild(bonesGfx);
      bonesGraphicsRef.current = bonesGfx;

      // Initial draw
      drawGrid();
      drawBones();

      // Center the viewport
      const { viewportPanX, viewportPanY } = useEditorStore.getState();
      if (viewportPanX === 0 && viewportPanY === 0) {
        // Default to center of canvas
        const cx = app.screen.width / 2;
        const cy = app.screen.height / 2;
        useEditorStore.getState().setPan(cx, cy);
        worldContainer.position.set(cx, cy);
      }

      // Start render loop
      animFrameRef.current = requestAnimationFrame(renderLoop);
    });

    return () => {
      destroyed = true;
      cancelAnimationFrame(animFrameRef.current);
      if (appRef.current) {
        const canvas = appRef.current.canvas as HTMLCanvasElement;
        appRef.current.destroy(true);
        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
        appRef.current = null;
      }
    };
  }, [renderLoop]);

  // Sync panning/zooming from store
  useEffect(() => {
    const unsub = useEditorStore.subscribe((state) => {
      const wc = stageContainerRef.current;
      if (!wc) return;
      wc.position.set(state.viewportPanX, state.viewportPanY);
      wc.scale.set(state.viewportZoom);
      drawGrid();
    });
    return unsub;
  }, []);

  // Subscribe to document changes to redraw
  useEffect(() => {
    const unsub = useDocumentStore.subscribe(() => {
      drawBones();
    });
    return unsub;
  }, []);

  // Subscribe to editor selection changes to redraw
  useEffect(() => {
    const unsub = useEditorStore.subscribe(() => {
      drawBones();
    });
    return unsub;
  }, []);

  function drawGrid() {
    const gfx = gridGraphicsRef.current;
    if (!gfx) return;
    gfx.clear();

    const app = appRef.current;
    const wc = stageContainerRef.current;
    if (!app || !wc) return;

    const zoom = wc.scale.x;
    const panX = wc.position.x;
    const panY = wc.position.y;
    const w = app.screen.width;
    const h = app.screen.height;

    // World-space bounds visible on screen
    const left = -panX / zoom;
    const top = -panY / zoom;
    const right = (w - panX) / zoom;
    const bottom = (h - panY) / zoom;

    const smallStep = 50;
    const bigStep = 200;

    // Small grid lines
    const startX = Math.floor(left / smallStep) * smallStep;
    const startY = Math.floor(top / smallStep) * smallStep;

    for (let x = startX; x <= right; x += smallStep) {
      const isBig = Math.abs(x % bigStep) < 0.5;
      gfx.moveTo(x, top);
      gfx.lineTo(x, bottom);
      gfx.stroke({
        width: 1 / zoom,
        color: isBig ? 0x2a2a4e : 0x222244,
        alpha: isBig ? 0.6 : 0.3,
      });
    }

    for (let y = startY; y <= bottom; y += smallStep) {
      const isBig = Math.abs(y % bigStep) < 0.5;
      gfx.moveTo(left, y);
      gfx.lineTo(right, y);
      gfx.stroke({
        width: 1 / zoom,
        color: isBig ? 0x2a2a4e : 0x222244,
        alpha: isBig ? 0.6 : 0.3,
      });
    }

    // Origin crosshair
    gfx.moveTo(left, 0);
    gfx.lineTo(right, 0);
    gfx.stroke({ width: 1 / zoom, color: 0x444466, alpha: 0.8 });
    gfx.moveTo(0, top);
    gfx.lineTo(0, bottom);
    gfx.stroke({ width: 1 / zoom, color: 0x444466, alpha: 0.8 });
  }

  function drawBones() {
    const gfx = bonesGraphicsRef.current;
    if (!gfx) return;
    gfx.clear();

    const { bones } = useDocumentStore.getState();
    const { selectedBoneId } = useEditorStore.getState();
    const zoom = stageContainerRef.current?.scale.x ?? 1;

    if (bones.length === 0) return;

    // Build a world-position map by traversing the hierarchy
    const worldPositions = computeWorldPositions(bones);

    // Draw bone connections (lines from parent to child)
    for (const bone of bones) {
      const pos = worldPositions.get(bone.id);
      if (!pos) continue;

      if (bone.parentId) {
        const parentPos = worldPositions.get(bone.parentId);
        if (parentPos) {
          const isSelected = bone.id === selectedBoneId || bone.parentId === selectedBoneId;
          gfx.moveTo(parentPos.x, parentPos.y);
          gfx.lineTo(pos.x, pos.y);
          gfx.stroke({
            width: (isSelected ? 2 : 1.5) / zoom,
            color: isSelected ? 0xffdd44 : 0x00dd66,
            alpha: isSelected ? 1 : 0.8,
          });
        }
      }
    }

    // Draw bone diamonds
    for (const bone of bones) {
      const pos = worldPositions.get(bone.id);
      if (!pos) continue;

      const isSelected = bone.id === selectedBoneId;
      const size = (isSelected ? 6 : 4) / zoom;

      // Diamond shape
      gfx.moveTo(pos.x, pos.y - size);
      gfx.lineTo(pos.x + size, pos.y);
      gfx.lineTo(pos.x, pos.y + size);
      gfx.lineTo(pos.x - size, pos.y);
      gfx.closePath();
      gfx.fill({ color: isSelected ? 0xffdd44 : 0x00dd66, alpha: 1 });

      if (isSelected) {
        gfx.moveTo(pos.x, pos.y - size - 2 / zoom);
        gfx.lineTo(pos.x + size + 2 / zoom, pos.y);
        gfx.lineTo(pos.x, pos.y + size + 2 / zoom);
        gfx.lineTo(pos.x - size - 2 / zoom, pos.y);
        gfx.closePath();
        gfx.stroke({ width: 1 / zoom, color: 0xffffff, alpha: 0.7 });
      }
    }
  }

  function computeWorldPositions(bones: BoneNode[]): Map<string, { x: number; y: number }> {
    const result = new Map<string, { x: number; y: number }>();

    // Compute world transforms iteratively
    // We need to process parents before children
    const boneMap = new Map<string, BoneNode>();
    for (const b of bones) boneMap.set(b.id, b);

    // Build processing order: roots first, then children
    const processed = new Set<string>();
    const queue: BoneNode[] = [];

    // Find roots
    for (const b of bones) {
      if (!b.parentId || !boneMap.has(b.parentId)) {
        queue.push(b);
      }
    }

    while (queue.length > 0) {
      const bone = queue.shift()!;
      if (processed.has(bone.id)) continue;
      processed.add(bone.id);

      if (bone.parentId && result.has(bone.parentId)) {
        const parentPos = result.get(bone.parentId)!;
        const parentRad = getWorldRotation(bone.parentId, boneMap, new Map());
        const parentCos = Math.cos(parentRad);
        const parentSin = Math.sin(parentRad);
        const parentSX = getWorldScaleX(bone.parentId, boneMap);
        const parentSY = getWorldScaleY(bone.parentId, boneMap);

        const wx = parentPos.x + (parentCos * bone.x * parentSX - parentSin * bone.y * parentSY);
        const wy = parentPos.y + (parentSin * bone.x * parentSX + parentCos * bone.y * parentSY);
        result.set(bone.id, { x: wx, y: wy });
      } else {
        result.set(bone.id, { x: bone.x, y: bone.y });
      }

      // Enqueue children
      for (const b of bones) {
        if (b.parentId === bone.id && !processed.has(b.id)) {
          queue.push(b);
        }
      }
    }

    return result;
  }

  function getWorldRotation(boneId: string, boneMap: Map<string, BoneNode>, cache: Map<string, number>): number {
    if (cache.has(boneId)) return cache.get(boneId)!;
    const bone = boneMap.get(boneId);
    if (!bone) return 0;
    const parentRot = bone.parentId ? getWorldRotation(bone.parentId, boneMap, cache) : 0;
    const worldRot = parentRot + (bone.rotation * Math.PI) / 180;
    cache.set(boneId, worldRot);
    return worldRot;
  }

  function getWorldScaleX(boneId: string, boneMap: Map<string, BoneNode>): number {
    const bone = boneMap.get(boneId);
    if (!bone) return 1;
    const parentScale = bone.parentId ? getWorldScaleX(bone.parentId, boneMap) : 1;
    return parentScale * bone.scaleX;
  }

  function getWorldScaleY(boneId: string, boneMap: Map<string, BoneNode>): number {
    const bone = boneMap.get(boneId);
    if (!bone) return 1;
    const parentScale = bone.parentId ? getWorldScaleY(bone.parentId, boneMap) : 1;
    return parentScale * bone.scaleY;
  }

  // Convert screen coordinates to world coordinates
  function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const { viewportPanX, viewportPanY, viewportZoom } = useEditorStore.getState();
    const x = (screenX - rect.left - viewportPanX) / viewportZoom;
    const y = (screenY - rect.top - viewportPanY) / viewportZoom;
    return { x, y };
  }

  // Find the nearest bone to a world position
  function findBoneAt(worldX: number, worldY: number, threshold: number): string | null {
    const { bones } = useDocumentStore.getState();
    const positions = computeWorldPositions(bones);
    let nearest: string | null = null;
    let nearestDist = threshold;

    for (const bone of bones) {
      const pos = positions.get(bone.id);
      if (!pos) continue;
      const dx = pos.x - worldX;
      const dy = pos.y - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = bone.id;
      }
    }

    return nearest;
  }

  function handleMouseDown(e: React.MouseEvent) {
    const { activeTool } = useEditorStore.getState();

    // Middle mouse button always pans
    if (e.button === 1 || (e.button === 0 && (activeTool === 'pan' || spaceHeldRef.current))) {
      isPanningRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;

    const world = screenToWorld(e.clientX, e.clientY);
    const zoom = useEditorStore.getState().viewportZoom;

    if (activeTool === 'select') {
      const boneId = findBoneAt(world.x, world.y, 15 / zoom);
      useEditorStore.getState().selectBone(boneId);
    } else if (activeTool === 'bone') {
      // Create a new bone at the click position
      const { selectedBoneId } = useEditorStore.getState();
      const { bones, addBone } = useDocumentStore.getState();
      const { execute } = useCommandStore.getState();

      // Calculate local position relative to parent
      let localX = world.x;
      let localY = world.y;
      let parentId = selectedBoneId;

      if (parentId) {
        const positions = computeWorldPositions(bones);
        const parentPos = positions.get(parentId);
        if (parentPos) {
          // Simple local offset (doesn't account for parent rotation — fine for MVP)
          const boneMap = new Map<string, BoneNode>();
          for (const b of bones) boneMap.set(b.id, b);
          const parentWorldRot = getWorldRotation(parentId, boneMap, new Map());
          const cos = Math.cos(-parentWorldRot);
          const sin = Math.sin(-parentWorldRot);
          const dx = world.x - parentPos.x;
          const dy = world.y - parentPos.y;
          const parentSX = getWorldScaleX(parentId, boneMap);
          const parentSY = getWorldScaleY(parentId, boneMap);
          localX = (cos * dx - sin * dy) / parentSX;
          localY = (sin * dx + cos * dy) / parentSY;
        }
      }

      const boneCount = bones.length;
      const name = `bone_${boneCount + 1}`;

      // Use command pattern for undo support
      let newBoneId: string | null = null;
      execute({
        description: `Add bone "${name}"`,
        execute() {
          newBoneId = addBone(parentId, name, localX, localY);
          useEditorStore.getState().selectBone(newBoneId);
        },
        undo() {
          if (newBoneId) {
            useDocumentStore.getState().removeBone(newBoneId);
            useEditorStore.getState().selectBone(parentId);
          }
        },
      });
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    const { viewportPanX, viewportPanY, setPan } = useEditorStore.getState();
    setPan(viewportPanX + dx, viewportPanY + dy);
  }

  function handleMouseUp() {
    isPanningRef.current = false;
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const { viewportZoom, setZoom, viewportPanX, viewportPanY, setPan } = useEditorStore.getState();
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.1, Math.min(10, viewportZoom * zoomFactor));

    // Zoom towards mouse position
    const scale = newZoom / viewportZoom;
    const newPanX = mouseX - (mouseX - viewportPanX) * scale;
    const newPanY = mouseY - (mouseY - viewportPanY) * scale;

    setZoom(newZoom);
    setPan(newPanX, newPanY);
  }

  // Keyboard handlers for spacebar panning
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && !e.repeat) {
        spaceHeldRef.current = true;
        e.preventDefault();
      }
      if (e.ctrlKey && e.code === 'KeyZ') {
        e.preventDefault();
        useCommandStore.getState().undo();
      }
      if (e.ctrlKey && e.code === 'KeyY') {
        e.preventDefault();
        useCommandStore.getState().redo();
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const zoom = useEditorStore((s) => s.viewportZoom);

  return (
    <div
      className="viewport"
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="viewport-info">
        Zoom: {(zoom * 100).toFixed(0)}%
      </div>
    </div>
  );
}
