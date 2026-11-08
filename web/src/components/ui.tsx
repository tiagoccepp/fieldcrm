// Minimal shadcn/ui-idiom components (button/input/dialog/table/badge/card).
// Same API names as shadcn/ui; vendored minimal set, no CLI dependency.
import { type ReactNode, useEffect, useRef } from "react";

export function Button({
  children,
  variant = "solid",
  ...rest
}: {
  children: ReactNode;
  variant?: "solid" | "outline" | "ghost" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = {
    solid: "bg-accent text-white hover:brightness-110",
    outline: "border border-line bg-card hover:bg-paper",
    ghost: "hover:bg-paper",
    danger: "bg-bad text-white hover:brightness-110",
  } as const;
  return (
    <button className={`${base} ${styles[variant]}`} {...rest}>
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm placeholder:text-muted/70"
      {...props}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-line bg-card shadow-sm ${className}`}>{children}</div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad" | "info";
}) {
  const tones = {
    neutral: "bg-paper text-muted border-line",
    ok: "bg-ok/10 text-ok border-ok/30",
    warn: "bg-warn/10 text-warn border-warn/30",
    bad: "bg-bad/10 text-bad border-bad/30",
    info: "bg-side/10 text-side border-side/20",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector("input")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-side/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div ref={ref} className="w-full max-w-md rounded-lg border border-line bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded px-2 py-1 text-muted hover:bg-paper">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-line p-6 text-center text-muted">{children}</p>;
}
