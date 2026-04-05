import { create } from 'zustand';

export type Tool = 'select' | 'bone' | 'pan';

interface EditorState {
  selectedBoneId: string | null;
  selectedSlotId: string | null;
  selectedSkinId: string | null;
  selectedAnimId: string | null;
  activeTool: Tool;
  viewportZoom: number;
  viewportPanX: number;
  viewportPanY: number;
  isPlaying: boolean;
  playbackTime: number;

  selectBone: (id: string | null) => void;
  selectSlot: (id: string | null) => void;
  selectSkin: (id: string | null) => void;
  selectAnim: (id: string | null) => void;
  setTool: (tool: Tool) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackTime: (time: number) => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  selectedBoneId: null,
  selectedSlotId: null,
  selectedSkinId: null,
  selectedAnimId: null,
  activeTool: 'select',
  viewportZoom: 1,
  viewportPanX: 0,
  viewportPanY: 0,
  isPlaying: false,
  playbackTime: 0,

  selectBone: (id) => set({ selectedBoneId: id, selectedSlotId: null }),
  selectSlot: (id) => set({ selectedSlotId: id, selectedBoneId: null }),
  selectSkin: (id) => set({ selectedSkinId: id }),
  selectAnim: (id) => set({ selectedAnimId: id }),
  setTool: (tool) => set({ activeTool: tool }),
  setZoom: (zoom) => set({ viewportZoom: Math.max(0.1, Math.min(10, zoom)) }),
  setPan: (x, y) => set({ viewportPanX: x, viewportPanY: y }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackTime: (time) => set({ playbackTime: time }),
}));
