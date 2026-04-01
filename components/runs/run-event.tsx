"use client";

type RunEventData = {
  type: string;
  subtype?: string;
  text?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: string;
  isError?: boolean;
  sessionId?: string;
  model?: string;
  summary?: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
};

export function RunEvent({ event }: { event: RunEventData }) {
  switch (event.type) {
    case "system":
      return (
        <div className="flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700 font-mono">
          <span className="shrink-0 font-semibold">[system]</span>
          <span>
            {event.subtype === "init"
              ? `Session started — model: ${event.model ?? "unknown"}`
              : event.subtype === "stderr"
              ? "stderr output"
              : event.subtype ?? ""}
          </span>
        </div>
      );

    case "assistant":
      if (event.subtype === "thinking") {
        return (
          <div className="flex items-start gap-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500 font-mono">
            <span className="shrink-0 font-semibold">[thinking]</span>
            <span className="whitespace-pre-wrap break-all">{event.text}</span>
          </div>
        );
      }
      if (event.subtype === "tool_use") {
        return (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 font-mono">
            <span className="shrink-0 font-semibold">[tool]</span>
            <span className="break-all">
              {event.toolName}
              {event.toolInput ? (
                <span className="text-amber-600">
                  {" "}
                  {typeof event.toolInput === "string"
                    ? event.toolInput
                    : JSON.stringify(event.toolInput, null, 2).slice(0, 200)}
                </span>
              ) : null}
            </span>
          </div>
        );
      }
      // text
      return (
        <div className="flex items-start gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-900 font-mono">
          <span className="shrink-0 text-xs font-semibold text-green-600">[assistant]</span>
          <span className="whitespace-pre-wrap break-words">{event.text}</span>
        </div>
      );

    case "user":
      if (event.subtype === "tool_result") {
        return (
          <div
            className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs font-mono ${
              event.isError ? "bg-red-50 text-red-700" : "bg-cyan-50 text-cyan-800"
            }`}
          >
            <span className="shrink-0 font-semibold">
              [{event.isError ? "error" : "result"}]
            </span>
            <span className="whitespace-pre-wrap break-all">
              {(event.toolResult ?? "").slice(0, 500)}
            </span>
          </div>
        );
      }
      return null;

    case "result":
      return (
        <div className="flex flex-col gap-1 rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-800 font-mono">
          <div className="font-semibold">
            [result] {event.subtype === "success" ? "Completed" : event.subtype ?? "Done"}
          </div>
          {event.summary && (
            <div className="whitespace-pre-wrap text-indigo-700">{event.summary.slice(0, 500)}</div>
          )}
          <div className="mt-1 flex gap-4 text-indigo-500">
            {event.inputTokens != null && <span>In: {event.inputTokens.toLocaleString()}</span>}
            {event.outputTokens != null && <span>Out: {event.outputTokens.toLocaleString()}</span>}
            {event.costUsd != null && <span>Cost: ${event.costUsd.toFixed(4)}</span>}
          </div>
        </div>
      );

    default:
      return null;
  }
}
