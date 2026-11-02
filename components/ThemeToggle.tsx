"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "soma-theme";

function currentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  function toggle(): void {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing etc: theme still applies for this visit.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="btn btn-small theme-toggle"
      onClick={toggle}
      aria-pressed={theme === "dark"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="none">
        {theme === "dark" ? (
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="8" cy="8" r="3.2" />
            <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
          </g>
        ) : (
          <path
            d="M13.2 9.6A5.8 5.8 0 0 1 6.4 2.8 5.8 5.8 0 1 0 13.2 9.6Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
