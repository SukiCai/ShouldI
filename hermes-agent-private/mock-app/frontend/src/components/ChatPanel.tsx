"use client";

import { useEffect, useRef, useState } from "react";

import type { ClarifyPrompt, Message } from "@/lib/types";

import { MessageBubble } from "./MessageBubble";
import { ThinkingIndicator } from "./ThinkingIndicator";

interface Props {
  messages: Message[];
  isThinking: boolean;
  isStreaming: boolean;
  disabled: boolean;
  emptyHint: string;
  onSend: (content: string) => void;
  clarifyPrompt?: ClarifyPrompt | null;
  onChoiceSelect?: (choice: string) => void;
  smartTalkMode?: boolean;
  onToggleSmartTalk?: () => void;
}

export function ChatPanel({
  messages,
  isThinking,
  isStreaming,
  disabled,
  emptyHint,
  onSend,
  clarifyPrompt,
  onChoiceSelect,
  smartTalkMode,
  onToggleSmartTalk,
}: Props) {
  const [input, setInput] = useState("");
  const [customAnswer, setCustomAnswer] = useState("");
  const [isTypingCustom, setIsTypingCustom] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const customInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isThinking]);

  useEffect(() => {
    setIsTypingCustom(false);
    setCustomAnswer("");
  }, [clarifyPrompt]);

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <section className="flex-1 h-full flex flex-col bg-gray-950">
      <header className="h-14 shrink-0 border-b border-gray-800 flex items-center px-6">
        <div className="text-sm font-semibold text-gray-100">Conversation</div>
        <div className="ml-auto text-xs text-gray-500">
          {isStreaming ? "Streaming…" : isThinking ? "Thinking…" : "Idle"}
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-4"
      >
        {messages.length === 0 && !isThinking ? (
          <div className="h-full flex items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <div className="text-sm text-gray-400">{emptyHint}</div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isThinking && (
              <div className="flex justify-start px-6 py-2">
                <div className="rounded-2xl bg-gray-900/60 border border-gray-800">
                  <ThinkingIndicator />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-gray-800 bg-gray-950 px-6 py-4">
        {clarifyPrompt && (
          <div className="mb-3 rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3">
            <p className="text-xs font-medium text-blue-400 mb-1 uppercase tracking-wide">Choose an option</p>
            <p className="text-sm text-gray-200 mb-3">{clarifyPrompt.question}</p>
            {isTypingCustom ? (
              <div className="flex items-center gap-2">
                <input
                  ref={customInputRef}
                  autoFocus
                  value={customAnswer}
                  onChange={(e) => setCustomAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customAnswer.trim()) {
                      onChoiceSelect?.(customAnswer.trim());
                      setIsTypingCustom(false);
                      setCustomAnswer("");
                    } else if (e.key === "Escape") {
                      setIsTypingCustom(false);
                      setCustomAnswer("");
                    }
                  }}
                  placeholder="Type your answer…"
                  className="flex-1 rounded-lg border border-blue-500/40 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-blue-400"
                />
                <button
                  type="button"
                  disabled={!customAnswer.trim()}
                  onClick={() => {
                    onChoiceSelect?.(customAnswer.trim());
                    setIsTypingCustom(false);
                    setCustomAnswer("");
                  }}
                  className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-400 disabled:opacity-40 transition-colors"
                >
                  Send
                </button>
                <button
                  type="button"
                  onClick={() => { setIsTypingCustom(false); setCustomAnswer(""); }}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {clarifyPrompt.choices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => {
                      if (choice === "Type your answer") {
                        setIsTypingCustom(true);
                        setTimeout(() => customInputRef.current?.focus(), 0);
                      } else {
                        onChoiceSelect?.(choice);
                      }
                    }}
                    className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-sm text-blue-300 hover:bg-blue-500/20 hover:border-blue-400 transition-colors"
                  >
                    {choice}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setIsTypingCustom(true);
                    setTimeout(() => customInputRef.current?.focus(), 0);
                  }}
                  className="rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
                >
                  Other…
                </button>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={onToggleSmartTalk}
            disabled={disabled}
            title={smartTalkMode ? "Smart Talk ON — every message uses smart_talk skill" : "Smart Talk OFF — click to enable"}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
              smartTalkMode
                ? "bg-violet-500/20 border border-violet-500/50 text-violet-300 hover:bg-violet-500/30"
                : "bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${smartTalkMode ? "bg-violet-400" : "bg-gray-500"}`} />
            Smart Talk
          </button>
        </div>
        <div className="flex items-end gap-3 rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2 focus-within:border-blue-500/60 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
            }}
            onKeyDown={onKeyDown}
            disabled={disabled || isStreaming}
            placeholder={
              disabled
                ? "Select a user to start chatting"
                : clarifyPrompt
                ? "↑ Choose one of the options above"
                : "Message Hermes…  (Shift+Enter for newline)"
            }
            rows={1}
            className="flex-1 resize-none bg-transparent text-[15px] text-gray-100 placeholder:text-gray-500 focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={send}
            disabled={disabled || isStreaming || input.trim().length === 0}
            className="shrink-0 rounded-lg bg-blue-500 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}
