import { useDocumentStore } from '../store/documentStore';

/**
 * Export the current document state as a Spine/IceBones compatible JSON object.
 * This delegates to the documentStore's exportJSON method.
 */
export function exportToFile(): void {
  const json = useDocumentStore.getState().exportJSON();
  const text = JSON.stringify(json, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'skeleton.json';
  a.click();
  URL.revokeObjectURL(url);
}
