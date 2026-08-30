import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost";

const styles: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold hover:brightness-110 active:brightness-95",
  ghost:
    "border border-[var(--border)] text-[var(--fg)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] px-5 text-sm transition-[filter,color,border-color] duration-[var(--duration-fast)] disabled:pointer-events-none disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
