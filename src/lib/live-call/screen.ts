/**
 * Live screen understanding for the Skyline AI call.
 * - "app" share: reads what is really visible in the Skyline app right now
 *   (route, title, visible buttons/sections with position and colour).
 * - "display" share: real browser screen sharing (getDisplayMedia) with
 *   frames sampled from the live stream, plus the same app details.
 * Elements get a temporary data-live-id so annotations can point at them;
 * nothing on the website is changed.
 */
export const LIVE_ID_ATTR = "data-live-id";
export const CALL_UI_ATTR = "data-live-call-ui";

const SELECTOR = [
  "button",
  "a[href]",
  "[role=button]",
  "[role=tab]",
  "[data-ai-guide]",
  "input",
  "textarea",
  "select",
  "h1",
  "h2",
  "h3",
  "[aria-label]",
].join(",");

function region(rect: DOMRect) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const v = cy < h / 3 ? "top" : cy > (h * 2) / 3 ? "bottom" : "middle";
  const hz = cx < w / 3 ? "left" : cx > (w * 2) / 3 ? "right" : "center";
  return `${v}-${hz}`;
}

function colourName(el: Element) {
  const style = getComputedStyle(el);
  const bg = style.backgroundImage !== "none" ? "gradient" : style.backgroundColor;
  if (bg === "gradient") return "blue/cyan gradient";
  const m = bg.match(/rgba?\(([^)]+)\)/);
  if (!m) return "";
  const [r, g, b, a = "1"] = (m[1] ?? "").split(",").map((x) => x.trim());
  const [R, G, B, A] = [Number(r), Number(g), Number(b), Number(a)];
  if (A < 0.2) return "";
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  if (max < 50) return "dark";
  if (min > 210) return "white";
  if (max - min < 25) return "grey";
  if (B >= R && B >= G) return G > 150 ? "cyan" : "blue";
  if (R >= G && R >= B) return G > 150 ? "yellow/orange" : "red";
  return "green";
}

function labelOf(el: HTMLElement) {
  const raw =
    el.getAttribute("aria-label") ||
    (el as HTMLInputElement).placeholder ||
    el.innerText ||
    el.getAttribute("title") ||
    el.getAttribute("data-ai-guide") ||
    "";
  return raw.replace(/\s+/g, " ").trim().slice(0, 60);
}

function kindOf(el: HTMLElement) {
  const tag = el.tagName.toLowerCase();
  if (/^h[1-3]$/.test(tag)) return "heading";
  if (tag === "a") return "link";
  if (tag === "input" || tag === "textarea" || tag === "select") return "field";
  if (tag === "button" || el.getAttribute("role") === "button") return "button";
  if (el.getAttribute("role") === "tab") return "tab";
  return "section";
}

export type AppScreen = { route: string; title: string; viewport: string; elements: string };

/** Reads the currently visible Skyline screen. */
export function collectAppScreen(): AppScreen {
  document.querySelectorAll(`[${LIVE_ID_ATTR}]`).forEach((el) => el.removeAttribute(LIVE_ID_ATTR));
  const lines: string[] = [];
  let n = 0;
  const seen = new Set<string>();
  for (const node of Array.from(document.querySelectorAll<HTMLElement>(SELECTOR))) {
    if (n >= 70) break;
    if (node.closest(`[${CALL_UI_ATTR}]`)) continue;
    const rect = node.getBoundingClientRect();
    if (rect.width < 6 || rect.height < 6) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) continue;
    const style = getComputedStyle(node);
    if (style.visibility === "hidden" || style.opacity === "0") continue;
    const label = labelOf(node);
    const guide = node.getAttribute("data-ai-guide");
    const kind = kindOf(node);
    if (!label && !guide) continue;
    // Big wrappers without their own label add noise.
    if (kind === "section" && !guide && label.length > 50) continue;
    const key = `${kind}|${label}|${Math.round(rect.top / 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    n += 1;
    const id = `e${n}`;
    node.setAttribute(LIVE_ID_ATTR, id);
    const locked = node.getAttribute("data-ai-guide-locked") === "true" ? " (locked for this account)" : "";
    lines.push(
      `${id} | ${kind} | ${label || guide}${guide ? ` [${guide}]` : ""}${locked} | ${region(rect)} | ${colourName(node)}`,
    );
  }
  return {
    route: window.location.pathname,
    title: document.title.slice(0, 120),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    elements: lines.join("\n"),
  };
}

export function findLiveElement(id: string) {
  return document.querySelector<HTMLElement>(`[${LIVE_ID_ATTR}="${CSS.escape(id)}"]`);
}

export function supportsDisplayShare() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return false;
  if (!("getDisplayMedia" in navigator.mediaDevices)) return false;
  // Phones/tablets expose no working screen picker in the browser or installed app.
  return !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export async function startDisplayShare(): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 5 },
    audio: false,
    preferCurrentTab: true,
  } as DisplayMediaStreamOptions);
}

/** One JPEG frame (base64, no prefix) from the live shared stream. */
export function captureFrame(video: HTMLVideoElement, maxWidth = 1024): string | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.6);
  const base64 = url.split(",")[1] ?? "";
  return base64.length > 850_000 ? null : base64;
}
