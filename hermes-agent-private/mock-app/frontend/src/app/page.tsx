"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ChatPanel } from "@/components/ChatPanel";
import { ProfilePanel } from "@/components/ProfilePanel";
import { UserSelector } from "@/components/UserSelector";
import {
  createSession,
  getProfile,
  getUsers,
  sendClarifyReply,
  streamMessage,
} from "@/lib/api";
import type { ClarifyPrompt, Message, MockUser, UserProfile } from "@/lib/types";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Home() {
  const [users, setUsers] = useState<MockUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<MockUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clarifyPrompt, setClarifyPrompt] = useState<ClarifyPrompt | null>(null);
  const [smartTalkMode, setSmartTalkMode] = useState(false);

  const streamingIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUsers()
      .then((fetched) => {
        if (cancelled) return;
        setUsers(fetched);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshProfile = useCallback(async (sid: string) => {
    try {
      const p = await getProfile(sid);
      setProfile(p);
    } catch {
      // swallow — profile refresh is best-effort
    }
  }, []);

  const handleSelectUser = useCallback(
    async (user: MockUser) => {
      if (isStreaming) return;
      if (selectedUser?.id === user.id && sessionId) return;
      setSelectedUser(user);
      setMessages([]);
      setProfile(null);
      setSessionId(null);
      try {
        const { session_id } = await createSession(user.id);
        setSessionId(session_id);
        await refreshProfile(session_id);
      } catch (e) {
        setLoadError(String(e));
      }
    },
    [isStreaming, refreshProfile, selectedUser?.id, sessionId]
  );

  const handleSend = useCallback(
    (content: string) => {
      if (!sessionId || isStreaming) return;
      const userMsg: Message = {
        id: makeId(),
        role: "user",
        content,
      };
      const assistantId = makeId();
      streamingIdRef.current = assistantId;
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsThinking(true);
      setIsStreaming(true);

      let sawFirstDelta = false;

      const applyDelta = (text: string) => {
        if (!sawFirstDelta) {
          sawFirstDelta = true;
          setIsThinking(false);
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + text }
              : m
          )
        );
      };

      const finishWith = (full: string | null) => {
        setClarifyPrompt(null);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: full ?? m.content,
                  streaming: false,
                }
              : m
          )
        );
        setIsThinking(false);
        setIsStreaming(false);
        streamingIdRef.current = null;
        if (sessionId) {
          void refreshProfile(sessionId);
        }
      };

      const applySkillsUsed = (skills: string[]) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, skillsUsed: skills } : m
          )
        );
      };

      streamMessage(
        sessionId,
        content,
        applyDelta,
        (full) => finishWith(full),
        (err) => {
          setClarifyPrompt(null);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      (m.content ? m.content + "\n\n" : "") +
                      `*Error: ${err}*`,
                    streaming: false,
                  }
                : m
            )
          );
          setIsThinking(false);
          setIsStreaming(false);
          streamingIdRef.current = null;
        },
        (prompt) => {
          setIsThinking(false);
          setClarifyPrompt(prompt);
        },
        smartTalkMode,
        applySkillsUsed
      );
    },
    [isStreaming, refreshProfile, sessionId, smartTalkMode]
  );

  const handleChoiceSelect = useCallback(
    async (choice: string) => {
      if (!sessionId) return;
      setClarifyPrompt(null);
      await sendClarifyReply(sessionId, choice);
    },
    [sessionId]
  );

  const emptyHint = selectedUser
    ? `Start a conversation as ${selectedUser.name}. Mention your work to see Hermes learn your profile.`
    : "Select a user on the left to start a session.";

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-gray-950 text-gray-100">
      <UserSelector
        users={users}
        activeUserId={selectedUser?.id ?? null}
        disabled={isStreaming}
        onSelect={handleSelectUser}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {loadError && (
          <div className="bg-red-900/30 border-b border-red-800 px-6 py-2 text-sm text-red-200">
            {loadError}
          </div>
        )}
        <ChatPanel
          messages={messages}
          isThinking={isThinking}
          isStreaming={isStreaming}
          disabled={!sessionId}
          emptyHint={emptyHint}
          onSend={handleSend}
          clarifyPrompt={clarifyPrompt}
          onChoiceSelect={handleChoiceSelect}
          smartTalkMode={smartTalkMode}
          onToggleSmartTalk={() => setSmartTalkMode((v) => !v)}
        />
      </div>
      <ProfilePanel
        user={selectedUser}
        profile={profile}
        sessionId={sessionId}
        onProfileUpdated={() => {
          if (sessionId) void refreshProfile(sessionId);
          // Re-fetch users so edits to registration fields reflect in UI.
          void getUsers()
            .then((fetched) => {
              setUsers(fetched);
              if (selectedUser) {
                const updated = fetched.find((u) => u.id === selectedUser.id);
                if (updated) setSelectedUser(updated);
              }
            })
            .catch(() => {
              /* best-effort */
            });
        }}
      />
    </main>
  );
}
