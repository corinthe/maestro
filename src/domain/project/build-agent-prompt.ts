export function buildAgentPrompt(
  template: string,
  soul: string,
  sharedContext: string
): string {
  const sections: string[] = [template];

  if (soul) {
    sections.push("---\n## Contexte du projet\n" + soul);
  }

  if (sharedContext) {
    sections.push("---\n## Conventions partagees\n" + sharedContext);
  }

  return sections.join("\n\n");
}
