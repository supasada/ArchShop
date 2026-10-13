/**
 * Shrink an image in the browser before it is uploaded to Supabase Storage.
 * Phone photos are often 5-10 MB; every storefront/admin view then downloads them
 * in full, which is what burns the Storage egress quota.
 * Returns the original file untouched if it is not a raster image, cannot be
 * decoded, or would not get smaller.
 */
export async function compressImage(file, { maxDimension = 1600, quality = 0.82 } = {}) {
  if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type || '')) return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    // JPEG fallback has no alpha channel; avoid transparent PNGs turning black
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const toBlob = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    let blob = await toBlob('image/webp');
    // Browsers that cannot encode WebP silently hand back a PNG instead
    if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg');
    if (!blob || blob.size >= file.size) return file;

    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.${ext}`, { type: blob.type });
  } catch (err) {
    console.warn('compressImage notice (uploading original):', err);
    return file;
  }
}
