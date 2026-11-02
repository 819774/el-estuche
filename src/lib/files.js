const MAX_SIZE = 50 * 1024 * 1024;
const SHRINK_OVER = 1.5 * 1024 * 1024;
const MAX_SIDE = 1920;

// Las fotos grandes se reducen para no gastar el espacio gratis del grupo.
export async function shrinkImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < SHRINK_OVER) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export const tooBig = (file) => file.size > MAX_SIZE;

export const safeName = (name) => name
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\w.-]+/g, '-').slice(-80);

export function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
