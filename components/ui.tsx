import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg ${className}`}>
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold",
  secondary: "bg-slate-700 hover:bg-slate-600 text-slate-100",
  danger: "bg-rose-600 hover:bg-rose-500 text-white",
  ghost: "bg-transparent hover:bg-slate-800 text-slate-200 border border-slate-700",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warning" | "danger" | "success" }) {
  const tones: Record<string, string> = {
    default: "bg-slate-800 text-slate-200",
    warning: "bg-amber-500/20 text-amber-300",
    danger: "bg-rose-500/20 text-rose-300",
    success: "bg-emerald-500/20 text-emerald-300",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function StatTile({ label, value, tone = "default" }: { label: string; value: ReactNode; tone?: "default" | "warning" | "danger" | "success" }) {
  const tones: Record<string, string> = {
    default: "text-slate-100",
    warning: "text-amber-300",
    danger: "text-rose-400",
    success: "text-emerald-300",
  };
  return (
    <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-lg font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  );
}

export function formatMoney(value: number): string {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
}

export function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
