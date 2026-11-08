import { Component, type ReactNode } from "react";

// Catches render crashes, shows a recovery screen, and reports to
// POST /api/client-errors (Sentry-forwarded server-side when configured).
interface State {
  crashed: boolean;
  message: string;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { crashed: false, message: "" };

  static getDerivedStateFromError(err: unknown): State {
    return { crashed: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: unknown, info: { componentStack?: string }): void {
    fetch("/api/client-errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        url: window.location.pathname,
        componentStack: info.componentStack?.slice(0, 500),
      }),
    }).catch(() => {});
  }

  render(): ReactNode {
    if (!this.state.crashed) return this.props.children;
    return (
      <div className="mx-auto mt-20 max-w-md rounded-lg border border-line bg-card p-8 text-center">
        <h1 className="text-xl font-bold">Something broke on this screen</h1>
        <p className="mono mt-2 text-muted">{this.state.message.slice(0, 160)}</p>
        <p className="mt-2 text-sm text-muted">
          The error was reported. Your queued offline work is safe.
        </p>
        <button
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}
