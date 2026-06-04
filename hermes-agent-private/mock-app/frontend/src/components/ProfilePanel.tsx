"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getGateLog,
  getSystemPrompt,
  resetInferred,
  triggerInfer,
  updateUser,
} from "@/lib/api";
import type { GateLogEntry, MockUser, UserProfile } from "@/lib/types";

interface Props {
  user: MockUser | null;
  profile: UserProfile | null;
  sessionId: string | null;
  onProfileUpdated?: () => void;
}

type TabKey = "profile" | "traits" | "prompt" | "gate";

type EditableField =
  | "role"
  | "domain"
  | "years_experience"
  | "industry"
  | "bio";

const EDITABLE_FIELDS: { key: EditableField; label: string; type: "text" | "number" }[] = [
  { key: "role", label: "Role", type: "text" },
  { key: "domain", label: "Domain", type: "text" },
  { key: "years_experience", label: "Experience (years)", type: "number" },
  { key: "industry", label: "Industry", type: "text" },
  { key: "bio", label: "Bio", type: "text" },
];

function confidenceColor(conf: number): string {
  if (conf >= 0.7) return "bg-emerald-400";
  if (conf >= 0.4) return "bg-blue-400";
  return "bg-gray-500";
}

function avgConfidence(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-3.5 h-3.5"
    >
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.379-8.379-2.828-2.828z" />
    </svg>
  );
}

export function ProfilePanel({
  user,
  profile,
  sessionId,
  onProfileUpdated,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [inferring, setInferring] = useState<boolean>(false);

  const [promptContext, setPromptContext] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState<boolean>(false);
  const [promptExpanded, setPromptExpanded] = useState<boolean>(true);

  const [gateLog, setGateLog] = useState<GateLogEntry[]>([]);
  const [gateLoading, setGateLoading] = useState<boolean>(false);

  const fetchSystemPrompt = useCallback(async () => {
    if (!sessionId) {
      setPromptContext(null);
      return;
    }
    setPromptLoading(true);
    try {
      const res = await getSystemPrompt(sessionId);
      setPromptContext(res.context);
    } catch (e) {
      setPromptContext(`(Error: ${String(e)})`);
    } finally {
      setPromptLoading(false);
    }
  }, [sessionId]);

  const fetchGateLog = useCallback(async () => {
    if (!sessionId) { setGateLog([]); return; }
    setGateLoading(true);
    try {
      const entries = await getGateLog(sessionId);
      setGateLog(entries);
    } catch {
      // swallow
    } finally {
      setGateLoading(false);
    }
  }, [sessionId]);

  // Fetch on switching to prompt tab, and auto-refresh after each assistant
  // response — we key that off changes to profile.updated_at.
  useEffect(() => {
    if (activeTab !== "prompt") return;
    void fetchSystemPrompt();
  }, [activeTab, fetchSystemPrompt, profile?.updated_at]);

  useEffect(() => {
    if (activeTab !== "gate") return;
    void fetchGateLog();
  }, [activeTab, fetchGateLog, profile?.updated_at]);

  // Reset local UI state when the selected user changes.
  useEffect(() => {
    setEditingField(null);
    setEditValue("");
    setShowResetConfirm(false);
    setActiveTab("profile");
  }, [user?.id]);

  const startEdit = (field: EditableField) => {
    if (!user) return;
    const current = user[field];
    setEditingField(field);
    setEditValue(current === undefined || current === null ? "" : String(current));
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const saveEdit = async () => {
    if (!user || !editingField) return;
    const field = editingField;
    setSaving(true);
    try {
      const payload: Partial<MockUser> = {};
      if (field === "years_experience") {
        const n = parseInt(editValue, 10);
        if (Number.isNaN(n)) {
          setSaving(false);
          return;
        }
        payload.years_experience = n;
      } else {
        payload[field] = editValue;
      }
      await updateUser(user.id, payload);
      setEditingField(null);
      setEditValue("");
      onProfileUpdated?.();
    } catch {
      // swallow — minimal error UX; leave edit open
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerInfer = async () => {
    if (!sessionId) return;
    setInferring(true);
    try {
      await triggerInfer(sessionId);
      onProfileUpdated?.();
    } catch {
      // swallow
    } finally {
      setInferring(false);
    }
  };

  const handleResetConfirm = async () => {
    if (!sessionId) return;
    setResetting(true);
    try {
      await resetInferred(sessionId);
      setShowResetConfirm(false);
      onProfileUpdated?.();
    } catch {
      // swallow
    } finally {
      setResetting(false);
    }
  };

  const renderTabButton = (key: TabKey, label: string) => {
    const active = activeTab === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => setActiveTab(key)}
        className={
          "flex-1 px-3 py-2 text-xs font-medium uppercase tracking-wide transition-colors relative " +
          (active
            ? "text-gray-50"
            : "text-gray-500 hover:text-gray-300")
        }
      >
        {label}
        {active && (
          <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-emerald-400" />
        )}
      </button>
    );
  };

  return (
    <aside className="w-80 shrink-0 h-full border-l border-gray-800 bg-gray-950 overflow-y-auto flex flex-col">
      <div className="px-5 py-5 border-b border-gray-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
          User Profile
        </h2>
        {user ? (
          <div className="mt-3">
            <div className="text-base font-semibold text-gray-50">
              {user.name}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{user.bio}</div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 mt-3">No user selected</div>
        )}
      </div>

      {user && (
        <>
          <div className="flex border-b border-gray-800">
            {renderTabButton("profile", "Profile")}
            {renderTabButton("traits", "Traits")}
            {renderTabButton("prompt", "Prompt")}
            {renderTabButton("gate", "Gate")}
          </div>

          {activeTab === "profile" && (
            <section className="px-5 py-4 flex-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Registration
              </h3>
              <dl className="space-y-2 text-sm">
                {EDITABLE_FIELDS.map(({ key, label, type }) => {
                  const isEditing = editingField === key;
                  const rawValue = user[key];
                  const displayValue =
                    rawValue === undefined || rawValue === null
                      ? ""
                      : String(rawValue);
                  return (
                    <div key={key} className="flex justify-between gap-3 items-center">
                      <dt className="text-gray-500 shrink-0">{label}</dt>
                      <dd className="text-gray-100 text-right flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-end">
                            <input
                              type={type}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="min-w-0 flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-emerald-500"
                              autoFocus
                              disabled={saving}
                            />
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={saving}
                              className="text-[10px] uppercase tracking-wide px-2 py-1 rounded bg-emerald-500 text-gray-950 font-semibold disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={saving}
                              className="text-[10px] uppercase tracking-wide px-2 py-1 rounded bg-gray-800 text-gray-300 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 justify-end">
                            <span className="truncate">
                              {key === "years_experience"
                                ? `${displayValue} years`
                                : displayValue}
                            </span>
                            <button
                              type="button"
                              onClick={() => startEdit(key)}
                              className="text-gray-500 hover:text-emerald-400 shrink-0"
                              aria-label={`Edit ${label}`}
                            >
                              <PencilIcon />
                            </button>
                          </div>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>

              <div className="border-t border-gray-800 my-5" />

              <button
                type="button"
                onClick={() => void handleTriggerInfer()}
                disabled={!sessionId || inferring}
                className="w-full text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded bg-emerald-600/90 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed mb-3"
              >
                {inferring ? "Analyzing..." : "Save Traits"}
              </button>

              {showResetConfirm ? (
                <div className="rounded-lg border border-red-800 bg-red-950/40 p-3">
                  <p className="text-xs text-red-200 mb-3">
                    Are you sure? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleResetConfirm}
                      disabled={resetting || !sessionId}
                      className="flex-1 text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      {resetting ? "Resetting..." : "Confirm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      disabled={resetting}
                      className="flex-1 text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={!sessionId}
                  className="w-full text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded bg-red-600/90 text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Reset Learned Traits
                </button>
              )}
            </section>
          )}

          {activeTab === "traits" && (
            <section className="px-5 py-4 flex-1">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Learned Traits
                </h3>
                {profile && profile.inferred.length > 0 && (
                  <span className="text-[10px] uppercase tracking-wide text-gray-500">
                    {profile.inferred.length} dimension
                    {profile.inferred.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {/* Signal Vocab */}
              <div className="mb-4 rounded-lg border border-gray-800 bg-gray-900/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Signal Vocab
                    {profile?.signal_vocab?.length
                      ? ` (${profile.signal_vocab.length})`
                      : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => onProfileUpdated?.()}
                    disabled={!sessionId}
                    className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-40"
                  >
                    Refresh
                  </button>
                </div>
                {!profile?.signal_vocab?.length ? (
                  <p className="text-[10px] text-gray-600 italic">
                    None yet — click Save Traits after chatting.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {profile.signal_vocab
                      .slice()
                      .sort((a, b) => b.confidence - a.confidence)
                      .map((entry) => (
                        <li key={entry.term} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] text-gray-200 truncate">
                                &ldquo;{entry.term}&rdquo;
                              </span>
                              <span className="text-[10px] tabular-nums text-gray-500 shrink-0">
                                {entry.confidence.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {entry.trigger_for && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-800 shrink-0">
                                  → {entry.trigger_for}
                                </span>
                              )}
                              <div className="flex-1 h-0.5 rounded-full bg-gray-800 overflow-hidden">
                                <div
                                  className={confidenceColor(entry.confidence) + " h-full"}
                                  style={{ width: `${Math.max(4, entry.confidence * 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              {!profile || profile.inferred.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-800 px-3 py-6 text-center text-xs text-gray-500">
                  No traits learned yet — keep chatting!
                </div>
              ) : (
                <ul className="space-y-4">
                  {profile.inferred.map((dim) => {
                    const avg = avgConfidence(
                      dim.keywords.map((k) => k.confidence)
                    );
                    return (
                      <li
                        key={dim.field}
                        className="rounded-lg border border-gray-800 bg-gray-900/50 p-3"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-sm font-medium text-gray-100">
                            {dim.field}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={
                                "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded text-gray-950 " +
                                confidenceColor(avg)
                              }
                            >
                              avg {avg.toFixed(2)}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-gray-500">
                              {dim.keywords.length} kw
                            </span>
                          </div>
                        </div>
                        {dim.summary && (
                          <div className="mt-2 text-xs text-gray-200 leading-relaxed font-medium">
                            {dim.summary}
                          </div>
                        )}
                        <ul className="mt-3 space-y-1.5">
                          {dim.keywords.map((k) => (
                            <li key={k.value} className="text-xs">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className="text-gray-200 truncate">
                                  {k.value}
                                </span>
                                <span className="text-gray-500 tabular-nums">
                                  {k.confidence.toFixed(2)}
                                </span>
                              </div>
                              <div className="h-1 w-full rounded-full bg-gray-800 overflow-hidden">
                                <div
                                  className={
                                    "h-full " + confidenceColor(k.confidence)
                                  }
                                  style={{
                                    width: `${Math.max(
                                      4,
                                      Math.min(100, k.confidence * 100)
                                    )}%`,
                                  }}
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {activeTab === "gate" && (
            <section className="px-5 py-4 flex-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Signal Gate Log
                </h3>
                <button
                  type="button"
                  onClick={() => void fetchGateLog()}
                  disabled={!sessionId || gateLoading}
                  className="text-[10px] uppercase tracking-wide px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
                >
                  {gateLoading ? "..." : "Refresh"}
                </button>
              </div>

              {profile?.signal_vocab && profile.signal_vocab.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
                    Signal Vocab ({profile.signal_vocab.length} terms)
                  </div>
                  <ul className="space-y-1.5">
                    {profile.signal_vocab
                      .slice()
                      .sort((a, b) => b.confidence - a.confidence)
                      .map((entry) => (
                        <li key={entry.term} className="rounded border border-gray-800 bg-gray-900/50 px-2.5 py-2">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs text-gray-100 font-medium truncate">
                              &ldquo;{entry.term}&rdquo;
                            </span>
                            <span className="text-[10px] tabular-nums text-gray-500 shrink-0">
                              {entry.confidence.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.trigger_for && (
                              <span className="text-[10px] px-1 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-800 shrink-0">
                                → {entry.trigger_for}
                              </span>
                            )}
                            <div className="flex-1 h-1 rounded-full bg-gray-800 overflow-hidden">
                              <div
                                className={confidenceColor(entry.confidence) + " h-full"}
                                style={{ width: `${Math.max(4, entry.confidence * 100)}%` }}
                              />
                            </div>
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {gateLog.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-800 px-3 py-6 text-center text-xs text-gray-500">
                  No turns yet — send messages to see gate results.
                </div>
              ) : (
                <ul className="space-y-2">
                  {gateLog.map((entry) => {
                    const passed = entry.gate1 && entry.gate2;
                    return (
                      <li
                        key={entry.turn}
                        className="rounded-lg border border-gray-800 bg-gray-900/50 p-2.5"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] uppercase tracking-wide text-gray-500 shrink-0">
                            Turn {entry.turn}
                          </span>
                          <span
                            className={
                              "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded " +
                              (passed
                                ? "bg-emerald-400 text-gray-950"
                                : "bg-gray-700 text-gray-400")
                            }
                          >
                            {passed ? "Signal" : "No signal"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 italic truncate mb-1.5">
                          &ldquo;{entry.preview}&rdquo;
                        </p>
                        <div className="flex gap-3 text-[10px]">
                          <span className={entry.gate1 ? "text-emerald-400" : "text-gray-600"}>
                            G1 len {entry.gate1 ? "✓" : "✗"}
                          </span>
                          <span className={entry.gate2 ? "text-emerald-400" : "text-gray-600"}>
                            G2 vocab {entry.gate2 ? "✓" : "✗"}
                          </span>
                        </div>
                        {entry.matched_terms.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {entry.matched_terms.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-800"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {activeTab === "prompt" && (
            <section className="px-5 py-4 flex-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  System Prompt Context
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void fetchSystemPrompt()}
                    disabled={!sessionId || promptLoading}
                    className="text-[10px] uppercase tracking-wide px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
                  >
                    {promptLoading ? "..." : "Refresh"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptExpanded((v) => !v)}
                    className="text-[10px] uppercase tracking-wide px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700"
                  >
                    {promptExpanded ? "▼ Collapse" : "▶ Expand"}
                  </button>
                </div>
              </div>
              {!sessionId ? (
                <div className="rounded-lg border border-dashed border-gray-800 px-3 py-6 text-center text-xs text-gray-500">
                  (No session active)
                </div>
              ) : promptExpanded ? (
                <pre className="rounded-lg bg-gray-900 border border-gray-800 p-3 text-xs text-gray-200 whitespace-pre-wrap font-mono leading-relaxed max-h-[60vh] overflow-auto">
                  {promptContext ?? (promptLoading ? "Loading..." : "")}
                </pre>
              ) : (
                <div className="text-xs text-gray-500 italic">
                  Collapsed — click Expand to view.
                </div>
              )}
            </section>
          )}
        </>
      )}
    </aside>
  );
}
