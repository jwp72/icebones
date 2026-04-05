import { useDocumentStore } from '../store/documentStore';

/**
 * Open a file picker to import an image (PNG/JPEG) as a region attachment texture.
 * The image is stored as a base64 data URL in the document store's images map,
 * keyed by the filename without extension.
 */
export function importImage(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg';
  input.multiple = true;
  input.onchange = () => {
    const files = input.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // Use filename without extension as the region name
        const name = file.name.replace(/\.[^.]+$/, '');
        useDocumentStore.getState().addImage(name, dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };
  input.click();
}
