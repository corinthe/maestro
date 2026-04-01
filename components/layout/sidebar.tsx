"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Agents", href: "/agents" },
];

const bottomItems: typeof navItems = [];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center px-5">
        <Link href="/" className="text-lg font-semibold text-text">
          Maestro
        </Link>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
              isActive(item.href)
                ? "bg-primary/10 text-primary"
                : "text-text-secondary hover:bg-gray-100 hover:text-text"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Separator */}
      <div className="mx-3 border-t border-border" />

      {/* Settings */}
      <nav className="space-y-0.5 px-3 py-2">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
              isActive(item.href)
                ? "bg-primary/10 text-primary"
                : "text-text-secondary hover:bg-gray-100 hover:text-text"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Orchestrator status */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="h-2 w-2 rounded-full bg-gray-300" />
          Orchestrator idle
        </div>
      </div>
    </aside>
  );
}
