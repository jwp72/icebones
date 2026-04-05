import { create } from 'zustand';

export interface Command {
  execute(): void;
  undo(): void;
  description: string;
}

interface CommandState {
  undoStack: Command[];
  redoStack: Command[];
  canUndo: boolean;
  canRedo: boolean;
  execute: (command: Command) => void;
  undo: () => void;
  redo: () => void;
}

export const useCommandStore = create<CommandState>()((set, get) => ({
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  execute(command) {
    command.execute();
    set((s) => ({
      undoStack: [...s.undoStack, command],
      redoStack: [],
      canUndo: true,
      canRedo: false,
    }));
  },

  undo() {
    const { undoStack } = get();
    if (undoStack.length === 0) return;
    const command = undoStack[undoStack.length - 1];
    command.undo();
    set((s) => {
      const newUndo = s.undoStack.slice(0, -1);
      return {
        undoStack: newUndo,
        redoStack: [...s.redoStack, command],
        canUndo: newUndo.length > 0,
        canRedo: true,
      };
    });
  },

  redo() {
    const { redoStack } = get();
    if (redoStack.length === 0) return;
    const command = redoStack[redoStack.length - 1];
    command.execute();
    set((s) => {
      const newRedo = s.redoStack.slice(0, -1);
      return {
        undoStack: [...s.undoStack, command],
        redoStack: newRedo,
        canUndo: true,
        canRedo: newRedo.length > 0,
      };
    });
  },
}));
