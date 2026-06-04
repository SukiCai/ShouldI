import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Message } from "@/lib/types";

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end px-6 py-2">
        <div className="max-w-[75%] rounded-2xl bg-gray-800 px-4 py-3 text-gray-50 shadow-sm">
          <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start px-6 py-2">
      <div className="max-w-[85%] min-w-0 overflow-hidden rounded-2xl bg-gray-900/60 border border-gray-800 px-4 py-3 text-gray-100 shadow-sm">
        <div className="prose prose-invert prose-sm max-w-none break-words prose-p:my-2 prose-pre:bg-gray-950 prose-pre:overflow-x-auto prose-code:text-blue-300 prose-code:break-all prose-headings:text-gray-50">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || " "}</ReactMarkdown>
        </div>
        {message.streaming && (
          <span className="inline-block w-2 h-4 ml-0.5 -mb-0.5 bg-blue-400 animate-pulse">
            {""}
          </span>
        )}
        {!message.streaming && message.skillsUsed && message.skillsUsed.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.skillsUsed.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full bg-violet-900/50 border border-violet-700/60 px-2.5 py-0.5 text-[11px] font-medium text-violet-300"
              >
                <span className="opacity-70">⚡</span>
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
