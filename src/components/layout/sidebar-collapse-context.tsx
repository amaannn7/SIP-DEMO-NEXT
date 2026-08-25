"use client";

import { createContext, useContext, useLayoutEffect, useState } from "react";

const STORAGE_KEY = "sidebar-collapsed";

const WIDTH_EXPANDED = "16rem";
const WIDTH_COLLAPSED = "4.5rem";

type SidebarCollapseContextValue = {
  collapsed: boolean;
  toggle: () => void;
  /**
   * False until the stored preference has been applied. Consumers use this to
   * suppress width/padding transitions on the very first paint, so a sidebar
   * restored as collapsed doesn't visibly animate shut on every page load.
   */
  ready: boolean;
};

const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(null);

/**
 * Owns the sidebar's collapsed/expanded state, persisted to localStorage so
 * it survives navigation and reloads. Renders a wrapper div carrying a CSS
 * variable (--sidebar-w) that both the sidebar's own width and the main
 * content's left offset read, so collapsing never causes a layout flash —
 * one variable, two consumers, updated in the same paint.
 *
 * State always starts `false` (matching what SSR renders, since there is no
 * localStorage on the server) and is then corrected in `useLayoutEffect`,
 * which fires before the browser paints. An earlier version read localStorage
 * inside the `useState` initializer to "read synchronously on first render" —
 * but hydration is a reconciliation against server-rendered HTML, not a fresh
 * mount, so the client's first-render output must still match the server's.
 * Reading localStorage there produced a client tree that already disagreed
 * with the server before hydration began, which is a hydration error, not a
 * safe optimization.
 */
export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "true") setCollapsed(true);
    } catch {
      // Private-mode / blocked storage: stay expanded for this session.
    }
    setReady(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Private-mode / blocked storage: the toggle still works for this
        // session, it just won't be remembered.
      }
      return next;
    });
  }

  return (
    <SidebarCollapseContext.Provider value={{ collapsed, toggle, ready }}>
      <div
        style={{ "--sidebar-w": collapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED } as React.CSSProperties}
        data-sidebar-collapsed={collapsed ? "true" : "false"}
      >
        {children}
      </div>
    </SidebarCollapseContext.Provider>
  );
}

export function useSidebarCollapse(): SidebarCollapseContextValue {
  const ctx = useContext(SidebarCollapseContext);
  if (!ctx) throw new Error("useSidebarCollapse must be used within SidebarCollapseProvider");
  return ctx;
}
