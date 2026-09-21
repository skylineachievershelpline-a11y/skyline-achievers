import type { UIMessage } from "ai";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_DATA_URL_LENGTH = 4_200_000;
const MAX_IMAGES_PER_CONVERSATION = 8;

export function validateAiMessages(
  messages: UIMessage[],
  maxTextLength: number,
): { newest: UIMessage; userText: string; error?: string } {
  const newest = messages.at(-1);
  if (!newest || newest.role !== "user") {
    return { newest: newest ?? { id: "invalid", role: "user", parts: [] }, userText: "", error: "Invalid chat request." };
  }

  let totalImages = 0;
  for (const message of messages) {
    if (message.role !== "user") continue;
    let messageImages = 0;
    for (const part of message.parts) {
      if (part.type !== "file") continue;
      messageImages += 1;
      totalImages += 1;
      if (!IMAGE_TYPES.has(part.mediaType) || !part.url.startsWith(`data:${part.mediaType};base64,`)) {
        return { newest, userText: "", error: "Please attach a JPG, PNG or WebP picture." };
      }
      if (part.url.length > MAX_IMAGE_DATA_URL_LENGTH) {
        return { newest, userText: "", error: "The picture is too large. Please choose one under 3 MB." };
      }
    }
    if (messageImages > 1) {
      return { newest, userText: "", error: "Please send one picture at a time." };
    }
  }
  if (totalImages > MAX_IMAGES_PER_CONVERSATION) {
    return { newest, userText: "", error: "Please start a new chat before sending more pictures." };
  }

  const userText = newest.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
  const hasImage = newest.parts.some((part) => part.type === "file");
  if ((!userText && !hasImage) || userText.length > maxTextLength) {
    return { newest, userText, error: "Please send a shorter message or one picture." };
  }
  return { newest, userText };
}