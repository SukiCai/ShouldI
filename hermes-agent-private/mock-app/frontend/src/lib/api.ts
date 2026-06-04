import type { ClarifyPrompt, MockUser, UserProfile } from "./types";

export async function getUsers(): Promise<MockUser[]> {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
  return (await res.json()) as MockUser[];
}

export async function createSession(
  userId: string
): Promise<{ session_id: string; user: MockUser }> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  return (await res.json()) as { session_id: string; user: MockUser };
}

export async function getProfile(
  sessionId: string
): Promise<UserProfile | null> {
  const res = await fetch(`/api/sessions/${sessionId}/profile`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data) return null;
  return data as UserProfile;
}

export async function updateUser(
  userId: string,
  data: Partial<MockUser>
): Promise<MockUser> {
  const res = await fetch(`/api/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update user: ${res.status}`);
  return (await res.json()) as MockUser;
}

export async function getGateLog(
  sessionId: string
): Promise<import("./types").GateLogEntry[]> {
  const res = await fetch(`/api/sessions/${sessionId}/gate-log`);
  if (!res.ok) throw new Error(`Failed to fetch gate log: ${res.status}`);
  return (await res.json()) as import("./types").GateLogEntry[];
}

export async function triggerInfer(sessionId: string): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}/infer`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to trigger inference: ${res.status}`);
}

export async function resetInferred(sessionId: string): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}/inferred`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to reset inferred: ${res.status}`);
}

export async function getSystemPrompt(
  sessionId: string
): Promise<{ context: string }> {
  const res = await fetch(`/api/sessions/${sessionId}/system-prompt`);
  if (!res.ok) throw new Error(`Failed to fetch system prompt: ${res.status}`);
  return (await res.json()) as { context: string };
}

export async function sendClarifyReply(
  sessionId: string,
  choice: string
): Promise<void> {
  await fetch(`/api/sessions/${sessionId}/clarify-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ choice }),
  });
}

// Direct backend URL bypasses Next.js rewrite proxy, which buffers SSE streams.
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function streamMessage(
  sessionId: string,
  content: string,
  onDelta: (text: string) => void,
  onDone: (full: string) => void,
  onError: (err: string) => void,
  onClarify?: (prompt: ClarifyPrompt) => void,
  smartTalkMode?: boolean,
  onSkillsUsed?: (skills: string[]) => void
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ content, smart_talk_mode: smartTalkMode ?? false }),
    });
  } catch (e) {
    onError(String(e));
    return;
  }

  if (!res.ok || !res.body) {
    onError(`Request failed: ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalText = "";

  const handleEvent = (raw: string) => {
    // An SSE event block is a sequence of `data: ...` lines. Join them.
    const lines = raw.split("\n");
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (dataLines.length === 0) return;
    const payload = dataLines.join("\n");
    try {
      const msg = JSON.parse(payload) as {
        type: string;
        content?: string;
        question?: string;
        choices?: string[];
        skills?: string[];
      };
      if (msg.type === "delta") {
        onDelta(msg.content ?? "");
      } else if (msg.type === "done") {
        finalText = msg.content ?? "";
        onDone(finalText);
      } else if (msg.type === "error") {
        onError(msg.content ?? "unknown error");
      } else if (msg.type === "clarify" && onClarify) {
        onClarify({ question: msg.question ?? "", choices: msg.choices ?? [] });
      } else if (msg.type === "skills_used" && onSkillsUsed && Array.isArray(msg.skills)) {
        onSkillsUsed(msg.skills);
      }
    } catch {
      // Ignore malformed frames.
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE frames are separated by blank lines (\n\n).
      let sepIdx = buffer.indexOf("\n\n");
      while (sepIdx !== -1) {
        const raw = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        handleEvent(raw);
        sepIdx = buffer.indexOf("\n\n");
      }
    }
    if (buffer.trim().length > 0) {
      handleEvent(buffer);
    }
  } catch (e) {
    onError(String(e));
  }
}
