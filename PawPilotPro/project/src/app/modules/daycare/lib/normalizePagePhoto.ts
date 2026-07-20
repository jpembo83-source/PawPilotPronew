// Pre-upload normalisation for notepad page photos: decode in the browser,
// downscale to a vision-friendly size, and re-encode as JPEG. This does three
// jobs at once — converts formats the vision API can't take (HEIC on some
// devices), keeps uploads well under the 5MB cap, and shortens the server's
// vision call (smaller image = fewer tokens, faster parse).
//
// Best-effort: if the browser can't decode the file (exotic format on an old
// browser), the original is returned and the server reports a clear error.

/** Long-edge target — matches the vision model's maximum useful resolution
 *  (2576px on Opus-tier high-res vision), with margin removed for speed. */
const MAX_DIMENSION = 2400;
const JPEG_QUALITY = 0.85;

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Safari edge cases: fall back to an <img> decode via object URL.
    try {
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return img;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      return null;
    }
  }
}

export async function normalizePagePhoto(file: File): Promise<File> {
  const source = await decode(file);
  if (!source) return file; // undecodable here — let the server answer clearly

  const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (!width || !height) return file;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  // Already a small JPEG — nothing to gain from re-encoding.
  if (scale === 1 && file.type === 'image/jpeg') return file;

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(source, 0, 0, targetW, targetH);
  if ('close' in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) return file;

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'page';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}
