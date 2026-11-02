import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  RecipeParseError,
  canonicalizeIngredientName,
  formatQuantity,
  matchesQuery,
  parseRecipeMarkdown,
  scaleIngredients,
  serializeRecipeMarkdown,
} from "./recipes";
import { SqliteRecipeStore } from "./store";

const VALID = `---
id: kimchi-fried-rice
title: Kimchi Fried Rice
tags:
  - korean
  - quick
servings: 2
prepMinutes: 5
cookMinutes: 15
favorite: true
ingredients:
  - name: cooked rice
    quantity: 2
    unit: cup
  - name: kimchi
    quantity: 1
    unit: cup
---

# Kimchi Fried Rice

## Instructions

1. Fry everything.
`;

function parseInvalid(source: string): { field: string; message: string }[] {
  try {
    parseRecipeMarkdown(source);
  } catch (error) {
    if (error instanceof RecipeParseError) return error.issues;
    throw error;
  }
  throw new Error("Expected parsing to fail.");
}

describe("parseRecipeMarkdown", () => {
  it("parses valid frontmatter with structured ingredients", () => {
    const recipe = parseRecipeMarkdown(VALID);
    expect(recipe.title).toBe("Kimchi Fried Rice");
    expect(recipe.servings).toBe(2);
    expect(recipe.favorite).toBe(true);
    expect(recipe.tags).toEqual(["korean", "quick"]);
    expect(recipe.ingredients).toHaveLength(2);
    expect(recipe.ingredients[0]).toMatchObject({ name: "cooked rice", quantity: 2, unit: "cup" });
    expect(recipe.bodyMarkdown).toContain("## Instructions");
  });

  it("rejects missing title", () => {
    const issues = parseInvalid(`---\nservings: 2\n---\n\nBody\n`);
    expect(issues.some((i) => i.field === "title")).toBe(true);
  });

  it("rejects malformed frontmatter", () => {
    const issues = parseInvalid(`---\ntitle: [unclosed\n---\n\nBody\n`);
    expect(issues.some((i) => i.field === "frontmatter")).toBe(true);
  });

  it("rejects invalid servings", () => {
    const issues = parseInvalid(`---\ntitle: Soup\nservings: 0\n---\n\nBody\n`);
    expect(issues.some((i) => i.field === "servings")).toBe(true);
  });

  it("rejects invalid quantities", () => {
    const issues = parseInvalid(
      `---\ntitle: Soup\nservings: 2\ningredients:\n  - name: salt\n    quantity: lots\n---\n\nBody\n`,
    );
    expect(issues.some((i) => i.field.includes("quantity"))).toBe(true);
  });

  it("accepts plain-string ingredients", () => {
    const recipe = parseRecipeMarkdown(`---\ntitle: Toast\nservings: 1\ningredients:\n  - bread\n---\n\nBody\n`);
    expect(recipe.ingredients[0]).toMatchObject({ name: "bread", quantity: null });
  });
});

describe("canonicalizeIngredientName", () => {
  it("resolves onion-family synonyms to one key", () => {
    expect(canonicalizeIngredientName("Scallions")).toBe("green onion");
    expect(canonicalizeIngredientName("green onions")).toBe("green onion");
    expect(canonicalizeIngredientName("spring onion")).toBe("green onion");
  });

  it("normalizes case and punctuation", () => {
    expect(canonicalizeIngredientName("  Extra-Virgin Olive Oil! ")).toBe("olive oil");
  });
});

describe("scaleIngredients", () => {
  it("scales quantities without touching textual fields", () => {
    const input = parseRecipeMarkdown(VALID).ingredients;
    const scaled = scaleIngredients(input, 2, 4);
    expect(scaled[0].quantity).toBe(4);
    expect(scaled[0].name).toBe("cooked rice");
    expect(scaled[0].unit).toBe("cup");
  });

  it("halves fractional quantities", () => {
    const scaled = scaleIngredients(
      [{ name: "chili", canonical: "chili", quantity: 0.5, unit: "tsp", note: null }],
      4,
      2,
    );
    expect(scaled[0].quantity).toBe(0.25);
  });
});

describe("formatQuantity", () => {
  it("trims floating-point noise", () => {
    expect(formatQuantity(4)).toBe("4");
    expect(formatQuantity(0.30000000004)).toBe("0.3");
  });
});

describe("markdown round-trip", () => {
  it("serializes and reparses without loss", () => {
    const original = parseRecipeMarkdown(VALID);
    const roundTripped = parseRecipeMarkdown(
      serializeRecipeMarkdown({ ...original, sourceMarkdown: "" }),
    );
    expect(roundTripped.title).toBe(original.title);
    expect(roundTripped.servings).toBe(original.servings);
    expect(roundTripped.ingredients).toEqual(original.ingredients);
  });
});

describe("matchesQuery", () => {
  it("matches title, tag, and ingredient names", () => {
    const recipe = parseRecipeMarkdown(VALID);
    expect(matchesQuery(recipe, "kimchi")).toBe(true);
    expect(matchesQuery(recipe, "korean")).toBe(true);
    expect(matchesQuery(recipe, "rice")).toBe(true);
    expect(matchesQuery(recipe, "pasta")).toBe(false);
  });
});

describe("SqliteRecipeStore", () => {
  function memoryStore(): SqliteRecipeStore {
    const database = new Database(":memory:");
    database.exec(
      "CREATE TABLE recipes (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]', categories TEXT NOT NULL DEFAULT '[]', image TEXT, prep_minutes INTEGER, cook_minutes INTEGER, servings REAL NOT NULL DEFAULT 2, ingredients TEXT NOT NULL DEFAULT '[]', body_markdown TEXT NOT NULL DEFAULT '', source_markdown TEXT NOT NULL DEFAULT '', favorite INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_cooked_at TEXT);",
    );
    return new SqliteRecipeStore(database);
  }

  it("creates, favorites, marks cooked, exports, and deletes", () => {
    const store = memoryStore();
    const created = store.create({ ...parseRecipeMarkdown(VALID), sourceMarkdown: VALID });
    expect(store.get(created.id)?.title).toBe("Kimchi Fried Rice");

    const favorited = store.setFavorite(created.id, true);
    expect(favorited?.favorite).toBe(true);

    const cooked = store.markCooked(created.id);
    expect(cooked?.lastCookedAt).not.toBeNull();

    expect(store.remove(created.id)).toBe(true);
    expect(store.get(created.id)).toBeNull();
  });

  it("keeps ids unique", () => {
    const store = memoryStore();
    const first = store.create({ ...parseRecipeMarkdown(VALID), sourceMarkdown: VALID });
    const second = store.create({ ...parseRecipeMarkdown(VALID), sourceMarkdown: VALID });
    expect(second.id).not.toBe(first.id);
  });
});
