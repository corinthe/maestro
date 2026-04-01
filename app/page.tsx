const stats = [
  { label: "Total Features", value: "0" },
  { label: "In Progress", value: "0" },
  { label: "Backlog", value: "0" },
  { label: "Done", value: "0" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-text">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-card p-5"
          >
            <p className="text-sm text-text-secondary">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold text-text">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <section>
        <h2 className="mb-4 text-lg font-medium text-text">Recent Activity</h2>
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-text-secondary">
          No activity yet
        </div>
      </section>

      {/* Active features */}
      <section>
        <h2 className="mb-4 text-lg font-medium text-text">
          Active Features
        </h2>
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-text-secondary">
          No features in progress
        </div>
      </section>
    </div>
  );
}
