import { supabase } from "@/integrations/supabase/client";

type Bucket = "training-videos" | "training-resources" | "training-thumbnails";

export type CreateUploadUrl = (opts: {
  data: { bucket: Bucket; fileName: string };
}) => Promise<{ path: string; token: string; signedUrl: string }>;

/**
 * Files go straight from the browser into the private bucket using a
 * short-lived signed upload URL minted by the admin server function.
 */
export async function uploadToBucket(
  createUrl: CreateUploadUrl,
  bucket: Bucket,
  file: File,
): Promise<string> {
  const signed = await createUrl({ data: { bucket, fileName: file.name } });
  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(signed.path, signed.token, file);
  if (error) throw new Error(error.message);
  return signed.path;
}
