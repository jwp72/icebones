import { useDocumentStore } from '../store/documentStore';

/**
 * Import a Spine/IceBones JSON file from a file picker dialog.
 * Opens the browser file picker, reads the JSON, and loads it into the document store.
 */
export function importFromFile(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        useDocumentStore.getState().importJSON(json);
      } catch (e) {
        console.error('Failed to parse JSON file:', e);
        alert('Failed to parse JSON file. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
