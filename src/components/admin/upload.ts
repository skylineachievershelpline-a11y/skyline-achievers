import { putWithProgress, type ProgressHandler } from "@/lib/upload-progress";

type Bucket = "training-videos" | "training-resources" | "training-thumbnails";

export type CreateUploadUrl = (opts: {
  data: { bucket: Bucket; fileName: string };
}) => Promise<{ path: string; token: string; signedUrl: string }>;

/**
 * Files go straight from the browser into the private bucket using a
 * short-lived signed upload URL minted by the admin server function.
 * `onProgress` reports how much of the file has been sent (0-100).
 * A dropped mobile connection is retried automatically with a fresh URL
 * instead of failing the whole form.
 */
export async function uploadToBucket(
  createUrl: CreateUploadUrl,
  bucket: Bucket,
  file: File,
  onProgress?: ProgressHandler,
): Promise<string> {
  if (bucket === "training-thumbnails" && file.type.startsWith("image/")) {
    file = await compressImageForUpload(file);
  }
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const signed = await createUrl({ data: { bucket, fileName: file.name } });
      await putWithProgress(signed.signedUrl, file, onProgress);
      return signed.path;
    } catch (error) {
      lastError = error;
      onProgress?.(0);
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Upload failed. Please try again.");
}

/**
 * Link-preview services (WhatsApp & friends) only render thumbnails under
 * ~300KB, and a heavy cover also slows every video grid. Every thumbnail is
 * re-encoded as a capped-size JPEG before it leaves the browser.
 */
export async function compressImageForUpload(file: File, maxBytes = 280_000): Promise<File> {
  if (file.size <= maxBytes && file.type === "image/jpeg") return file;
  try {
    const url = URL.createObjectURL(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unsupported image"));
      img.src = url;
    });
    let scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight, 1));
    let quality = 0.85;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) break;
      context.fillStyle = "#0b1220";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
      );
      if (blob && blob.size <= maxBytes) break;
      quality = Math.max(0.4, quality - 0.15);
      if (attempt >= 2) scale *= 0.75;
    }
    URL.revokeObjectURL(url);
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "cover";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Reads a video file's length in the browser so live sessions know when to end. */
export async function videoDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () =>
      done(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    video.onerror = () => done(null);
  });
}
