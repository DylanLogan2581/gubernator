import { GitFork } from "lucide-react";
import { type JSX } from "react";

export function AppFooter(): JSX.Element {
  return (
    <footer className="py-6">
      <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-4 text-sm shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center text-muted-foreground sm:flex-row sm:justify-between">
          <p>
            &copy; 2026{" "}
            <a
              href="https://github.com/DylanLogan2581"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Dylan Logan
            </a>{" "}
            | A Munduscraft Application
          </p>
          <a
            href="https://github.com/DylanLogan2581/gubernator"
            target="_blank"
            rel="noreferrer"
            aria-label="Gubernator on GitHub"
            className="hover:text-foreground transition-colors"
          >
            <GitFork className="size-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
