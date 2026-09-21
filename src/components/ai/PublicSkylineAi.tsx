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
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { SkylineAiMascot, type SkylineAiMascotState } from "@/components/ai/SkylineAiMascot";

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
            <ConversationEmptyState
              icon={<SkylineAiMascot state="idle" className="w-24" />}
              title="Ask Skyline Achievers AI"
              description="Learn what Skyline Achievers is and how its guided journey works."
            />
          ) : null}
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                {message.parts.map((part, index) => {
                  if (part.type === "text") return <MessageResponse key={index}>{part.text}</MessageResponse>;
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
          onSubmit={({ text }) => {
            if (!text.trim() || busy) return;
            void sendMessage({ text: text.trim() });
          }}
          className="bg-surface"
        >
          <PromptInputTextarea autoFocus placeholder="Ask about Skyline Achievers..." disabled={busy} />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={() => void stop()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
