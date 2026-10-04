import { Link } from "@tanstack/react-router";
import { ArrowLeft, List } from "lucide-react";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";

export function AiPageShell({ children, title, showThreads = false }: { children: ReactNode; title: string; showThreads?: boolean }) {
  return (
    <div className="cinematic-shell infographic-grid min-h-screen bg-background text-foreground">
      <header className="cinematic-nav sticky top-0 z-30 border-b border-hairline bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Button asChild variant="outline" size="icon" aria-label="Back">
            <Link to="/dashboard"><ArrowLeft /></Link>
          </Button>
          <BrandLogo size="sm" withWordmark={false} />
          <div className="min-w-0 flex-1"><p className="truncate font-display text-sm font-semibold">{title}</p><p className="text-[11px] text-muted-foreground">Private conversations</p></div>
          {showThreads ? <Button asChild variant="outline" size="icon" aria-label="All conversations"><Link to="/ai"><List /></Link></Button> : null}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
    </div>
  );
}