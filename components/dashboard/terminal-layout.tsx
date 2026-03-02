"use client";

import { useState } from "react";
import { PanelRightOpen, X } from "lucide-react";

interface TerminalLayoutProps {
  main: React.ReactNode;
  sidebar: React.ReactNode;
}

export function TerminalLayout({ main, sidebar }: TerminalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">{main}</div>

      <aside className="hidden lg:flex w-[380px] flex-col border-l">
        {sidebar}
      </aside>

      <button
        className="fixed bottom-4 right-4 z-40 rounded-lg bg-accent p-3 shadow-sm lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <PanelRightOpen className="h-5 w-5" />
      </button>

      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-lg border-t bg-card lg:hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-medium">Activity & Analytics</span>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto">{sidebar}</div>
          </div>
        </>
      )}
    </div>
  );
}
