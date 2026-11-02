"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Markdown from "./Markdown";
import { Recipe, formatQuantity, scaleIngredients, totalMinutes } from "@/lib/recipes";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function RecipeDetail({ recipe: initial }: { recipe: Recipe }) {
  const router = useRouter();
  const [recipe, setRecipe] = useState(initial);
  const [servings, setServings] = useState(initial.servings);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [cookMode, setCookMode] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const scaled = useMemo(
    () => scaleIngredients(recipe.ingredients, recipe.servings, servings),
    [recipe.ingredients, recipe.servings, servings],
  );
  const total = totalMinutes(recipe);
  const cookedOn = formatDate(recipe.lastCookedAt);

  function toggleChecked(index: number): void {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function toggleFavorite(): Promise<void> {
    setActionError(null);
    const res = await fetch(`/api/recipes/${recipe.id}/favorite`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !recipe.favorite }),
    });
    if (!res.ok) {
      setActionError("Could not update the favorite status.");
      return;
    }
    const data = await res.json();
    setRecipe(data.recipe as Recipe);
  }

  async function markCooked(): Promise<void> {
    setActionError(null);
    const res = await fetch(`/api/recipes/${recipe.id}/cook`, { method: "POST" });
    if (!res.ok) {
      setActionError("Could not record this cook.");
      return;
    }
    const data = await res.json();
    setRecipe(data.recipe as Recipe);
  }

  async function removeRecipe(): Promise<void> {
    if (!window.confirm(`Delete "${recipe.title}"? This cannot be undone.`)) return;
    setActionError(null);
    const res = await fetch(`/api/recipes/${recipe.id}`, { method: "DELETE" });
    if (!res.ok) {
      setActionError("Could not delete the recipe.");
      return;
    }
    router.push("/");
  }

  return (
    <div>
      <div className="recipe-head">
        <div>
          <h1 className="page-title">
            {recipe.title}
            {cookedOn && <span className="cooked-note">Cooked {cookedOn}</span>}
          </h1>
          <p className="page-sub">
            {[
              total !== null ? `${total} min total` : null,
              `Serves ${recipe.servings}`,
              ...recipe.categories,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          {recipe.tags.length > 0 && (
            <div className="card-tags" style={{ marginTop: "0.6rem" }}>
              {recipe.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="recipe-actions">
          <button type="button" className="btn btn-small btn-primary" onClick={() => setCookMode(true)}>
            Cook mode
          </button>
          <button
            type="button"
            className="btn btn-small"
            aria-pressed={recipe.favorite}
            onClick={() => void toggleFavorite()}
          >
            {recipe.favorite ? "★ Favorited" : "☆ Favorite"}
          </button>
          <button type="button" className="btn btn-small" onClick={() => void markCooked()}>
            Mark cooked
          </button>
          <Link className="btn btn-small" href={`/recipes/${recipe.id}/edit`}>
            Edit
          </Link>
          <a className="btn btn-small" href={`/api/recipes/${recipe.id}/export`} download>
            Export .md
          </a>
          <button type="button" className="btn btn-small btn-danger" onClick={() => void removeRecipe()}>
            Delete
          </button>
        </div>
      </div>

      {actionError && (
        <p className="error-text" role="alert">
          {actionError}
        </p>
      )}

      {recipe.description && <p style={{ maxWidth: "68ch" }}>{recipe.description}</p>}

      <div className="detail-grid">
        <section className="panel" aria-labelledby="ingredients-heading">
          <h2 id="ingredients-heading">Ingredients</h2>
          <div className="serving-stepper">
            <button
              type="button"
              className="btn btn-small"
              aria-label="Decrease servings"
              disabled={servings <= 1}
              onClick={() => setServings((s) => Math.max(1, s - 1))}
            >
              −
            </button>
            <b aria-live="polite">{servings}</b>
            <span>servings</span>
            <button
              type="button"
              className="btn btn-small"
              aria-label="Increase servings"
              onClick={() => setServings((s) => Math.min(24, s + 1))}
            >
              +
            </button>
          </div>
          {scaled.length === 0 ? (
            <p className="card-meta">No structured ingredients yet. Edit the recipe to add them.</p>
          ) : (
            <ul className="checklist">
              {scaled.map((ing, index) => (
                <li key={`${ing.canonical}-${index}`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked.has(index)}
                      onChange={() => toggleChecked(index)}
                      aria-label={`Check off ${ing.name}`}
                    />
                    <span className={checked.has(index) ? "done" : undefined}>
                      {ing.quantity !== null && <b>{formatQuantity(ing.quantity)} </b>}
                      {ing.unit && <span>{ing.unit} </span>}
                      {ing.name}
                      {ing.note && <span className="card-meta"> ({ing.note})</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {checked.size > 0 && (
            <p>
              <button type="button" className="btn btn-small btn-quiet" onClick={() => setChecked(new Set())}>
                Clear {checked.size} checked
              </button>
            </p>
          )}
        </section>

        <section aria-labelledby="method-heading">
          <div className="panel">
            <h2 id="method-heading">Method and notes</h2>
            <Markdown source={recipe.bodyMarkdown} />
          </div>
        </section>
      </div>

      {cookMode && (
        <div className="cookmode" role="dialog" aria-modal="true" aria-label={`Cooking mode for ${recipe.title}`}>
          <div className="cookmode-inner">
            <div className="cookmode-bar">
              <button type="button" className="btn" onClick={() => setCookMode(false)} autoFocus>
                ← Back to recipe
              </button>
              <span className="cookmode-step">
                Serves {servings}
                {total !== null ? `, about ${total} minutes` : ""}
              </span>
            </div>
            <h2>{recipe.title}</h2>
            {scaled.length > 0 && (
              <>
                <h3 style={{ fontFamily: "var(--serif)" }}>Gather</h3>
                <ul className="checklist">
                  {scaled.map((ing, index) => (
                    <li key={`cook-${ing.canonical}-${index}`}>
                      <label style={{ color: "#f4f1ea" }}>
                        <input
                          type="checkbox"
                          checked={checked.has(index)}
                          onChange={() => toggleChecked(index)}
                          aria-label={`Check off ${ing.name}`}
                        />
                        <span className={checked.has(index) ? "done" : undefined} style={checked.has(index) ? { color: "#b8b0a1" } : undefined}>
                          {ing.quantity !== null && <b>{formatQuantity(ing.quantity)} </b>}
                          {ing.unit && <span>{ing.unit} </span>}
                          {ing.name}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Markdown source={recipe.bodyMarkdown} />
            <div className="cookmode-bar" style={{ marginTop: "2rem" }}>
              <button type="button" className="btn" onClick={() => void markCooked()}>
                Mark cooked
              </button>
              <button type="button" className="btn" onClick={() => setCookMode(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
