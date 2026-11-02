import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { Ingredient, Recipe, RecipeInput, slugifyTitle } from "./recipes";

/**
 * Storage boundary for recipes. SQLite is the local source of truth; a
 * future MongoDB adapter implements this same interface without changing
 * the UI contract.
 */
export interface RecipeStore {
  list(): Recipe[];
  get(id: string): Recipe | null;
  create(input: RecipeInput): Recipe;
  update(id: string, input: RecipeInput): Recipe | null;
  remove(id: string): boolean;
  setFavorite(id: string, favorite: boolean): Recipe | null;
  markCooked(id: string): Recipe | null;
  ensureUniqueId(base: string): string;
}

interface Row {
  id: string;
  title: string;
  description: string;
  tags: string;
  categories: string;
  image: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number;
  ingredients: string;
  body_markdown: string;
  source_markdown: string;
  favorite: number;
  created_at: string;
  updated_at: string;
  last_cooked_at: string | null;
}

function rowToRecipe(row: Row): Recipe {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: JSON.parse(row.tags) as string[],
    categories: JSON.parse(row.categories) as string[],
    image: row.image,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    servings: row.servings,
    ingredients: JSON.parse(row.ingredients) as Ingredient[],
    bodyMarkdown: row.body_markdown,
    sourceMarkdown: row.source_markdown,
    favorite: row.favorite === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastCookedAt: row.last_cooked_at,
  };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  categories TEXT NOT NULL DEFAULT '[]',
  image TEXT,
  prep_minutes INTEGER,
  cook_minutes INTEGER,
  servings REAL NOT NULL DEFAULT 2,
  ingredients TEXT NOT NULL DEFAULT '[]',
  body_markdown TEXT NOT NULL DEFAULT '',
  source_markdown TEXT NOT NULL DEFAULT '',
  favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_cooked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_recipes_favorite ON recipes (favorite);
CREATE INDEX IF NOT EXISTS idx_recipes_updated ON recipes (updated_at DESC);
`;

let db: Database.Database | null = null;

export function dbPath(): string {
  return process.env.RECIPES_DB_PATH ?? path.join(process.cwd(), "data", "recipes.db");
}

export function getDb(): Database.Database {
  if (db) return db;
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.exec(SCHEMA);
  return db;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class SqliteRecipeStore implements RecipeStore {
  private database: Database.Database;

  constructor(database?: Database.Database) {
    this.database = database ?? getDb();
  }

  list(): Recipe[] {
    const rows = this.database
      .prepare("SELECT * FROM recipes ORDER BY favorite DESC, updated_at DESC")
      .all() as Row[];
    return rows.map(rowToRecipe);
  }

  get(id: string): Recipe | null {
    const row = this.database.prepare("SELECT * FROM recipes WHERE id = ?").get(id) as Row | undefined;
    return row ? rowToRecipe(row) : null;
  }

  ensureUniqueId(base: string): string {
    let candidate = base || "untitled-recipe";
    let n = 2;
    while (this.get(candidate)) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    return candidate;
  }

  create(input: RecipeInput): Recipe {
    const id = this.ensureUniqueId(input.id?.trim() || slugifyTitle(input.title));
    const now = nowIso();
    this.database
      .prepare(
        `INSERT INTO recipes
         (id, title, description, tags, categories, image, prep_minutes, cook_minutes,
          servings, ingredients, body_markdown, source_markdown, favorite, created_at, updated_at, last_cooked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run(
        id,
        input.title,
        input.description,
        JSON.stringify(input.tags),
        JSON.stringify(input.categories),
        input.image,
        input.prepMinutes,
        input.cookMinutes,
        input.servings,
        JSON.stringify(input.ingredients),
        input.bodyMarkdown,
        input.sourceMarkdown,
        input.favorite ? 1 : 0,
        now,
        now,
      );
    const created = this.get(id);
    if (!created) throw new Error("Failed to read back created recipe.");
    return created;
  }

  update(id: string, input: RecipeInput): Recipe | null {
    const existing = this.get(id);
    if (!existing) return null;
    this.database
      .prepare(
        `UPDATE recipes SET
           title = ?, description = ?, tags = ?, categories = ?, image = ?,
           prep_minutes = ?, cook_minutes = ?, servings = ?, ingredients = ?,
           body_markdown = ?, source_markdown = ?, favorite = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.title,
        input.description,
        JSON.stringify(input.tags),
        JSON.stringify(input.categories),
        input.image,
        input.prepMinutes,
        input.cookMinutes,
        input.servings,
        JSON.stringify(input.ingredients),
        input.bodyMarkdown,
        input.sourceMarkdown,
        input.favorite ? 1 : 0,
        nowIso(),
        id,
      );
    return this.get(id);
  }

  remove(id: string): boolean {
    const result = this.database.prepare("DELETE FROM recipes WHERE id = ?").run(id);
    return result.changes > 0;
  }

  setFavorite(id: string, favorite: boolean): Recipe | null {
    const existing = this.get(id);
    if (!existing) return null;
    this.database
      .prepare("UPDATE recipes SET favorite = ?, updated_at = ? WHERE id = ?")
      .run(favorite ? 1 : 0, nowIso(), id);
    return this.get(id);
  }

  markCooked(id: string): Recipe | null {
    const existing = this.get(id);
    if (!existing) return null;
    const now = nowIso();
    this.database
      .prepare("UPDATE recipes SET last_cooked_at = ?, updated_at = ? WHERE id = ?")
      .run(now, now, id);
    return this.get(id);
  }
}

let store: RecipeStore | null = null;

/** Application-wide store singleton (override in tests via setStore). */
export function getStore(): RecipeStore {
  if (!store) store = new SqliteRecipeStore();
  return store;
}

export function setStore(next: RecipeStore | null): void {
  store = next;
}
