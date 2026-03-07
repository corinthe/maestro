interface Props {
  plan: string;
  lastUpdated?: string;
}

export default function OrchestratorPlan({ plan, lastUpdated }: Props) {
  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500">
        <svg className="w-10 h-10 mb-2 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="italic text-sm">No plan available yet</span>
      </div>
    );
  }

  // Render markdown-like content as structured sections
  const sections = plan.split(/^#{1,3}\s+/m).filter(Boolean);
  const headings = plan.match(/^#{1,3}\s+.+/gm) ?? [];

  return (
    <div className="max-w-3xl mx-auto">
      {lastUpdated && (
        <div className="text-xs text-slate-500 mb-4">
          Last updated: {new Date(lastUpdated).toLocaleString()}
        </div>
      )}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
        {headings.length > 0 ? (
          <div>
            {sections.map((section, i) => {
              const heading = headings[i];
              if (!heading) return null;
              const level = heading.match(/^(#+)/)?.[1]?.length ?? 1;
              const title = heading.replace(/^#+\s+/, '');
              const content = section.trim();

              return (
                <div key={i} className="border-b border-slate-700/50 last:border-0">
                  <div
                    className={`px-5 py-3 font-semibold ${
                      level === 1
                        ? 'text-lg text-slate-100 bg-slate-800'
                        : level === 2
                        ? 'text-base text-slate-200 bg-slate-800/40'
                        : 'text-sm text-slate-300'
                    }`}
                  >
                    {title}
                  </div>
                  {content && (
                    <pre className="px-5 py-3 text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                      {content}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <pre className="p-5 text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
            {plan}
          </pre>
        )}
      </div>
    </div>
  );
}
