/**
 * Skyline AI Live Teacher — call relay.
 * Browser ↔ this server ↔ Lovable AI Gateway (GPT Live). Audio flows over
 * WebRTC; this relay carries control events, verifies the caller's account,
 * keeps the live screen state, and runs knowledge-grounded backend answers
 * (with screen vision + annotation tools) for each spoken handoff.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { stepCountIs, streamText, tool, type ModelMessage } from "ai";
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

type Caller = { name: string; access: string; role: "member" | "trainee" };

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
      name: member.full_name ?? "",
      access: (member.levels as { name?: string } | null)?.name ?? "member",
      role: "member",
    };
  }
  if (trainee?.status === "active") return { name: trainee.full_name ?? "", access: "Beginners Training", role: "trainee" };
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
  context: { caller: Caller; references: string; screen: () => ScreenState | undefined },
  onAnnotate: (args: z.infer<typeof annotationInput>) => void,
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

${context.references}`,
    messages,
    tools: {
      annotate_screen: tool({
        description: "Temporarily point out elements on the caller's live screen (nothing is changed on the website).",
        inputSchema: annotationInput,
        execute: async (args) => {
          signal.throwIfAborted();
          onAnnotate(args);
          return { shown: args.marks.length };
        },
      }),
    },
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
        { caller, references, screen: () => screen },
        (args) => emit({ type: "app.annotate", delegation_id: id, ...args }),
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

  async function startSession(sdp: string, token: string) {
    if (closing || browser.readyState !== 1) return;
    clearTimeout(startTimer);
    startupTimer = setTimeout(() => {
      emit({ type: "app.error", error: { message: "Voice startup timed out" } });
      stop();
    }, 40_000);
    caller = await loadCaller(token);
    references = await loadReferences();
    if (closing || browser.readyState !== 1) return;
    config.openingInstructions = openingFor(caller);
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
          instructions: conversationInstructions(caller),
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
          startSession(event.sdp, event.token).catch((error) => {
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
