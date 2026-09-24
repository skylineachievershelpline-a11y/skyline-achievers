import { startUpload } from "@/lib/upload-manager";

type UploadSlot = (opts: { data: { extension: string } }) => Promise<{
  path: string;
  signedUrl: string;
}>;

const ALLOWED = ["png", "jpg", "jpeg", "webp", "webm", "mp3", "m4a", "ogg", "wav"];

/** Shrinks big phone photos to a light JPEG so uploads finish on mobile data. */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob) return file;
    return new File([blob], "review.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function extensionOf(file: File): string {
  const fromName = (file.name.split(".").pop() ?? "").toLowerCase();
  if (ALLOWED.includes(fromName)) return fromName;
  const fromType = (file.type.split("/")[1] ?? "").split(";")[0]!.toLowerCase();
  if (fromType === "mpeg") return "mp3";
  if (fromType === "mp4" || fromType === "x-m4a") return "m4a";
  return fromType;
}

/** Sends a review image or voice note into the private bucket, retrying on weak connections. */
export async function uploadJourneyFile(slot: UploadSlot, original: File): Promise<string> {
  const file = await compressImage(original);
  const extension = extensionOf(file);
  if (!ALLOWED.includes(extension)) throw new Error("This file type is not supported.");
  return startUpload({
    label: file.type.startsWith("image/") ? "Review picture" : "Voice note",
    file,
    createSlot: () => slot({ data: { extension } }),
  });
}
