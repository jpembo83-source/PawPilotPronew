// Client-side photo preparation for uploads.
//
// Phone cameras produce 3–12MB originals, which made the old flat "under
// 5MB" validation reject most iPhone photos outright. Instead of asking
// users to shrink photos, we do it here: downscale to a sensible gallery
// resolution and re-encode as JPEG before upload. A 2048px JPEG is ample
// for every surface that shows these photos and typically lands well under
// 1MB — faster uploads on mobile data as a bonus.
//
// The hard cap (post-preparation) exists only as a backstop for files the
// browser cannot decode/re-encode (odd formats, corrupt data); server routes
// and the storage bucket enforce the same ceiling.

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB backstop
export const MAX_UPLOAD_LABEL = '15MB';

const TARGET_LONGEST_SIDE = 2048;
const JPEG_QUALITY = 0.82;
// Files already at/below this size AND resolution are passed through untouched.
const SKIP_BELOW_BYTES = 1_500_000;

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
}

/**
 * Downscale + re-encode an image for upload. Always resolves with a usable
 * File: on any decode/encode failure (unsupported format, huge canvas, etc.)
 * the ORIGINAL file is returned and the size backstop applies to it instead.
 * Animated GIFs are passed through so they keep their animation.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  let bitmap: ImageBitmap;
  try {
    // 'from-image' bakes EXIF rotation in, so portrait phone shots stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      return file; // browser can't decode it — let the backstop decide
    }
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, TARGET_LONGEST_SIDE / longest);
    if (scale === 1 && file.size <= SKIP_BELOW_BYTES) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToJpeg(canvas);
    if (!blob || blob.size === 0 || blob.size >= file.size) return file;

    const jpegName = file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg';
    return new File([blob], jpegName, { type: 'image/jpeg' });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
