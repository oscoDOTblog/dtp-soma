"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Recipe } from "@/lib/recipes";
import { LibrarySkeleton } from "./Skeletons";

type SortKey = "recent" | "title" | "quick";

function minutesLabel(recipe: Recipe): string | null {
  const total = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  if (recipe.prepMinutes === null && recipe.cookMinutes === null) return null;
  return `${total} min`;
}

export default function LibraryClient({ initial }: { initial: Recipe[] }) {
  const [recipes, setRecipes] = useState<Recipe[]>(initial);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("recent");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (activeTag) params.set("tag", activeTag);
    if (favoritesOnly) params.set("favorite", "true");
    params.set("sort", sort);
    setLoading(true);
    setError(null);
    fetch(`/api/recipes?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Library request failed (${res.status}).`);
        const data = await res.json();
        setRecipes(data.recipes);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load recipes."))
      .finally(() => setLoading(false));
  }, [query, activeTag, favoritesOnly, sort]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const recipe of initial) {
      for (const tag of recipe.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [initial]);

  const favorites = initial.filter((r) => r.favorite).length;
  const quick = initial.filter((r) => {
    if (r.prepMinutes === null && r.cookMinutes === null) return false;
    return (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) <= 30;
  }).length;

  async function toggleFavorite(recipe: Recipe): Promise<void> {
    const res = await fetch(`/api/recipes/${recipe.id}/favorite`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !recipe.favorite }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const updated = data.recipe as Recipe;
    setRecipes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  async function importFile(file: File): Promise<void> {
    setImportError(null);
    const markdown = await file.text();
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const issues = data?.issues as { field: string; message: string }[] | undefined;
      setImportError(
        issues && issues.length > 0
          ? `Could not import ${file.name}: ${issues.map((i) => `${i.field} — ${i.message}`).join("; ")}`
          : `Could not import ${file.name}.`,
      );
      return;
    }
    const data = await res.json();
    const created = data.recipe as Recipe;
    setRecipes((prev) => [created, ...prev]);
  }

  return (
    <div>
      <div className="masthead">
        <h1 className="page-title">My Kitchen</h1>
        <p className="page-sub">Every recipe you have saved, searchable by title, tag, or ingredient.</p>
      </div>
      <div className="stats-strip" aria-label="Library totals">
        <div className="stat">
          <b>{initial.length}</b>
          <span>Saved recipes</span>
        </div>
        <div className="stat">
          <b>{favorites}</b>
          <span>Favorites</span>
        </div>
        <div className="stat">
          <b>{quick}</b>
          <span>Ready in 30 min or less</span>
        </div>
      </div>

      <div className="library-toolbar">
        <input
          className="search-input"
          type="search"
          placeholder="Search recipes or ingredients…"
          aria-label="Search recipes or ingredients"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="toolbar-row">
          <button
            type="button"
            className="chip"
            aria-pressed={favoritesOnly}
            onClick={() => setFavoritesOnly((v) => !v)}
          >
            Favorites
          </button>
          <select aria-label="Sort recipes" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="recent">Recently updated</option>
            <option value="title">Title A–Z</option>
            <option value="quick">Quickest first</option>
          </select>
          <button type="button" className="btn btn-small" onClick={() => fileRef.current?.click()}>
            Import .md
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.txt"
            hidden
            aria-hidden={false}
            aria-label="Import a Markdown recipe file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {tags.length > 0 && (
        <div className="toolbar-row" role="group" aria-label="Filter by tag">
          {activeTag && (
            <button type="button" className="chip" aria-pressed={false} onClick={() => setActiveTag(null)}>
              Clear
            </button>
          )}
          {tags.map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              className="chip"
              aria-pressed={activeTag === tag}
              onClick={() => setActiveTag((cur) => (cur === tag ? null : tag))}
            >
              {tag} ({count})
            </button>
          ))}
        </div>
      )}

      {importError && (
        <p className="error-text" role="alert">
          {importError}
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {loading && recipes.length === 0 && <LibrarySkeleton />}
      {loading && recipes.length > 0 && (
        <p className="refresh-note" aria-live="polite">
          Updating recipes…
        </p>
      )}

      {!loading && !error && recipes.length === 0 && (
        <div className="notice">
          <h2>No recipes found</h2>
          {initial.length === 0 ? (
            <>
              <p>Your library is empty. Add your first recipe to get started.</p>
              <p>
                <Link className="btn btn-primary btn-small" href="/recipes/new">
                  Add a recipe
                </Link>
              </p>
            </>
          ) : (
            <p>Nothing matches this search. Try a different word or clear the filters.</p>
          )}
        </div>
      )}

      {recipes.length > 0 && (
      <ul className="recipe-grid">
        {recipes.map((recipe) => {
          const time = minutesLabel(recipe);
          const meta = [time, ...recipe.categories.slice(0, 2)].filter(Boolean).join(", ");
          return (
            <li key={recipe.id} className="recipe-card">
              <h3>
                <Link href={`/recipes/${recipe.id}`}>{recipe.title}</Link>
              </h3>
              {meta && <div className="card-meta">{meta}</div>}
              {recipe.description && <div className="card-meta">{recipe.description}</div>}
              {recipe.tags.length > 0 && (
                <div className="card-tags">
                  {recipe.tags.slice(0, 5).map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="card-foot">
                {recipe.favorite && <span className="stamp">Favorite</span>}
                <button
                  type="button"
                  className="btn btn-small btn-quiet"
                  aria-pressed={recipe.favorite}
                  aria-label={recipe.favorite ? `Remove ${recipe.title} from favorites` : `Save ${recipe.title} to favorites`}
                  onClick={() => void toggleFavorite(recipe)}
                >
                  {recipe.favorite ? "Favorited" : "Favorite"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      )}
    </div>
  );
}
