import { useEditorStore, type Tool } from '../store/editorStore';
import { useDocumentStore } from '../store/documentStore';
import { useCommandStore } from '../store/commandStore';
import { exportToFile } from '../utils/exportJson';
import { importFromFile } from '../utils/importJson';

/**
 * Top toolbar with tools, file operations, and edit operations.
 */
export function Toolbar() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setTool = useEditorStore((s) => s.setTool);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const canUndo = useCommandStore((s) => s.canUndo);
  const canRedo = useCommandStore((s) => s.canRedo);
  const undo = useCommandStore((s) => s.undo);
  const redo = useCommandStore((s) => s.redo);
  const reset = useDocumentStore((s) => s.reset);

  function handleToolClick(tool: Tool) {
    setTool(tool);
  }

  function handleNew() {
    if (confirm('Create a new document? Unsaved changes will be lost.')) {
      reset();
      useEditorStore.getState().selectBone(null);
      useEditorStore.getState().selectSlot(null);
      useEditorStore.getState().selectAnim(null);
      useEditorStore.getState().setPlaybackTime(0);
      useEditorStore.getState().setPlaying(false);
    }
  }

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          className={activeTool === 'select' ? 'active' : ''}
          onClick={() => handleToolClick('select')}
          title="Select tool (click to select bones)"
        >
          &#9654; Select
        </button>
        <button
          className={activeTool === 'bone' ? 'active' : ''}
          onClick={() => handleToolClick('bone')}
          title="Bone tool (click to create bones)"
        >
          &#10010; Bone
        </button>
        <button
          className={activeTool === 'pan' ? 'active' : ''}
          onClick={() => handleToolClick('pan')}
          title="Pan tool (drag to pan viewport)"
        >
          &#9995; Pan
        </button>
      </div>

      <div className="toolbar-group">
        <button onClick={handleNew} title="New document">
          New
        </button>
        <button onClick={importFromFile} title="Import JSON file">
          Import
        </button>
        <button onClick={exportToFile} title="Export as JSON file">
          Export
        </button>
      </div>

      <div className="toolbar-group">
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{ opacity: canUndo ? 1 : 0.4 }}
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          style={{ opacity: canRedo ? 1 : 0.4 }}
        >
          Redo
        </button>
      </div>

      <div className="toolbar-group">
        <button
          onClick={() => setPlaying(!isPlaying)}
          className={isPlaying ? 'active' : ''}
          title={isPlaying ? 'Pause animation' : 'Play animation'}
        >
          {isPlaying ? '\u23F8 Pause' : '\u25B6 Play'}
        </button>
      </div>
    </div>
  );
}
