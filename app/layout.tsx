import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soma — Personal Recipe Library",
  description: "Save, organize, find, and cook recipes from Markdown.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
