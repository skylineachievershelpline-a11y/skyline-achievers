import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { SkylineAiMascot, type SkylineAiMascotState } from "@/components/ai/SkylineAiMascot";
import { AiMessagePicture, AiPictureButton, AiPicturePreview } from "@/components/ai/AiPictureAttachment";
import { toast } from "sonner";

/** Ready-made questions so a first-time visitor can get answers with one tap. */
const QUICK_QUESTIONS = [
  "Skyline Achievers kya hai?",
  "Kaam shuru karne ke liye kya chahiye?",
  "Kya koi investment zaroori hai?",
  "Daily kitna time dena parta hai?",
  "Beginner batch kaise join karein?",
  "Training aur mentorship kaise milti hai?",
] as const;

export function PublicSkylineAi() {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/public/ai" }), []);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const { messages, sendMessage, status, stop, error } = useChat({
    id: "public-skyline-introduction",
    transport,
  });
  const busy = status === "submitted" || status === "streaming";
  const mascotState: SkylineAiMascotState = status === "submitted" ? "thinking" : status === "streaming" ? "answer" : "idle";

  useEffect(() => {
    if (!busy) chatRef.current?.querySelector("textarea")?.focus();
  }, [busy]);

  return (
    <div ref={chatRef} className="flex h-[min(76dvh,42rem)] min-h-[30rem] flex-col overflow-hidden">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-5 px-1 py-3 sm:px-2">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-5">
              <ConversationEmptyState
                icon={<SkylineAiMascot state="idle" className="w-24" />}
                title="Ask Skyline Achievers AI"
                description="Pick a question below, or type your own."
              />
              <div className="flex w-full flex-wrap justify-center gap-2">
                {QUICK_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    disabled={busy}
                    onClick={() => void sendMessage({ text: question })}
                    className="metal-edge rounded-full border border-hairline bg-surface px-3.5 py-2 text-left text-xs font-medium text-foreground shadow-glass transition hover:border-brand/40 hover:text-brand-glow active:scale-[0.97] disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return (
                      <MessageResponse
                        key={index}
                        components={{
                          img: ({ node: _node, ...props }) => (
                            <img {...props} className="mt-3 max-h-72 w-auto rounded-lg border border-hairline object-contain shadow-lift" />
                          ),
                        }}
                      >
                        {part.text}
                      </MessageResponse>
                    );
                  }
                  if (part.type === "file" && part.mediaType.startsWith("image/")) {
                    return <AiMessagePicture key={index} url={part.url} filename={part.filename} />;
                  }
                  if (part.type === "reasoning") {
                    return (
                      <Reasoning key={index} isStreaming={busy && message === messages.at(-1)} defaultOpen={false}>
                        <ReasoningTrigger />
                        <ReasoningContent>{part.text}</ReasoningContent>
                      </Reasoning>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {busy ? (
            <div className="flex items-end gap-3" role="status" aria-live="polite">
              <SkylineAiMascot state={mascotState} className="w-16 shrink-0" />
              <div className="mb-2 rounded-lg border border-hairline bg-surface px-3 py-2 shadow-glass">
                {status === "submitted" ? <Shimmer>Thinking...</Shimmer> : <p className="text-xs font-semibold text-cyan">Answer ready</p>}
              </div>
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t border-hairline pt-3">
        <PromptInput
          accept="image/jpeg,image/png,image/webp"
          maxFiles={1}
          maxFileSize={3 * 1024 * 1024}
          onError={({ message }) => toast.error(message)}
          onSubmit={({ text, files }) => {
            if ((!text.trim() && files.length === 0) || busy) return;
            if (text.trim()) void sendMessage({ text: text.trim(), files });
            else void sendMessage({ files });
          }}
          className="bg-surface"
        >
          <PromptInputHeader><AiPicturePreview /></PromptInputHeader>
          <PromptInputTextarea autoFocus placeholder="Ask about Skyline Achievers..." disabled={busy} />
          <PromptInputFooter>
            <PromptInputTools><AiPictureButton disabled={busy} /></PromptInputTools>
            <PromptInputSubmit status={status} onStop={() => void stop()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
