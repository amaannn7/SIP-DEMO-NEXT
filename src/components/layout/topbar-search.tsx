"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, ArrowRight, Users2, LayoutGrid, BarChart3, Settings, ShieldCheck, Loader2 } from "lucide-react";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useSessionRole } from "./session-role-context";
import { LeadAvatar } from "@/components/leads/lead-avatar";
import { UserAvatar } from "@/components/chat/user-avatar";
import { StageBadge } from "@/components/leads/stage-badge";
import type { leads, userRoleEnum } from "@/lib/db/schema";
import type { UserRole } from "@/lib/auth/session";

type Lead = typeof leads.$inferSelect;
type Person = { id: string; displayName: string; email: string; role: (typeof userRoleEnum.enumValues)[number]; avatarUrl: string | null };
type SearchResponse = { leads: Lead[]; leadsTotal: number; people: Person[] };

const RESULT_LIMIT = 6;

// Static "go to" shortcuts — a command palette staple (Linear/GitHub both
// have these) alongside real search results, matched by label substring.
// Gated the same way each page itself is gated, so a rep never sees a
// shortcut to a page they can't actually open.
const NAV_SHORTCUTS: { label: string; href: string; icon: typeof Users2; minRole: UserRole }[] = [
  { label: "Workbench", href: "/workbench", icon: LayoutGrid, minRole: "rep" },
  { label: "Reports", href: "/reports", icon: BarChart3, minRole: "admin" },
  { label: "Users", href: "/admin/users", icon: ShieldCheck, minRole: "admin" },
  { label: "Settings", href: "/admin/settings", icon: Settings, minRole: "admin" },
];

const ROLE_RANK: Record<UserRole, number> = { rep: 0, admin: 1, super_admin: 2 };

type FlatResult = { kind: "lead"; lead: Lead } | { kind: "person"; person: Person } | { kind: "nav"; shortcut: (typeof NAV_SHORTCUTS)[number] };

/**
 * A real command-palette-style global search, matching how this pattern
 * works everywhere else (Linear, Notion, GitHub) — sectioned live results
 * (leads, teammates, page shortcuts) in a dropdown as you type, full
 * keyboard navigation across every section as one flat list.
 */
export function TopbarSearch() {
  const role = useSessionRole();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  // 120ms rather than 250ms — measured round trip to a warm /api/search is
  // ~5-10ms locally, so the debounce itself was the dominant, and only really
  // felt, source of "takes a bit of time" here. Still enough to collapse
  // fast typing into one request instead of firing per keystroke.
  const debouncedQuery = useDebouncedValue(query.trim(), 120);
  // True the instant a keystroke changes the (not-yet-debounced) query, so
  // the spinner appears immediately rather than only once the debounce
  // window elapses and the fetch itself starts — otherwise the dropdown
  // looks frozen for the debounce's whole duration with no feedback at all.
  const isDebouncePending = query.trim() !== debouncedQuery && query.trim().length > 0;

  const { data, isFetching } = useQuery<SearchResponse>({
    queryKey: ["global-search", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedQuery.length > 0,
    placeholderData: (previous) => previous,
  });
  const isSearching = isDebouncePending || isFetching;

  const leadResults = debouncedQuery.length > 0 ? (data?.leads ?? []).slice(0, RESULT_LIMIT) : [];
  const peopleResults = debouncedQuery.length > 0 ? (data?.people ?? []) : [];
  const leadsTotal = data?.leadsTotal ?? 0;

  const navResults = useMemo(() => {
    if (debouncedQuery.length === 0) return [];
    const q = debouncedQuery.toLowerCase();
    return NAV_SHORTCUTS.filter((s) => ROLE_RANK[role] >= ROLE_RANK[s.minRole] && s.label.toLowerCase().includes(q));
  }, [debouncedQuery, role]);

  // One flat list drives keyboard nav across every section, in display order.
  const flatResults: FlatResult[] = [
    ...leadResults.map((lead): FlatResult => ({ kind: "lead", lead })),
    ...peopleResults.map((person): FlatResult => ({ kind: "person", person })),
    ...navResults.map((shortcut): FlatResult => ({ kind: "nav", shortcut })),
  ];

  useEffect(() => setHighlighted(0), [debouncedQuery]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function openResult(result: FlatResult) {
    setIsOpen(false);
    setQuery("");
    if (result.kind === "lead") router.push(`/leads/${result.lead.id}`);
    else if (result.kind === "person") router.push(`/chat?dm=${result.person.id}`);
    else router.push(result.shortcut.href);
  }

  function seeAllResults() {
    setIsOpen(false);
    router.push(`/leads?search=${encodeURIComponent(query.trim())}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || flatResults.length === 0) {
      if (e.key === "Enter" && query.trim()) seeAllResults();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      openResult(flatResults[highlighted]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  const showDropdown = isOpen && query.trim().length > 0;
  const hasAnyResults = flatResults.length > 0;

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      {isSearching ? (
        <Loader2 className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <Search className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search leads, teammates, pages…"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="topbar-search-results"
        className="relative h-9 w-56 rounded-full border border-transparent bg-muted py-1.5 pr-3 pl-10 text-sm outline-none transition-all placeholder:text-muted-foreground focus:w-72 focus:border-[var(--primary)] focus:bg-card focus:ring-4 focus:ring-[var(--primary)]/12 lg:w-64 lg:focus:w-80"
      />

      {showDropdown && (
        <div
          id="topbar-search-results"
          className="absolute top-11 right-0 z-40 w-80 overflow-hidden rounded-2xl border border-border bg-popover shadow-[var(--shadow-overlay)] lg:w-96"
        >
          {isSearching && !hasAnyResults ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">Searching…</p>
          ) : !hasAnyResults ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">No results for &ldquo;{debouncedQuery}&rdquo;</p>
          ) : (
            <div className="max-h-96 overflow-y-auto py-1.5">
              {leadResults.length > 0 && (
                <ResultSection title="Leads">
                  {leadResults.map((lead) => {
                    const idx = flatResults.findIndex((r) => r.kind === "lead" && r.lead.id === lead.id);
                    const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unnamed lead";
                    return (
                      <ResultRow key={lead.id} active={idx === highlighted} onHover={() => setHighlighted(idx)} onClick={() => openResult({ kind: "lead", lead })}>
                        <LeadAvatar firstName={lead.firstName} lastName={lead.lastName} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-foreground">{name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {[lead.title, lead.company].filter(Boolean).join(" at ") || "–"}
                          </span>
                        </span>
                        <StageBadge stage={lead.stage} />
                      </ResultRow>
                    );
                  })}
                </ResultSection>
              )}

              {peopleResults.length > 0 && (
                <ResultSection title="Teammates">
                  {peopleResults.map((person) => {
                    const idx = flatResults.findIndex((r) => r.kind === "person" && r.person.id === person.id);
                    return (
                      <ResultRow key={person.id} active={idx === highlighted} onHover={() => setHighlighted(idx)} onClick={() => openResult({ kind: "person", person })}>
                        <UserAvatar name={person.displayName} avatarUrl={person.avatarUrl} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-foreground">{person.displayName}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{person.email}</span>
                        </span>
                      </ResultRow>
                    );
                  })}
                </ResultSection>
              )}

              {navResults.length > 0 && (
                <ResultSection title="Go to">
                  {navResults.map((shortcut) => {
                    const idx = flatResults.findIndex((r) => r.kind === "nav" && r.shortcut.href === shortcut.href);
                    const Icon = shortcut.icon;
                    return (
                      <ResultRow key={shortcut.href} active={idx === highlighted} onHover={() => setHighlighted(idx)} onClick={() => openResult({ kind: "nav", shortcut })}>
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Icon className="size-3.5" />
                        </span>
                        <span className="text-[13px] font-medium text-foreground">{shortcut.label}</span>
                      </ResultRow>
                    );
                  })}
                </ResultSection>
              )}
            </div>
          )}

          {leadsTotal > RESULT_LIMIT && (
            <button
              type="button"
              onClick={seeAllResults}
              className="flex w-full items-center justify-center gap-1.5 border-t border-border bg-muted/40 px-4 py-2.5 text-[11px] font-medium text-[var(--primary)] transition-colors hover:bg-muted"
            >
              See all {leadsTotal} leads matching &ldquo;{debouncedQuery}&rdquo;
              <ArrowRight className="size-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1 last:mb-0">
      <p className="px-3.5 pt-1.5 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      <ul>{children}</ul>
    </div>
  );
}

function ResultRow({
  active,
  onHover,
  onClick,
  children,
}: {
  active: boolean;
  onHover: () => void;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onMouseEnter={onHover}
        onClick={onClick}
        className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors ${active ? "bg-muted" : "hover:bg-muted/60"}`}
      >
        {children}
      </button>
    </li>
  );
}
