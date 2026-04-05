import { Toolbar } from './components/Toolbar';
import { HierarchyPanel } from './components/HierarchyPanel';
import { Viewport } from './components/Viewport';
import { PropertiesPanel } from './components/PropertiesPanel';
import { TimelinePanel } from './components/TimelinePanel';
import './styles.css';

/**
 * Main editor application layout.
 * Uses CSS Grid with: toolbar (top), hierarchy (left), viewport (center),
 * properties (right), timeline (bottom).
 */
export function App() {
  return (
    <div className="editor-layout">
      <Toolbar />
      <HierarchyPanel />
      <Viewport />
      <PropertiesPanel />
      <TimelinePanel />
    </div>
  );
}
