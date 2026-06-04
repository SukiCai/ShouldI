"use client";

import type { MockUser } from "@/lib/types";

interface Props {
  users: MockUser[];
  activeUserId: string | null;
  disabled?: boolean;
  onSelect: (user: MockUser) => void;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserSelector({ users, activeUserId, disabled, onSelect }: Props) {
  return (
    <aside className="w-64 shrink-0 h-full border-r border-gray-800 bg-gray-950 overflow-y-auto">
      <div className="px-4 py-5 border-b border-gray-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
          Mock Users
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Each user has an independent profile
        </p>
      </div>
      <ul className="py-2">
        {users.map((user) => {
          const active = user.id === activeUserId;
          return (
            <li key={user.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(user)}
                className={
                  "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors " +
                  (active
                    ? "bg-gray-800/70 border-l-2 border-blue-400"
                    : "hover:bg-gray-900/60 border-l-2 border-transparent") +
                  (disabled ? " opacity-60 cursor-not-allowed" : "")
                }
              >
                <div
                  className={
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                    (active
                      ? "bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/50"
                      : "bg-gray-800 text-gray-300")
                  }
                >
                  {initialsOf(user.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-100 truncate">
                    {user.name}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {user.role}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate mt-0.5">
                    {user.domain}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
