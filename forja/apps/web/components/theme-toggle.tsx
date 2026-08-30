"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-11 w-24" aria-hidden />;

  const isDark = theme !== "light";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="superficie flex h-11 items-center gap-2 px-4 text-sm text-[var(--fg)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--accent)]"
    >
      {isDark ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
      {isDark ? "Modo claro" : "Modo oscuro"}
    </button>
  );
}
