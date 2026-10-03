/**
 * Skyline AI Live Teacher — call relay.
 * Browser ↔ this server ↔ Lovable AI Gateway (GPT Live). Audio flows over
 * WebRTC; this relay carries control events, verifies the caller's account,
 * keeps the live screen state, and runs knowledge-grounded backend answers
 * (with screen vision + annotation tools) for each spoken handoff.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { stepCountIs, streamText, tool, type ModelMessage, type ToolSet } from "ai";
import process from "node:process";
import { z } from "zod";

export type LiveConfig = {
  baseURL: string;
  key: string;
  liveModel: string;
  backendModel: string;
  openingInstructions?: string;
};

const liveSettings = {
  baseURL: "https://ai.gateway.lovable.dev",
  liveModel: "openai/gpt-live-1",
  backendModel: "openai/gpt-6-astra",
};

export type LiveSocket = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onMessage(handler: (data: unknown) => void): void;
  onClose(handler: () => void): void;
  onError(handler: () => void): void;
};

export type LiveExecutionContext = { waitUntil(task: Promise<unknown>): void };
export type LiveConnector = (url: string, headers: Record<string, string>, signal: AbortSignal) => Promise<LiveSocket>;

type WorkerSocket = WebSocket & { accept(): void };
declare const WebSocketPair: { new (): { 0: WorkerSocket; 1: WorkerSocket } };
type Transcript = {
  role: "user" | "assistant";
  text: string;
  start_ms: number;
  end_ms: number;
  listeningSound: boolean;
};
type ProviderEvent = {
  type: string;
  client_event_id?: string;
  error?: { client_event_id?: string; message?: string };
  session?: { id: string };
  delta?: string;
  start_ms?: number;
  end_ms?: number;
  offset_ms?: number;
  delegation?: { id: string; target: string };
};

/** What the browser reports about the live screen. */
type ScreenState = {
  source: "app" | "display";
  route: string;
  title: string;
  viewport: string;
  elements: string;
  image?: string | undefined;
  at: number;
};

type Caller = { id: string; name: string; access: string; role: "member" | "trainee" };

import type { Chapter, TrainingRow } from "@/lib/training/curriculum";
type TrainingCtx = { chapter: Chapter; row: TrainingRow };

export function getLiveConfig(): LiveConfig {
  const config: LiveConfig = {
    ...liveSettings,
    key: process.env["LOVABLE_API_KEY"] ?? "",
  };
  if ([config.baseURL, config.key, config.liveModel, config.backendModel].some((value) => !value)) {
    throw new Error("Missing Live relay configuration");
  }
  return config;
}

function gatewayAPIBase(baseURL: string) {
  return `${baseURL.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`;
}

async function gatewayRejection(response: Response) {
  const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.slice(0, 300) : "";
  return new Error(message || `Voice gateway rejected the connection (${response.status})`);
}

export function validateLiveUpgrade(request: Request, options: { allowMissingOrigin?: boolean } = {}): Response | null {
  const origin = request.headers.get("origin");
  if (origin === null ? !options.allowMissingOrigin : origin !== new URL(request.url).origin) {
    return new Response("Voice connection origin rejected", { status: 403 });
  }
  if (request.method !== "GET" || request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket required", { status: 426 });
  }
  return null;
}

function workerSocket(socket: WorkerSocket): LiveSocket {
  return {
    get readyState() {
      return socket.readyState;
    },
    send: (data) => socket.send(data),
    close: (code, reason) => socket.close(code, reason),
    onMessage: (handler) => socket.addEventListener("message", (event) => handler(event.data)),
    onClose: (handler) => socket.addEventListener("close", handler),
    onError: (handler) => socket.addEventListener("error", handler),
  };
}

export function handleLiveRequest(request: Request): Response {
  const waitUntil = (request as Request & Partial<LiveExecutionContext>).waitUntil;
  if (!waitUntil) return new Response("Live runtime unavailable", { status: 503 });
  const config = getLiveConfig();
  const rejected = validateLiveUpgrade(request);
  if (rejected) return rejected;
  const pair = new WebSocketPair();
  pair[1].accept();
  bindLiveConnection(workerSocket(pair[1]), config, { waitUntil }, async (url, headers, signal) => {
    const response = await fetch(url, { headers: { ...headers, Upgrade: "websocket" }, signal });
    const socket = (response as Response & { webSocket?: WorkerSocket | null }).webSocket;
    if (!socket) throw await gatewayRejection(response);
    socket.accept();
    return workerSocket(socket);
  });
  const response: ResponseInit & { webSocket: WebSocket } = { status: 101, webSocket: pair[0] };
  return new Response(null, response);
}

/** Verifies the signed-in Skyline account behind the call. */
async function loadCaller(token: string): Promise<Caller> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Please sign in again to call Skyline AI.");
  const id = data.user.id;
  const [{ data: trainee }, { data: member }] = await Promise.all([
    supabaseAdmin.from("trainees").select("status, full_name").eq("id", id).maybeSingle(),
    supabaseAdmin.from("member_profiles").select("status, full_name, levels:level_id(name)").eq("id", id).maybeSingle(),
  ]);
  if (member?.status === "active") {
    return {
      id,
      name: member.full_name ?? "",
      access: (member.levels as { name?: string } | null)?.name ?? "member",
      role: "member",
    };
  }
  if (trainee?.status === "active") return { id, name: trainee.full_name ?? "", access: "Beginners Training", role: "trainee" };
  throw new Error("Your account is not active.");
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0]?.slice(0, 24) ?? "";
}

function conversationInstructions(caller: Caller) {
  const name = firstName(caller.name);
  return `You are Skyline AI, the live teacher of Skyline Achievers, on a real call with ${name || "a Skyline member"} (account: ${caller.access}).
Speak natural Pakistani Urdu mixed with common English words (Roman Urdu style), warm and respectful like a senior trainer. Match the caller's language.
Keep turns short: one or two sentences, then let them talk. Never give long lectures. Ask what they want to learn first (poori website, dashboard, training ya koi specific feature) and adapt. If they already know something, skip it; if they know nothing, start basic. Notice confusion and explain differently with a simple example. Remember everything said earlier in this call and connect back to it. Use small acknowledgements like "Ji", "Achha", "Haan, ye wala" sparingly. Do not fake emotions.
Screen: you cannot see anything yourself. When the caller asks about their screen, a button, "ye", or wants you to show something, delegate. If no screen is shared, ask them to tap Share Screen.
Truth: never state Skyline fees, prices, income, ranks, policies, unlock rules or product claims yourself — delegate. If verified info is missing say: "Mere paas is point ki verified information nahi hai. Isko Skyline senior/Upline se confirm karna better hai."
Backchannel policy: Use moderate listening sounds without taking over.
Interruption policy: Stop your answer immediately and listen when the caller interrupts. Remember exactly where you stopped; after answering, ask "Ab hum jahan rukay thay wahan se continue karein?" and continue from that point if they agree.
Delegation policy:
Backend tools: Verified Skyline knowledge, the caller's live shared screen, and on-screen pointers (arrow, circle, box, spotlight, pointer, numbers).
Delegate to the backend when: The caller asks anything about Skyline features, rules or the website, anything about what is on their screen, or wants something pointed out. Say a short "Ek second, main dekh raha hoon" first.
Do not delegate to the backend when: Greeting, small talk, clarifying what they want, or repeating a still-current answer. Wait for the backend result before presenting its answer, and speak it naturally in short turns.`;
}

const TEACHER_ROUTES = [
  "/?classroom=1",
  "/dashboard",
  "/training",
  "/courses",
  "/sessions",
  "/team",
  "/seats",
  "/ai",
  "/assistants",
  "/reels",
  "/chat",
  "/resources",
  "/search",
  "/profile",
  "/notifications",
  "/todo",
  "/leave",
] as const;

async function trainingInstructions(caller: Caller, t: TrainingCtx) {
  const { chapterText, PASS_PERCENT } = await import("@/lib/training/curriculum");
  const name = firstName(caller.name);
  const lesson = t.chapter.lessons[t.row.current_lesson];
  return `You are Skyline AI Teacher running MANDATORY TRAINING for ${name || "an FBO"} (account: ${caller.access}) on a live classroom call.
Speak natural Pakistani Urdu mixed with simple English (Roman Urdu style), warm, like a senior trainer. Short turns (1-3 sentences), then pause for them.
YOU LEAD THE CLASS. Do not wait for them to choose a topic. Teach the lessons below in order, each lesson through this cycle:
INTRO (what we will learn) → EXPLAIN (the facts, simply, with a real-life example) → DEMONSTRATE (delegate to show it on their screen and/or whiteboard) → PRACTICE (ask them to do the practice task themselves) → EVALUATE (delegate to check their screen; correct them kindly) → ask the check question; judge meaning not exact words. If wrong, explain differently (example, then analogy) and ask again.
When a lesson is understood, delegate to save progress and move to the next lesson. After the last lesson run the CHAPTER TEST: ask each test question one by one, then the practical task, then delegate to submit the test result. Pass needs ${PASS_PERCENT}% and the practical. If failed: remediate the weak points and retest.
TEACHER SCREEN: The learner does NOT share their screen. YOU share YOUR own Skyline screen: it is already visible to them full-screen in the call, signed in to their own Skyline account. You open every page yourself (delegate to show the page), then point at buttons and sections on it. You can show the public landing page too. Say what you are opening before you open it ("Ab main Dashboard kholta hoon…"), then explain it on screen step by step.
Current position: chapter ${t.chapter.n}, lesson ${t.row.current_lesson}${lesson ? ` (${lesson.title})` : ""}, stage ${t.row.current_stage}.
${chapterText(t.chapter)}
Truth: teach ONLY these facts and verified Skyline knowledge. Never state fees, prices, income, compensation, policies or product claims. If unknown say: "Mere paas is point ki verified information nahi hai. Isko Skyline senior/Upline se confirm karna better hai."
Backchannel policy: Use moderate listening sounds without taking over.
Interruption policy: Stop immediately when interrupted and listen. Answer their question, then ask "Ab hum jahan rukay thay, wahan se continue karein?" and resume from the exact same lesson and stage.
Delegation policy:
Backend tools: opening pages on your shared teacher screen, whiteboard drawing, pointing on that screen, reading that screen, saving training progress, grading the chapter test, offering a page for them to open.
Delegate to the backend when: you DEMONSTRATE or EVALUATE, want the whiteboard, finish a lesson (to save progress), finish the chapter test (to grade it), or they ask a Skyline question outside these facts.
Do not delegate to the backend when: simply explaining the facts above, asking questions, or chatting. Wait for backend results before announcing scores or unlocks.`;
}

function trainingOpening(caller: Caller, t: TrainingCtx) {
  const name = firstName(caller.name);
  const fresh = t.row.current_lesson === 0 && t.row.current_stage === "INTRO" && !t.row.chapters?.[String(t.chapter.n)]?.attempts;
  return fresh
    ? `Start now. Greet ${name || "them"} with Assalam-o-Alaikum, say you are their Skyline AI Teacher and today Chapter ${t.chapter.n} "${t.chapter.title}" starts. Then say "Main apni screen share kar raha hoon" and ask "Kya aap ko meri screen theek nazar aa rahi hai?" Wait for their answer. When they confirm, begin lesson 0 at INTRO. If they cannot see it, ask them to tap "Screen dobara load karein" and ask again.`
    : `Start now. Say "Welcome back ${name}". Say "Main apni screen share kar raha hoon — kya meri screen nazar aa rahi hai?" and wait. After they confirm, remind them in one sentence where you stopped (chapter ${t.chapter.n}, lesson ${t.row.current_lesson}, stage ${t.row.current_stage}) and continue from exactly there.`;
}

function openingFor(caller: Caller) {
  const name = firstName(caller.name);
  return `Start now. Say Assalam-o-Alaikum${name ? ` ${name}` : ""}, introduce yourself in one short sentence as Skyline AI teacher, then ask what they want to understand today: poori website, dashboard, training ya koi specific feature. Then listen.`;
}

async function loadReferences() {
  const { SKYLINE_KNOWLEDGE } = await import("@/lib/skyline-knowledge");
  const { FLP_KNOWLEDGE } = await import("@/lib/flp-knowledge");
  const { GUIDE_STEPS } = await import("@/lib/ai-guide");
  let video = "";
  try {
    const { loadVideoKnowledgeContext } = await import("@/lib/video-knowledge.server");
    video = await loadVideoKnowledgeContext(20);
  } catch {
    video = "";
  }
  const pages = GUIDE_STEPS.map((s) =>
    `- ${s.title}${s.route ? ` [route ${s.route}]` : ""} (${s.audience}): ${s.what} Why: ${s.why} Can do: ${s.canDo.join("; ")}${s.buttons?.length ? ` Buttons: ${s.buttons.join("; ")}` : ""}${s.avoid ? ` Avoid: ${s.avoid}` : ""}`,
  ).join("\n");
  return `VERIFIED WEBSITE PAGES (real current Skyline screens):\n${pages}\n\nSKYLINE REFERENCE:\n${SKYLINE_KNOWLEDGE}\n\nFLP REFERENCE:\n${FLP_KNOWLEDGE}${video}`;
}

const annotationInput = z
  .object({
    clear_previous: z.boolean().describe("true to remove earlier pointers first"),
    marks: z
      .array(
        z
          .object({
            tool: z.enum(["arrow", "circle", "rect", "spotlight", "pointer", "number"]),
            element_id: z.string().nullable().describe("Element id like e12 from the live screen list, or null"),
            box: z
              .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
              .strict()
              .nullable()
              .describe("Only for a shared screen image: area as 0..1 fractions of the image, else null"),
            number: z.number().int().min(1).max(9).nullable(),
            label: z.string().max(40).nullable().describe("Very short label shown next to the mark, or null"),
          })
          .strict(),
      )
      .max(6),
  })
  .strict();

const whiteboardInput = z
  .object({
    title: z.string().max(80),
    items: z.array(z.object({ icon: z.string().max(4).nullable(), text: z.string().max(90) }).strict()).max(8),
    flow: z.array(z.string().max(30)).max(7).describe("Steps drawn as boxes with arrows; empty if not needed"),
    chart: z
      .object({ caption: z.string().max(60), bars: z.array(z.object({ label: z.string().max(20), value: z.number().min(0).max(100) }).strict()).max(6) })
      .strict()
      .nullable(),
  })
  .strict();

export type WhiteboardData = z.infer<typeof whiteboardInput>;

export type AnnotationMark = z.infer<typeof annotationInput>["marks"][number];

function isListeningSound(text: string) {
  const normalized = text.toLowerCase().replace(/[\s\p{Pd}]/gu, "");
  return /^(?:m+hm+|uhhuh|hmm+|jee|ji)[.,!]*$/.test(normalized);
}

function screenMessage(screen: ScreenState | undefined): ModelMessage {
  if (!screen || Date.now() - screen.at > 120_000) {
    return { role: "user", content: "[LIVE SCREEN — system note, not spoken] The caller is not sharing a screen right now." };
  }
  const text = `[LIVE SCREEN — system note, not spoken by the caller]
Source: ${screen.source === "display" ? "real device screen share (image) of the Skyline website" : "Skyline app live view"}
Route: ${screen.route}
Page title: ${screen.title}
Viewport: ${screen.viewport}
Visible elements (id | kind | label | position | colour):
${screen.elements || "(none detected)"}`;
  if (!screen.image) return { role: "user", content: text };
  return {
    role: "user",
    content: [
      { type: "text", text },
      { type: "image", image: screen.image, mediaType: "image/jpeg" },
    ],
  };
}

async function answerQuestion(
  messages: ModelMessage[],
  config: LiveConfig,
  correlation: { runID: string; sessionID: string | undefined; delegationID: string },
  signal: AbortSignal,
  consumeInput: () => void,
  context: { caller: Caller; references: string; screen: () => ScreenState | undefined; systemExtra: string },
  tools: ToolSet,
) {
  signal.throwIfAborted();
  const provider = createOpenAI({
    baseURL: gatewayAPIBase(config.baseURL),
    apiKey: config.key,
    headers: {
      "Lovable-API-Key": config.key,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
  let responseCursor = 0;
  consumeInput();
  const result = streamText({
    model: provider.responses(config.backendModel),
    abortSignal: signal,
    maxRetries: 0,
    stopWhen: stepCountIs(12),
    includeRawChunks: true,
    prepareStep() {
      consumeInput();
      // The live screen is attached fresh on every step and never stored in history.
      return { messages: [...messages, screenMessage(context.screen())] };
    },
    onStepFinish(step) {
      messages.push(...step.response.messages.slice(responseCursor));
      responseCursor = step.response.messages.length;
    },
    headers: {
      "X-Lovable-AIG-Run-ID": correlation.runID,
      "X-Lovable-AIG-Metadata": JSON.stringify({
        live_session_id: correlation.sessionID,
        delegation_id: correlation.delegationID,
      }),
    },
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
    system: `You are the thinking side of Skyline AI, a live voice teacher on a call. The caller (${firstName(context.caller.name) || "member"}, account: ${context.caller.access}) talks by voice; transcripts may be incomplete or corrected — use the latest correction.
Write what the voice teacher should say next: natural spoken Roman Urdu with simple English words, at most 70 words, short sentences, no lists, no markdown. End with one short follow-up question when it helps.
SCREEN: The latest LIVE SCREEN note shows what is visible now. Clearly separate what you can see ("Mujhe screen par ... nazar aa raha hai") from Skyline knowledge. Never claim to see something not in the note. When you talk about a visible element, call annotate_screen with its element id (or a box on a screen image) so it is pointed out; use number marks for several items and spotlight for one important item. If the caller says "ye" or "ye wala", resolve it from the current screen and conversation; if two or more elements fit and it matters, ask which one (e.g. "right side wala ya neeche wala?") instead of guessing. If the screen changed (new route), acknowledge the new page naturally. If no screen is shared and it is needed, ask them to tap Share Screen.
TRUTH: Use only the references and the visible screen. Never invent fees, prices, income, ranks, policies, unlock conditions, product claims or features. If missing say: "Mere paas is point ki verified information nahi hai. Isko Skyline senior/Upline se confirm karna better hai." Never reveal admin areas, codes, passwords or other people's data. Never tell them you will click or submit anything; they act themselves, and payments, submissions and account changes are always their own decision.

${context.systemExtra}

${context.references}`,
    messages,
    tools,
  });
  let completed = false;
  let stepCompleted = false;
  let failed = false;
  for await (const part of result.fullStream) {
    if (part.type === "start-step") stepCompleted = false;
    if (part.type === "raw" && part.rawValue && typeof part.rawValue === "object" && "type" in part.rawValue) {
      if (part.rawValue.type === "response.completed") stepCompleted = true;
      if (part.rawValue.type === "response.failed" || part.rawValue.type === "response.incomplete") failed = true;
    }
    if (part.type === "finish-step" && !stepCompleted) failed = true;
    if (part.type === "error" || part.type === "abort") failed = true;
    if (part.type === "finish") completed = part.finishReason === "stop";
  }
  signal.throwIfAborted();
  if (failed || !completed) throw new Error("The backend response did not complete");
  const answer = await result.text;
  if (!answer.trim()) throw new Error("The backend response had no answer");
  return answer;
}

function* commentaryChunks(content: string) {
  const encoder = new TextEncoder();
  let chunk = "";
  let bytes = 0;
  for (const [word] of content.matchAll(/\S+\s*|\s+/gu)) {
    if (chunk && bytes + encoder.encode(word).length > 480) {
      yield chunk;
      chunk = "";
      bytes = 0;
    }
    for (const character of word) {
      const size = encoder.encode(character).length;
      if (bytes + size > 480) {
        yield chunk;
        chunk = "";
        bytes = 0;
      }
      chunk += character;
      bytes += size;
    }
  }
  if (chunk) yield chunk;
}

const screenSchema = z.object({
  type: z.literal("app.screen"),
  source: z.enum(["app", "display"]),
  route: z.string().max(200),
  title: z.string().max(200),
  viewport: z.string().max(60),
  elements: z.string().max(12_000),
  image: z.string().max(900_000).optional(),
});

export function bindLiveConnection(
  browser: LiveSocket,
  configuration: LiveConfig,
  execution: LiveExecutionContext,
  connect: LiveConnector,
): void {
  const config = { ...configuration };
  const runID = crypto.randomUUID();
  const setupAbort = new AbortController();
  let gateway: LiveSocket | undefined;
  let sessionID: string | undefined;
  let starting = false;
  let closing = false;
  let finished = false;
  let revision = 0;
  let task: AbortController | undefined;
  let caller: Caller | undefined;
  let training: TrainingCtx | undefined;
  let references = "";
  let screen: ScreenState | undefined;
  let lastAnnouncedRoute = "";
  const pendingDelegations: Array<{ event: ProviderEvent }> = [];
  let completedDelegation: (typeof pendingDelegations)[number] | undefined;
  const backendMessages: ModelMessage[] = [];
  let transcriptCursor = 0;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let finishDrain: (() => void) | undefined;
  let browserReady = false;
  let greetingRequested = false;
  let greetingCommand: { id: string; type: "instructions" | "commentary" } | undefined;
  let greetingTimer: ReturnType<typeof setTimeout> | undefined;
  const startTimer = setTimeout(() => {
    emit({ type: "app.error", error: { message: "Voice startup message timed out" } });
    stop();
  }, 8000);
  const transcripts: Transcript[] = [];
  const delegations = new Set<string>();

  function emit(event: object) {
    if (browser.readyState !== 1) return;
    try {
      browser.send(JSON.stringify(event));
    } catch {
      stop();
    }
  }

  function sendGateway(event: object) {
    if (gateway?.readyState !== 1 || closing) return;
    try {
      gateway.send(JSON.stringify(event));
    } catch {
      stop();
    }
  }

  /** Quiet context for the voice model (does not make it speak by itself). */
  function quietContext(content: string) {
    sendGateway({ type: "session.thinking.append", event_id: crypto.randomUUID(), delegation_id: null, content: content.slice(0, 470) });
  }

  function close(socket?: LiveSocket) {
    if (!socket || socket.readyState === 3) return;
    try {
      socket.close(1000, "Call ended");
    } catch {
      return;
    }
  }

  function clearGreeting() {
    clearTimeout(greetingTimer);
    greetingCommand = undefined;
  }

  function requestGreeting() {
    const content = (config.openingInstructions ?? "").trim();
    if (!content || !browserReady || !sessionID || greetingRequested || closing) return;
    greetingRequested = true;
    if (new TextEncoder().encode(content).length > 480) {
      emit({ type: "app.greeting.error", error: { message: "The opening instructions are too long" } });
      return;
    }
    greetingCommand = { id: crypto.randomUUID(), type: "instructions" };
    greetingTimer = setTimeout(() => {
      clearGreeting();
      emit({ type: "app.greeting.error", error: { message: "The opening could not be confirmed" } });
    }, 10_000);
    gateway?.send(
      JSON.stringify({
        type: "session.instructions.append",
        event_id: greetingCommand.id,
        delegation_id: null,
        content,
      }),
    );
  }

  function discardPendingWork() {
    pendingDelegations.length = 0;
    completedDelegation = undefined;
    clearTimeout(restartTimer);
    task?.abort();
  }

  function finish() {
    if (finished) return;
    finished = closing = true;
    clearTimeout(startTimer);
    clearTimeout(startupTimer);
    clearTimeout(closeTimer);
    clearTimeout(restartTimer);
    clearGreeting();
    discardPendingWork();
    setupAbort.abort();
    close(gateway);
    close(browser);
    finishDrain?.();
  }

  function stop() {
    if (closing) return;
    closing = true;
    discardPendingWork();
    clearTimeout(startupTimer);
    clearTimeout(startTimer);
    clearGreeting();
    if (gateway?.readyState === 1) {
      execution.waitUntil(
        new Promise<void>((resolve) => {
          finishDrain = resolve;
        }),
      );
      closeTimer = setTimeout(finish, 15_000);
      try {
        gateway.send(JSON.stringify({ type: "session.close" }));
      } catch {
        finish();
      }
    } else {
      finish();
    }
  }

  function scheduleDelegation() {
    clearTimeout(restartTimer);
    if (closing || task || pendingDelegations.length === 0) return;
    restartTimer = setTimeout(() => void runDelegation(), 300);
  }

  function deliverResult(delegationID: string, answer: string) {
    if (closing) return;
    if (gateway?.readyState !== 1) return stop();
    try {
      for (const content of commentaryChunks(answer)) {
        gateway.send(
          JSON.stringify({
            type: "session.commentary.append",
            event_id: crypto.randomUUID(),
            delegation_id: delegationID,
            content,
          }),
        );
      }
      completedDelegation = pendingDelegations.shift();
      emit({ type: "app.delegation.done", delegation_id: delegationID });
    } catch {
      stop();
    }
  }

  async function runDelegation() {
    const pending = pendingDelegations[0];
    const event = pending?.event;
    const id = event?.delegation?.id;
    if (!pending || !event || !id || closing || task || !caller) return;
    if (!transcripts.some(({ role, text }) => role === "user" && text.trim())) return;
    const controller = new AbortController();
    task = controller;
    let taskRevision = revision;
    try {
      const answer = await answerQuestion(
        backendMessages,
        config,
        { runID, sessionID, delegationID: id },
        controller.signal,
        () => {
          const updates = transcripts.slice(transcriptCursor);
          backendMessages.push(...updates.map(({ role, text }) => ({ role, content: text })));
          transcriptCursor = transcripts.length;
          taskRevision = revision;
        },
        { caller, references, screen: () => screen, systemExtra: trainingSystem() },
        buildTools(id, controller.signal),
      );
      if (closing || controller.signal.aborted) return;
      if (taskRevision !== revision) return;
      deliverResult(id, answer.trim());
    } catch {
      if (closing || controller.signal.aborted) return;
      backendMessages.push({
        role: "assistant",
        content: "The backend attempt failed. Completed tool results remain valid.",
      });
      if (taskRevision !== revision) return;
      deliverResult(id, "Maaf kijiye, is waqt jawab tayyar nahi ho saka. Poochein, kya main dobara koshish karun?");
    } finally {
      if (task === controller) task = undefined;
      scheduleDelegation();
    }
  }

  function trainingSystem() {
    if (!training) return "";
    const { chapter, row } = training;
    return `TRAINING MODE: You are also the training engine for Chapter ${chapter.n} "${chapter.title}". Current lesson ${row.current_lesson}, stage ${row.current_stage}. Lessons and test:
${chapterTextCache}
- When the teacher demonstrates: call annotate_screen on the matching visible elements and/or draw_whiteboard (title + short items, a flow, or a simple bar chart with icons).
- The learner watches YOUR teacher screen. When a lesson needs a page, call show_page to open it yourself, then annotate_screen once the new screen arrives. Use offer_page only when the learner must do a practical task on their own.
- When a lesson or stage is finished: call save_progress with the next lesson index and stage.
- When the chapter test is complete: call submit_test with your honest judgement for every question id (meaning, not words) and whether the practical task was really seen on their screen. Never mark correct without evidence from the conversation. Report the returned score and pass/fail exactly; never invent a result.
Then write what the teacher should say next.`;
  }

  let chapterTextCache = "";

  function buildTools(delegationID: string, signal: AbortSignal): ToolSet {
    const tools: ToolSet = {
      annotate_screen: tool({
        description: "Temporarily point out elements on the caller's live screen (nothing is changed on the website).",
        inputSchema: annotationInput,
        execute: async (args) => {
          signal.throwIfAborted();
          emit({ type: "app.annotate", delegation_id: delegationID, ...args });
          return { shown: args.marks.length };
        },
      }),
      draw_whiteboard: tool({
        description: "Show a teaching whiteboard to the caller: title, ordered items, an optional flow and an optional simple bar chart.",
        inputSchema: whiteboardInput,
        execute: async (args) => {
          signal.throwIfAborted();
          emit({ type: "app.whiteboard", board: args });
          return { shown: true };
        },
      }),
    };
    if (!training || !caller) return tools;
    const t = training;
    const who = caller.id;
    tools["save_progress"] = tool({
      description: "Save where the training is now (lesson index within the current chapter and stage).",
      inputSchema: z.object({ lesson: z.number().int().min(0).max(20), stage: z.enum(["INTRO", "EXPLAIN", "DEMONSTRATE", "PRACTICE", "EVALUATE", "TEST", "REMEDIATE"]) }).strict(),
      execute: async (args) => {
        signal.throwIfAborted();
        const lesson = Math.min(args.lesson, Math.max(0, t.chapter.lessons.length - 1));
        const { savePosition } = await import("@/lib/training.server");
        await savePosition(who, { chapter: t.chapter.n, lesson, stage: args.stage });
        t.row = { ...t.row, current_lesson: lesson, current_stage: args.stage };
        emit({ type: "app.training.updated" });
        return { saved: true, lesson, stage: args.stage, lessonTitle: t.chapter.lessons[lesson]?.title ?? null };
      },
    });
    tools["submit_test"] = tool({
      description: "Grade the chapter test on the server. Score and pass/fail come back from the server.",
      inputSchema: z
        .object({
          answers: z.array(z.object({ id: z.string(), correct: z.boolean(), note: z.string().nullable() }).strict()).max(20),
          practical_passed: z.boolean(),
        })
        .strict(),
      execute: async (args) => {
        signal.throwIfAborted();
        const { recordTest } = await import("@/lib/training.server");
        const result = await recordTest(who, { chapter: t.chapter.n, ...args });
        emit({ type: "app.training.updated", result: { chapter: t.chapter.n, ...result } });
        return result;
      },
    });
    tools["show_page"] = tool({
      description: "Open a Skyline page on the teacher's own shared screen (the learner watches it). Landing page is '/?classroom=1'.",
      inputSchema: z.object({ route: z.enum(TEACHER_ROUTES) }).strict(),
      execute: async (args) => {
        signal.throwIfAborted();
        emit({ type: "app.show", route: args.route });
        await new Promise((r) => setTimeout(r, 2500));
        return { opened: args.route, screen: screen ? { route: screen.route, elements: screen.elements } : null };
      },
    });
    tools["offer_page"] = tool({
      description: "Offer the caller a button to open a Skyline page themselves.",
      inputSchema: z.object({ route: z.enum(["/?classroom=1", "/dashboard", "/training-room"]), label: z.string().max(40) }).strict(),
      execute: async (args) => {
        emit({ type: "app.open", ...args });
        return { offered: true };
      },
    });
    return tools;
  }

  function queueDelegation(event: ProviderEvent) {
    pendingDelegations.push({ event });
    emit({ type: "app.delegation.pending", delegation_id: event.delegation?.id });
    scheduleDelegation();
  }

  function receiveGateway(data: unknown) {
    try {
      if (typeof data !== "string" || data.length > 1024 * 1024) throw new Error("Invalid voice event");
      const event: ProviderEvent = JSON.parse(data);
      if (browser.readyState === 1) browser.send(data);
      if (event.type === "session.closed") return finish();
      if (event.type === "gateway.session.closing" || event.type === "gateway.error" || event.type === "app.error") {
        return stop();
      }
      if (closing) return;
      if (event.type === "gateway.session.created") {
        sessionID = event.session?.id;
        clearTimeout(startupTimer);
        requestGreeting();
      }
      if (
        greetingCommand &&
        event.type === `session.${greetingCommand.type}.appended` &&
        event.client_event_id === greetingCommand.id
      ) {
        if (greetingCommand.type === "instructions") {
          greetingCommand = { id: crypto.randomUUID(), type: "commentary" };
          gateway?.send(
            JSON.stringify({
              type: "session.commentary.append",
              event_id: greetingCommand.id,
              delegation_id: null,
              content: "Begin the conversation now, following the instructions provided.",
            }),
          );
        } else {
          clearGreeting();
          emit({ type: "app.greeting.accepted" });
        }
      } else if (greetingCommand && event.type === "error" && event.error?.client_event_id === greetingCommand.id) {
        clearGreeting();
        emit({ type: "app.greeting.error", error: { message: event.error.message ?? "The opening was rejected" } });
      }
      if (event.type === "session.input_transcript.delta" || event.type === "session.output_transcript.delta") {
        const role = event.type === "session.input_transcript.delta" ? "user" : "assistant";
        if (!event.delta?.trim()) return;
        const listeningSound = role === "user" && Boolean(task) && isListeningSound(event.delta);
        transcripts.push({
          role,
          text: event.delta,
          start_ms: event.start_ms ?? 0,
          end_ms: event.end_ms ?? 0,
          listeningSound,
        });
        if (listeningSound) return;
        if (role === "user") {
          revision++;
          const offset = completedDelegation?.event.offset_ms;
          if (
            pendingDelegations.length === 0 &&
            completedDelegation &&
            typeof offset === "number" &&
            Number.isFinite(offset) &&
            offset >= 0 &&
            typeof event.start_ms === "number" &&
            Number.isFinite(event.start_ms) &&
            event.start_ms >= 0 &&
            event.start_ms <= offset
          ) {
            pendingDelegations.push(completedDelegation);
            completedDelegation = undefined;
          }
          if (pendingDelegations.length) {
            emit({ type: "app.delegation.pending", delegation_id: pendingDelegations[0]?.event.delegation?.id });
          }
        }
        scheduleDelegation();
      } else if (event.type === "session.delegation.created") {
        const id = event.delegation?.id;
        if (id && event.delegation?.target === "client" && !delegations.has(id)) {
          delegations.add(id);
          queueDelegation(event);
        }
      }
    } catch {
      emit({ type: "app.error", error: { message: "Invalid voice event or lost connection" } });
      stop();
    }
  }

  async function startSession(sdp: string, token: string, wantsTraining: boolean) {
    if (closing || browser.readyState !== 1) return;
    clearTimeout(startTimer);
    startupTimer = setTimeout(() => {
      emit({ type: "app.error", error: { message: "Voice startup timed out" } });
      stop();
    }, 40_000);
    caller = await loadCaller(token);
    references = await loadReferences();
    if (wantsTraining && caller.role === "member") {
      const { loadTraining } = await import("@/lib/training.server");
      const { CHAPTERS } = await import("@/lib/training/curriculum");
      const row = await loadTraining(caller.id);
      const chapter =
        CHAPTERS.find((c) => c.n === row.current_chapter && c.ready) ??
        [...CHAPTERS].reverse().find((c) => c.ready && c.n <= row.unlocked_chapter) ??
        CHAPTERS[0]!;
      training = { chapter, row };
      chapterTextCache = (await import("@/lib/training/curriculum")).chapterText(chapter);
      emit({ type: "app.training.updated" });
    }
    if (closing || browser.readyState !== 1) return;
    config.openingInstructions = training ? trainingOpening(caller, training) : openingFor(caller);
    emit({ type: "app.identity", name: firstName(caller.name) });
    const accepted = await connect(
      new URL(`${gatewayAPIBase(config.baseURL)}/live/sessions`).href,
      {
        "Lovable-API-Key": config.key,
        "X-Lovable-AIG-SDK": "fetch",
        "X-Lovable-AIG-Run-ID": runID,
      },
      setupAbort.signal,
    );
    if (closing || browser.readyState !== 1) {
      close(accepted);
      return;
    }
    gateway = accepted;
    gateway.onMessage(receiveGateway);
    gateway.onClose(finish);
    gateway.onError(() => {
      emit({ type: "app.error", error: { message: "Voice gateway connection failed" } });
      stop();
    });
    const voice = (process.env["SKYLINE_AI_LIVE_VOICE"] ?? "").trim() || "marin";
    gateway.send(
      JSON.stringify({
        type: "session.start",
        session: {
          model: config.liveModel,
          instructions: training ? await trainingInstructions(caller, training) : conversationInstructions(caller),
          audio: { output: { voice } },
          delegation: { type: "client" },
        },
        transport: { type: "webrtc", sdp },
      }),
    );
  }

  function handleScreen(raw: unknown) {
    const parsed = screenSchema.safeParse(raw);
    if (!parsed.success) return;
    const next = { ...parsed.data, at: Date.now() };
    const firstShare = !screen;
    screen = next;
    if (firstShare || next.route !== lastAnnouncedRoute) {
      lastAnnouncedRoute = next.route;
      quietContext(
        firstShare
          ? `The caller just started sharing their screen (${next.source === "display" ? "device screen" : "Skyline app view"}). It shows the "${next.title}" page (${next.route}). You may now delegate screen questions.`
          : `The caller's screen changed: now on the "${next.title}" page (${next.route}). Adapt naturally; offer an overview if helpful.`,
      );
    }
  }

  browser.onMessage((data) => {
    try {
      if (typeof data !== "string" || data.length > 1_000_000) throw new Error("Invalid client message");
      const event = JSON.parse(data);
      if (event.type === "session.close") return stop();
      if (closing) return;
      if (!gateway) {
        if (event.type === "app.screen") return handleScreen(event);
        if (
          starting ||
          event.type !== "app.start" ||
          typeof event.sdp !== "string" ||
          !event.sdp.trim() ||
          typeof event.token !== "string" ||
          !event.token
        ) {
          throw new Error("Voice startup message required");
        }
        starting = true;
        execution.waitUntil(
          startSession(event.sdp, event.token, event.training === true).catch((error) => {
            if (!closing)
              emit({
                type: "app.error",
                error: { message: error instanceof Error ? error.message : "Voice startup failed" },
              });
            stop();
          }),
        );
        return;
      }
      if (event.type === "app.ready") {
        browserReady = true;
        requestGreeting();
        return;
      }
      if (event.type === "app.screen") return handleScreen(event);
      if (event.type === "app.screen.stopped") {
        screen = undefined;
        lastAnnouncedRoute = "";
        quietContext("The caller stopped sharing their screen. You can no longer see it.");
        return;
      }
      if (event.type === "app.mute") {
        quietContext(
          event.muted
            ? "The caller muted their microphone. Silence now means muted, not 'no answer'. Do not ask if they are there; wait quietly."
            : "The caller unmuted their microphone and can talk again.",
        );
        return;
      }
      if (event.type === "app.excuse") {
        const name = firstName(caller?.name ?? "");
        sendGateway({
          type: "session.commentary.append",
          event_id: crypto.randomUUID(),
          delegation_id: null,
          content: `The caller pressed "Excuse me". Stop your current explanation now. Say only: "Ji${name ? ` ${name}` : ""}, boliye." Then listen. Remember exactly where you stopped. After answering, ask: "Ab hum jahan rukay thay wahan se continue karein?" If they say yes, say "Bilkul." and continue from that exact point.`,
        });
        return;
      }
      if (event.type !== "gateway.heartbeat") {
        throw new Error("Unsupported client event");
      }
      if (gateway.readyState !== 1) return stop();
      gateway.send(data);
    } catch {
      emit({ type: "app.error", error: { message: "Voice connection could not be started or continued" } });
      stop();
    }
  });
  browser.onClose(stop);
  browser.onError(stop);
}
