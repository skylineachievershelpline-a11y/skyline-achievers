type UploadSlot = (opts: { data: { extension: string } }) => Promise<{
  path: string;
  signedUrl: string;
}>;

const ALLOWED = ["png", "jpg", "jpeg", "webp", "webm", "mp3", "m4a", "ogg", "wav"];

/** Sends a review image or voice note straight into the private bucket. */
export async function uploadJourneyFile(slot: UploadSlot, file: File): Promise<string> {
  const extension = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED.includes(extension)) throw new Error("This file type is not supported.");
  const signed = await slot({ data: { extension } });
  const response = await fetch(signed.signedUrl, {
    method: "PUT",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) throw new Error("Upload failed. Please try again.");
  return signed.path;
}
