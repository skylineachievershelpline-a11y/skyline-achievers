import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo } from "react";

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
import { supabase } from "@/integrations/supabase/client";

export function SkylineAiChat({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/ai",
    body: { threadId },
    headers: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
    },
  }), [threadId]);
  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
  });
  const busy = status === "submitted" || status === "streaming";
  const mascotState: SkylineAiMascotState = status === "submitted" ? "thinking" : status === "streaming" ? "answer" : "idle";

  return (
    <div className="glass-panel-strong metal-edge flex h-[calc(100dvh-8.5rem)] min-h-[32rem] flex-col overflow-hidden rounded-2xl">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-5 p-4 sm:p-6">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<SkylineAiMascot state="idle" className="w-28" />}
              title="Skyline Achievers AI"
              description="Ask how to use the features available on your own dashboard."
            />
          ) : null}
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                {message.parts.map((part, index) => {
                  if (part.type === "text") return <MessageResponse key={index}>{part.text}</MessageResponse>;
                  if (part.type === "reasoning") {
                    return (
                      <Reasoning key={index} isStreaming={busy && message === messages[messages.length - 1]} defaultOpen={false}>
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
              <SkylineAiMascot state={mascotState} className="w-20 shrink-0" />
              <div className="mb-2 rounded-lg border border-hairline bg-surface px-3 py-2 shadow-glass">
                {status === "submitted" ? <Shimmer>Thinking...</Shimmer> : <p className="text-xs font-semibold text-cyan">Your answer is ready</p>}
              </div>
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t border-hairline bg-background/80 p-3 backdrop-blur-md sm:p-4">
        <PromptInput
          onSubmit={({ text }) => {
            if (!text.trim() || busy) return;
            void sendMessage({ text: text.trim() });
          }}
          className="bg-surface"
        >
          <PromptInputTextarea placeholder="Ask Skyline Achievers AI..." disabled={busy} />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={() => void stop()} disabled={!busy && status !== "ready"} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}