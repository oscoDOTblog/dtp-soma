"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Markdown from "./Markdown";
import type { Recipe } from "@/lib/recipes";

interface IngredientRow {
  name: string;
  quantity: string;
  unit: string;
  note: string;
}

interface Issue {
  field: string;
  message: string;
}

function splitBody(body: string): { instructions: string; notes: string } {
  const notesMatch = body.match(/^##\s+Notes\s*$/m);
  const instructionsMatch = body.match(/^##\s+Instructions\s*$/m);
  if (!instructionsMatch) return { instructions: body.trim(), notes: "" };
  const start = instructionsMatch.index! + instructionsMatch[0].length;
  const end = notesMatch && notesMatch.index! > start ? notesMatch.index! : body.length;
  const instructions = body.slice(start, end).trim();
  let notes = "";
  if (notesMatch) notes = body.slice(notesMatch.index! + notesMatch[0].length).trim();
  return { instructions, notes };
}

function toRows(recipe: Recipe | null): IngredientRow[] {
  if (!recipe || recipe.ingredients.length === 0) return [{ name: "", quantity: "", unit: "", note: "" }];
  return recipe.ingredients.map((ing) => ({
    name: ing.name,
    quantity: ing.quantity === null ? "" : String(ing.quantity),
    unit: ing.unit ?? "",
    note: ing.note ?? "",
  }));
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function buildMarkdown(state: {
  id: string;
  title: string;
  description: string;
  tags: string;
  categories: string;
  image: string;
  prep: string;
  cook: string;
  servings: string;
  favorite: boolean;
  rows: IngredientRow[];
  instructions: string;
  notes: string;
}): string {
  const tags = state.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const categories = state.categories.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
  const lines = ["---"];
  if (state.id.trim()) lines.push(`id: ${state.id.trim()}`);
  lines.push(`title: ${quote(state.title.trim())}`);
  if (state.description.trim()) lines.push(`description: ${quote(state.description.trim())}`);
  if (tags.length > 0) {
    lines.push("tags:");
    for (const t of tags) lines.push(`  - ${t}`);
  }
  if (categories.length > 0) {
    lines.push("categories:");
    for (const c of categories) lines.push(`  - ${c}`);
  }
  if (state.image.trim()) lines.push(`image: ${quote(state.image.trim())}`);
  if (state.prep.trim()) lines.push(`prepMinutes: ${Number(state.prep)}`);
  if (state.cook.trim()) lines.push(`cookMinutes: ${Number(state.cook)}`);
  lines.push(`servings: ${Number(state.servings) || 2}`);
  lines.push(`favorite: ${state.favorite}`);
  const rows = state.rows.filter((r) => r.name.trim());
  if (rows.length > 0) {
    lines.push("ingredients:");
    for (const row of rows) {
      lines.push(`  - name: ${quote(row.name.trim())}`);
      if (row.quantity.trim() !== "" && !Number.isNaN(Number(row.quantity))) {
        lines.push(`    quantity: ${Number(row.quantity)}`);
      }
      if (row.unit.trim()) lines.push(`    unit: ${quote(row.unit.trim())}`);
      if (row.note.trim()) lines.push(`    note: ${quote(row.note.trim())}`);
    }
  }
  lines.push("---", "");
  lines.push(`# ${state.title.trim() || "Untitled"}`, "");
  lines.push("## Instructions", "");
  lines.push(state.instructions.trim() || "1. ", "");
  if (state.notes.trim()) {
    lines.push("## Notes", "");
    lines.push(state.notes.trim(), "");
  }
  return lines.join("\n");
}

export default function RecipeEditor({ recipe }: { recipe: Recipe | null }) {
  const router = useRouter();
  const isEdit = recipe !== null;
  const [mode, setMode] = useState<"guided" | "markdown">("guided");
  const [showPreview, setShowPreview] = useState(false);

  const initialBody = splitBody(recipe?.bodyMarkdown ?? "");
  const [id, setId] = useState(recipe?.id ?? "");
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [tags, setTags] = useState(recipe?.tags.join(", ") ?? "");
  const [categories, setCategories] = useState(recipe?.categories.join(", ") ?? "");
  const [image, setImage] = useState(recipe?.image ?? "");
  const [prep, setPrep] = useState(recipe?.prepMinutes === null || recipe?.prepMinutes === undefined ? "" : String(recipe.prepMinutes));
  const [cook, setCook] = useState(recipe?.cookMinutes === null || recipe?.cookMinutes === undefined ? "" : String(recipe.cookMinutes));
  const [servings, setServings] = useState(String(recipe?.servings ?? 2));
  const [favorite, setFavorite] = useState(recipe?.favorite ?? false);
  const [rows, setRows] = useState<IngredientRow[]>(toRows(recipe));
  const [instructions, setInstructions] = useState(initialBody.instructions);
  const [notes, setNotes] = useState(initialBody.notes);
  const [markdown, setMarkdown] = useState(recipe?.sourceMarkdown ?? "");

  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function guidedMarkdown(): string {
    return buildMarkdown({ id, title, description, tags, categories, image, prep, cook, servings, favorite, rows, instructions, notes });
  }

  const previewSource = mode === "guided" ? guidedMarkdown() : markdown;

  function updateRow(index: number, patch: Partial<IngredientRow>): void {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function save(): Promise<void> {
    setSaving(true);
    setIssues([]);
    setError(null);
    const body = mode === "guided" ? guidedMarkdown() : markdown;
    try {
      const res = await fetch(isEdit ? `/api/recipes/${recipe!.id}` : "/api/recipes", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: body }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 422) {
        setIssues((data?.issues as Issue[] | undefined) ?? []);
        setError(data?.error ?? "Recipe Markdown is invalid.");
        return;
      }
      if (!res.ok) {
        setError(data?.error ?? "Could not save the recipe.");
        return;
      }
      router.push(`/recipes/${(data.recipe as Recipe).id}`);
    } catch {
      setError("Could not save the recipe. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function loadFile(file: File): Promise<void> {
    setMarkdown(await file.text());
    setMode("markdown");
  }

  return (
    <div>
      <h1 className="page-title">{isEdit ? `Edit ${recipe!.title}` : "Add a recipe"}</h1>
      <p className="page-sub">
        Fill in the guided fields or paste Markdown with YAML frontmatter. Either way, the recipe is stored as Markdown.
      </p>

      <div className="editor-tabs" role="tablist" aria-label="Editing mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "guided"}
          className="btn btn-small"
          onClick={() => setMode("guided")}
        >
          Guided
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "markdown"}
          className="btn btn-small"
          onClick={() => setMode("markdown")}
        >
          Markdown
        </button>
        <button
          type="button"
          className="btn btn-small btn-quiet"
          aria-pressed={showPreview}
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? "Hide preview" : "Show preview"}
        </button>
      </div>

      {mode === "markdown" ? (
        <div className={showPreview ? "editor-grid" : undefined}>
          <div>
            <div className="field">
              <label htmlFor="markdown-source">Recipe Markdown</label>
              <textarea
                id="markdown-source"
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                rows={24}
                spellCheck={false}
                placeholder={"---\ntitle: Kimchi Fried Rice\nservings: 2\n---\n\n# Kimchi Fried Rice\n\n## Instructions\n\n1. ...\n"}
              />
              <span className="hint">Or upload a .md file to fill this in.</span>
            </div>
            <div className="toolbar-row">
              <label className="btn btn-small" htmlFor="markdown-file">
                Upload .md
              </label>
              <input
                id="markdown-file"
                type="file"
                accept=".md,.markdown,.txt"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void loadFile(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          {showPreview && (
            <div className="panel">
              <h2>Preview</h2>
              <Markdown source={markdown} />
            </div>
          )}
        </div>
      ) : (
        <div className={showPreview ? "editor-grid" : undefined}>
          <div>
            <div className="field">
              <label htmlFor="f-title">Title</label>
              <input id="f-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="f-desc">Short description</label>
              <input id="f-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="editor-grid">
              <div className="field">
                <label htmlFor="f-tags">Tags, comma separated</label>
                <input id="f-tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="korean, quick, dinner" />
              </div>
              <div className="field">
                <label htmlFor="f-cats">Categories, comma separated</label>
                <input id="f-cats" type="text" value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="dinner" />
              </div>
            </div>
            <div className="editor-grid">
              <div className="field">
                <label htmlFor="f-serv">Servings</label>
                <input id="f-serv" type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="f-prep">Prep minutes</label>
                <input id="f-prep" type="number" min={0} value={prep} onChange={(e) => setPrep(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="f-cook">Cook minutes</label>
                <input id="f-cook" type="number" min={0} value={cook} onChange={(e) => setCook(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="f-image">Image URL (optional)</label>
                <input id="f-image" type="text" value={image} onChange={(e) => setImage(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>
                <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} /> Favorite
              </label>
            </div>

            <div className="field">
              <label id="ingredients-label">Ingredients</label>
              <div role="group" aria-labelledby="ingredients-label">
                {rows.map((row, index) => (
                  <div key={index} className="ingredient-row">
                    <input
                      type="text"
                      placeholder="Name"
                      aria-label={`Ingredient ${index + 1} name`}
                      value={row.name}
                      onChange={(e) => updateRow(index, { name: e.target.value })}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Qty"
                      aria-label={`Ingredient ${index + 1} quantity`}
                      value={row.quantity}
                      onChange={(e) => updateRow(index, { quantity: e.target.value })}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        type="text"
                        placeholder="Unit"
                        aria-label={`Ingredient ${index + 1} unit`}
                        value={row.unit}
                        onChange={(e) => updateRow(index, { unit: e.target.value })}
                      />
                      <button
                        type="button"
                        className="btn btn-small btn-quiet"
                        aria-label={`Remove ingredient ${index + 1}`}
                        onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Note (optional, e.g. sliced)"
                      aria-label={`Ingredient ${index + 1} note`}
                      value={row.note}
                      onChange={(e) => updateRow(index, { note: e.target.value })}
                      style={{ gridColumn: "1 / -1" }}
                    />
                  </div>
                ))}
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => setRows((prev) => [...prev, { name: "", quantity: "", unit: "", note: "" }])}
                >
                  Add ingredient
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="f-instructions">Instructions (Markdown)</label>
              <textarea id="f-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={8} />
            </div>
            <div className="field">
              <label htmlFor="f-notes">Cooking notes (Markdown, optional)</label>
              <textarea id="f-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
            </div>
          </div>
          {showPreview && (
            <div className="panel">
              <h2>Preview</h2>
              <Markdown source={previewSource} />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="issue-list" role="alert">
          <b>{error}</b>
          {issues.length > 0 && (
            <ul>
              {issues.map((issue) => (
                <li key={issue.field}>
                  <b>{issue.field}</b>: {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="toolbar-row" style={{ marginTop: "1rem" }}>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Save recipe"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </div>
  );
}
