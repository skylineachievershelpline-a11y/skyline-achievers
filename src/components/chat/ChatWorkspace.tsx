import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  CheckCheck,
  ImagePlus,
  Loader2,
  Paperclip,
  Send,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { putWithProgress } from "@/lib/upload-progress";
import {
  chatBootstrap,
  chatSend,
  chatSetShowAvatar,
  chatThread,
  chatUploadUrl,
} from "@/lib/chat.functions";

type Thread = {
  peerId: string;
  name: string;
  code: string;
  kind: "trainee" | "member";
  status: string;
  avatarUrl: string | null;
  unread: number;
  lastMessage: { preview: string; mine: boolean; createdAt: string } | null;
};

function timeLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function Ticks({ deliveredAt, readAt }: { deliveredAt: string | null; readAt: string | null }) {
  if (readAt) return <CheckCheck className="h-3.5 w-3.5 text-cyan" aria-label="Seen" />;
  if (deliveredAt) return <CheckCheck className="h-3.5 w-3.5 opacity-70" aria-label="Delivered" />;
  return <Check className="h-3.5 w-3.5 opacity-70" aria-label="Sent" />;
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  return (
    <span className="metal-edge flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-xs font-semibold text-brand-glow">
      {url ? (
        <img src={url} alt={`${name} profile picture`} className="h-full w-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

/** WhatsApp-style conversation between a trainee and their upline. */
export function ChatWorkspace() {
  const queryClient = useQueryClient();
  const bootstrap = useServerFn(chatBootstrap);
  const loadThread = useServerFn(chatThread);
  const send = useServerFn(chatSend);
  const uploadUrl = useServerFn(chatUploadUrl);
  const setShowAvatar = useServerFn(chatSetShowAvatar);

  const [peerId, setPeerId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  const overview = useQuery({
    queryKey: ["chat-overview"],
    queryFn: () => bootstrap(),
    refetchInterval: 8000,
    retry: false,
  });

  const threads = ((overview.data as any)?.threads ?? []) as Thread[];
  const me = (overview.data as any)?.me ?? null;

  useEffect(() => {
    if (!peerId && threads.length > 0) setPeerId(threads[0]!.peerId);
  }, [peerId, threads]);

  const thread = useQuery({
    queryKey: ["chat-thread", peerId],
    queryFn: () => loadThread({ data: { peerId: peerId! } }),
    enabled: Boolean(peerId),
    refetchInterval: 5000,
    retry: false,
  });

  const messages = ((thread.data as any)?.messages ?? []) as {
    id: string;
    mine: boolean;
    body: string | null;
    kind: string;
    mediaUrl: string | null;
    mediaName: string | null;
    deliveredAt: string | null;
    readAt: string | null;
    createdAt: string;
  }[];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // In-app notification for a new message arriving in another conversation.
  useEffect(() => {
    for (const item of threads) {
      const key = `${item.peerId}:${item.lastMessage?.createdAt ?? ""}`;
      if (!item.lastMessage || item.lastMessage.mine || item.unread === 0) continue;
      if (item.peerId === peerId) continue;
      if (notifiedRef.current.has(key)) continue;
      notifiedRef.current.add(key);
      toast(`${item.name}: ${item.lastMessage.preview || "New message"}`);
    }
  }, [threads, peerId]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["chat-thread", peerId] });
    void queryClient.invalidateQueries({ queryKey: ["chat-overview"] });
  }

  const sendText = useMutation({
    mutationFn: () => send({ data: { peerId: peerId!, body: draft, kind: "text" } } as never),
    onSuccess: (result: any) => {
      if (result?.status === "blocked") {
        toast.error("This conversation is not active.");
        return;
      }
      setDraft("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function sendFile(file: File, kind: "image" | "video" | "file") {
    if (!peerId) return;
    setUploading(0);
    try {
      const signed = await uploadUrl({ data: { fileName: file.name } });
      await putWithProgress(signed.signedUrl, file, (percent) => setUploading(percent));
      await send({
        data: {
          peerId,
          kind,
          body: null,
          mediaPath: signed.path,
          mediaMime: file.type || null,
          mediaName: file.name,
        },
      } as never);
      refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(null);
    }
  }

  const avatarPreference = useMutation({
    mutationFn: (next: boolean) => setShowAvatar({ data: { showAvatar: next } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chat-overview"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (overview.isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  if ((overview.data as any)?.status !== "ok") {
    return (
      <div className="raised-panel rounded-3xl p-8 text-center">
        <p className="font-display text-base font-semibold">Chat is not available</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Chat opens between a trainee and their own trainer. Please contact your trainer.
        </p>
      </div>
    );
  }

  const peer = (thread.data as any)?.peer ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      {/* ---------- conversations ---------- */}
      <aside className="raised-panel relative overflow-hidden rounded-3xl p-3">
        <span className="connector-line absolute inset-x-0 top-0 h-1" aria-hidden />
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar url={me?.avatarUrl ?? null} name={me?.name ?? "?"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{me?.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{me?.code}</p>
          </div>
        </div>

        <div className="inset-panel mt-2 flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5">
          <Label htmlFor="chat-dp" className="flex items-center gap-2 text-xs">
            <UserRound className="h-3.5 w-3.5" />
            Show my picture
          </Label>
          <Switch
            id="chat-dp"
            checked={Boolean(me?.showAvatar)}
            onCheckedChange={(next) => avatarPreference.mutate(next)}
          />
        </div>

        <ul className="mt-3 max-h-[46vh] space-y-1.5 overflow-y-auto lg:max-h-[62vh]">
          {threads.length === 0 ? (
            <li className="px-2 py-4 text-xs text-muted-foreground">No conversations yet.</li>
          ) : null}
          {threads.map((item) => (
            <li key={item.peerId}>
              <button
                onClick={() => setPeerId(item.peerId)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                  item.peerId === peerId ? "bg-primary/15" : "hover:bg-surface-2"
                }`}
              >
                <Avatar url={item.avatarUrl} name={item.name} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{item.name}</span>
                    {item.lastMessage ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {timeLabel(item.lastMessage.createdAt)}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-muted-foreground">
                      {item.lastMessage?.preview || item.code}
                    </span>
                    {item.unread > 0 ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {item.unread}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* ---------- conversation ---------- */}
      <section className="raised-panel relative flex min-h-[60vh] flex-col overflow-hidden rounded-3xl">
        <span className="connector-line absolute inset-x-0 top-0 h-1" aria-hidden />
        {!peerId || !peer ? (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
            Pick a conversation to start chatting.
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-hairline/60 px-4 py-3">
              <Avatar url={peer.avatarUrl} name={peer.name} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{peer.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{peer.code}</p>
              </div>
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <p className="py-10 text-center text-xs text-muted-foreground">
                  No messages yet. Say hello.
                </p>
              ) : null}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-lift ${
                      message.mine
                        ? "bg-primary text-primary-foreground"
                        : "border border-metal/25 bg-surface-2 text-foreground"
                    }`}
                  >
                    {message.kind === "image" && message.mediaUrl ? (
                      <a href={message.mediaUrl} target="_blank" rel="noreferrer">
                        <img
                          src={message.mediaUrl}
                          alt={message.mediaName ?? "Shared photo"}
                          className="mb-1 max-h-72 w-full rounded-xl object-cover"
                        />
                      </a>
                    ) : null}
                    {message.kind === "video" && message.mediaUrl ? (
                      <video
                        src={message.mediaUrl}
                        controls
                        playsInline
                        className="mb-1 max-h-72 w-full rounded-xl bg-media"
                      />
                    ) : null}
                    {message.kind === "file" && message.mediaUrl ? (
                      <a
                        href={message.mediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mb-1 flex items-center gap-2 underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {message.mediaName ?? "Attachment"}
                      </a>
                    ) : null}
                    {message.body ? (
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    ) : null}
                    <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80">
                      {timeLabel(message.createdAt)}
                      {message.mine ? (
                        <Ticks deliveredAt={message.deliveredAt} readAt={message.readAt} />
                      ) : null}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {uploading !== null ? (
              <p className="px-4 pb-1 text-[11px] text-muted-foreground">
                Sending attachment… {uploading}%
              </p>
            ) : null}

            <form
              className="flex items-center gap-2 border-t border-hairline/60 px-3 py-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!draft.trim()) return;
                sendText.mutate();
              }}
            >
              <label
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-metal/30 bg-surface-2 text-muted-foreground transition-colors hover:text-brand"
                aria-label="Send a photo or video"
              >
                <ImagePlus className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) {
                      void sendFile(file, file.type.startsWith("video") ? "video" : "image");
                    }
                  }}
                />
              </label>
              <label
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-metal/30 bg-surface-2 text-muted-foreground transition-colors hover:text-brand"
                aria-label="Send a file"
              >
                <Paperclip className="h-4 w-4" />
                <input
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void sendFile(file, "file");
                  }}
                />
              </label>
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a message"
                className="h-11 flex-1 rounded-2xl"
              />
              <Button
                type="submit"
                variant="brand"
                size="icon"
                className="h-11 w-11 rounded-2xl"
                disabled={sendText.isPending || !draft.trim()}
                aria-label="Send message"
              >
                {sendText.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
