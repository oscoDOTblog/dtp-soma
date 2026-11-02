import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("soma-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Soma — Personal Recipe Library",
  description: "Save, organize, find, and cook recipes from Markdown.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link className="brand" href="/">
              Soma<span>.</span>
            </Link>
            <nav className="site-nav" aria-label="Primary">
              <ThemeToggle />
              <Link className="btn btn-small" href="/">
                Library
              </Link>
              <Link className="btn btn-small btn-primary" href="/recipes/new">
                Add recipe
              </Link>
            </nav>
          </div>
        </header>
        <main id="content">{children}</main>
      </body>
    </html>
  );
}
