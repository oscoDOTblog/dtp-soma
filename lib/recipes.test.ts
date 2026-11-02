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
import { InMemoryRecipeStore, collectionName, devProdCollections, resolveAppEnv } from "./store";

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

describe("parseRecipeMarkdown agent-paste tolerance", () => {
  const BODY = `# Soup\n\n## Instructions\n\n1. Heat it.\n`;

  function frontmatter(close: string): string {
    return `---\ntitle: Soup\nservings: 2\n${close}\n\n${BODY}`;
  }

  it("accepts *** as the closing delimiter", () => {
    const recipe = parseRecipeMarkdown(frontmatter("***"));
    expect(recipe.title).toBe("Soup");
    expect(recipe.servings).toBe(2);
  });

  it("accepts ... as the closing delimiter", () => {
    const recipe = parseRecipeMarkdown(frontmatter("..."));
    expect(recipe.title).toBe("Soup");
  });

  it("strips code fences around the recipe", () => {
    const recipe = parseRecipeMarkdown(`\`\`\`markdown\n${frontmatter("---")}\n\`\`\``);
    expect(recipe.title).toBe("Soup");
  });

  it("skips intro text before the opening delimiter", () => {
    const recipe = parseRecipeMarkdown(`Here is your reformatted recipe:\n\n${frontmatter("---")}`);
    expect(recipe.title).toBe("Soup");
  });

  it("does not mistake a body horizontal rule for a close", () => {
    const recipe = parseRecipeMarkdown(`${frontmatter("---")}\n***\n`);
    expect(recipe.title).toBe("Soup");
    expect(recipe.bodyMarkdown).toContain("***");
  });

  it("reports the parser detail for invalid YAML", () => {
    const issues = parseInvalid(`---\ntitle: Pasta: Quick Dinner\nservings: 2\n---\n\nBody\n`);
    expect(issues.some((i) => i.field === "frontmatter" && i.message.includes("line 2"))).toBe(true);
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

describe("InMemoryRecipeStore", () => {
  it("creates, favorites, marks cooked, exports, and deletes", async () => {
    const store = new InMemoryRecipeStore();
    const created = await store.create({ ...parseRecipeMarkdown(VALID), sourceMarkdown: VALID });
    expect((await store.get(created.id))?.title).toBe("Kimchi Fried Rice");

    const favorited = await store.setFavorite(created.id, true);
    expect(favorited?.favorite).toBe(true);

    const cooked = await store.markCooked(created.id);
    expect(cooked?.lastCookedAt).not.toBeNull();

    expect(await store.remove(created.id)).toBe(true);
    expect(await store.get(created.id)).toBeNull();
  });

  it("keeps ids unique", async () => {
    const store = new InMemoryRecipeStore();
    const first = await store.create({ ...parseRecipeMarkdown(VALID), sourceMarkdown: VALID });
    const second = await store.create({ ...parseRecipeMarkdown(VALID), sourceMarkdown: VALID });
    expect(second.id).not.toBe(first.id);
  });
});

describe("dev/prod collections", () => {
  it("resolves the environment from APP_ENV first, then NODE_ENV", () => {
    const env = process.env as Record<string, string | undefined>;
    const prevApp = env.APP_ENV;
    const prevNode = env.NODE_ENV;
    try {
      env.APP_ENV = "prod";
      env.NODE_ENV = "development";
      expect(resolveAppEnv()).toBe("prod");
      expect(collectionName()).toBe("soma_prod_recipes");

      env.APP_ENV = "dev";
      expect(resolveAppEnv()).toBe("dev");
      expect(collectionName()).toBe("soma_dev_recipes");

      delete env.APP_ENV;
      env.NODE_ENV = "production";
      expect(resolveAppEnv()).toBe("prod");
    } finally {
      if (prevApp === undefined) delete env.APP_ENV;
      else env.APP_ENV = prevApp;
      if (prevNode === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = prevNode;
    }
  });

  it("names separate dev and prod collections", () => {
    const prev = process.env.MONGODB_COLLECTION;
    try {
      delete process.env.MONGODB_COLLECTION;
      expect(devProdCollections()).toEqual({ dev: "soma_dev_recipes", prod: "soma_prod_recipes" });
    } finally {
      if (prev === undefined) delete process.env.MONGODB_COLLECTION;
      else process.env.MONGODB_COLLECTION = prev;
    }
  });
});
