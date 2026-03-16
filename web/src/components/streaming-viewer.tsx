import { useEffect, useRef } from "react";

interface StreamingViewerProps {
  outputs: Record<string, string>;
  activeAgents: Set<string>;
}

export function StreamingViewer({ outputs, activeAgents }: StreamingViewerProps): React.JSX.Element {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [outputs]);

  const agents = Object.keys(outputs);

  if (agents.length === 0) {
    return (
      <div className="loading">
        <span className="spinner" />
        En attente de la reponse...
      </div>
    );
  }

  return (
    <div className="streaming-outputs">
      {agents.map((agent) => (
        <div key={agent} className="streaming-agent">
          <div className="streaming-agent-header">
            <span className="step-agent">{agent}</span>
            {activeAgents.has(agent) && <span className="spinner" />}
          </div>
          <div className="log-viewer">
            {outputs[agent]}
            <div ref={agent === agents[agents.length - 1] ? endRef : undefined} />
          </div>
        </div>
      ))}
    </div>
  );
}
