export interface AgentTemplate {
  name: string;
  content: string;
  metadata: AgentMetadata;
}

export interface AgentMetadata {
  description: string;
}

export function extractMetadata(content: string): AgentMetadata {
  const firstLine = content.split("\n").find((line) => line.trim().length > 0);
  const description = firstLine
    ? firstLine.replace(/^#+\s*/, "").trim()
    : "";
  return { description };
}
