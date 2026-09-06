import { putWithProgress, type ProgressHandler } from "@/lib/upload-progress";

type Bucket = "training-videos" | "training-resources" | "training-thumbnails";

export type CreateUploadUrl = (opts: {
  data: { bucket: Bucket; fileName: string };
}) => Promise<{ path: string; token: string; signedUrl: string }>;

/**
 * Files go straight from the browser into the private bucket using a
 * short-lived signed upload URL minted by the admin server function.
 * `onProgress` reports how much of the file has been sent (0-100).
 */
export async function uploadToBucket(
  createUrl: CreateUploadUrl,
  bucket: Bucket,
  file: File,
  onProgress?: ProgressHandler,
): Promise<string> {
  const signed = await createUrl({ data: { bucket, fileName: file.name } });
  await putWithProgress(signed.signedUrl, file, onProgress);
  return signed.path;
}
