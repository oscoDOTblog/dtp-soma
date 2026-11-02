import matter from "gray-matter";

/** One structured ingredient line. */
export interface Ingredient {
  /** Display name, e.g. "day-old cooked rice". */
  name: string;
  /** Normalized name used for search and future pantry matching. */
  canonical: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
}

/** A recipe as stored and exchanged by the app. */
export interface Recipe {
  id: string;
  title: string;
  description: string;
  tags: string[];
  categories: string[];
  image: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number;
  ingredients: Ingredient[];
  /** Markdown body below the frontmatter (instructions, notes, ...). */
  bodyMarkdown: string;
  /** Original full Markdown source, frontmatter included. */
  sourceMarkdown: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastCookedAt: string | null;
}

export type RecipeInput = Omit<Recipe, "id" | "createdAt" | "updatedAt" | "lastCookedAt"> & {
  id?: string;
};

/** Field-level problem found while parsing or validating recipe Markdown. */
export interface RecipeIssue {
  field: string;
  message: string;
}

export class RecipeParseError extends Error {
  issues: RecipeIssue[];
  constructor(issues: RecipeIssue[]) {
    super(issues.map((i) => `${i.field}: ${i.message}`).join("; "));
    this.name = "RecipeParseError";
    this.issues = issues;
  }
}

/** Conservative synonym map so pantry-adjacent names resolve together later. */
const SYNONYMS: Record<string, string> = {
  "green onions": "green onion",
  "spring onions": "green onion",
  "scallions": "green onion",
  "spring onion": "green onion",
  "green onion": "green onion",
  "cherry tomatoes": "cherry tomato",
  "roma tomatoes": "tomato",
  "red onion": "onion",
  "yellow onion": "onion",
  "white onion": "onion",
  "sweet onion": "onion",
  "red pepper": "bell pepper",
  "green pepper": "bell pepper",
  "yellow pepper": "bell pepper",
  "capsicum": "bell pepper",
  "coriander leaves": "cilantro",
  "coriander": "cilantro",
  "chickpeas": "chickpea",
  "garbanzo beans": "chickpea",
  "garbanzo bean": "chickpea",
  "all-purpose flour": "flour",
  "plain flour": "flour",
  "granulated sugar": "sugar",
  "brown rice": "rice",
  "white rice": "rice",
  "jasmine rice": "rice",
  "basmati rice": "rice",
  "extra virgin olive oil": "olive oil",
  "evoo": "olive oil",
  "sea salt": "salt",
  "kosher salt": "salt",
  "black pepper": "pepper",
  "ground black pepper": "pepper",
  "spring water": "water",
  "unsalted butter": "butter",
  "russet potatoes": "potato",
  "yukon gold potatoes": "potato",
  "sweet potatoes": "sweet potato",
  "cloves garlic": "garlic",
  "garlic cloves": "garlic",
};

/**
 * Conservative canonicalization: lowercase, collapse whitespace, strip
 * punctuation, resolve a small synonym map. Anything unknown passes through
 * in normalized form so future pantry matching still has a stable key.
 */
export function canonicalizeIngredientName(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .replace(/[._/#!?$%^&*;:{}=\-`~()\[\]"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  if (SYNONYMS[normalized]) return SYNONYMS[normalized];
  // Conservative singularization for simple plurals only.
  if (normalized.endsWith("ies") && normalized.length > 4) {
    const singular = normalized.slice(0, -3) + "y";
    return SYNONYMS[singular] ?? singular;
  }
  if (normalized.endsWith("es") && normalized.length > 4) {
    const singular = normalized.slice(0, -2);
    if (SYNONYMS[singular]) return SYNONYMS[singular];
  }
  if (normalized.endsWith("s") && !normalized.endsWith("ss") && normalized.length > 3) {
    const singular = normalized.slice(0, -1);
    if (SYNONYMS[singular]) return SYNONYMS[singular];
    return singular;
  }
  return normalized;
}

export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return slug || "untitled-recipe";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((v) => typeof v === "string")) return null;
  return (value as string[]).map((s) => s.trim()).filter(Boolean);
}

function toOptionalNonNegativeInt(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "invalid";
  return Math.round(value);
}

/**
 * Parse recipe Markdown with YAML frontmatter (see plan section 3) into a
 * RecipeInput. Throws RecipeParseError listing every problem found.
 */
function isFrontmatterLike(line: string): boolean {
  const text = line.trim();
  return text === "" || text.startsWith("- ") || text.includes(":");
}

/**
 * AI agents often wrap the answer in code fences, add a line of intro text,
 * or close the frontmatter with `***` instead of `---`. Normalize those
 * shapes so a correct-looking recipe imports first try. A `***` line is only
 * treated as the close when everything above it looks like frontmatter, so a
 * horizontal rule in the method body is left alone.
 */
function normalizeAgentMarkdown(source: string): string {
  let text = source.replace(/^\uFEFF/, "").trim();
  const fence = text.match(/^```[\w-]*\s*\n([\s\S]*?)\n```\s*$/);
  if (fence) text = fence[1].trim();
  const lines = text.split("\n");
  if (lines[0].trim() !== "---") {
    const start = lines.findIndex((line) => line.trim() === "---");
    if (start > 0) return lines.slice(start).join("\n");
    return text;
  }
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "---") return text;
    if ((line === "***" || line === "...") && lines.slice(1, i).every(isFrontmatterLike)) {
      lines[i] = "---";
      return lines.join("\n");
    }
  }
  return text;
}

export function parseRecipeMarkdown(source: string): RecipeInput {
  const issues: RecipeIssue[] = [];
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(normalizeAgentMarkdown(source));
  } catch (error) {
    const detail = error instanceof Error ? error.message.split("\n")[0].slice(0, 160) : "";
    throw new RecipeParseError([
      {
        field: "frontmatter",
        message: detail ? `Frontmatter is not valid YAML (${detail}).` : "Frontmatter is not valid YAML.",
      },
    ]);
  }

  const data = parsed.data ?? {};
  if (!isRecord(data)) {
    throw new RecipeParseError([{ field: "frontmatter", message: "Frontmatter must be a mapping." }]);
  }

  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) issues.push({ field: "title", message: "A title is required." });

  let servings = 2;
  if (data.servings !== undefined && data.servings !== null && data.servings !== "") {
    if (typeof data.servings !== "number" || !Number.isFinite(data.servings) || data.servings <= 0) {
      issues.push({ field: "servings", message: "Servings must be a number greater than 0." });
    } else {
      servings = data.servings;
    }
  }

  const prepMinutes = toOptionalNonNegativeInt(data.prepMinutes);
  if (prepMinutes === "invalid") {
    issues.push({ field: "prepMinutes", message: "prepMinutes must be a number 0 or greater." });
  }
  const cookMinutes = toOptionalNonNegativeInt(data.cookMinutes);
  if (cookMinutes === "invalid") {
    issues.push({ field: "cookMinutes", message: "cookMinutes must be a number 0 or greater." });
  }

  let tags: string[] = [];
  if (data.tags !== undefined) {
    const t = toStringArray(data.tags);
    if (t === null) issues.push({ field: "tags", message: "Tags must be a list of strings." });
    else tags = t.map((s) => s.toLowerCase());
  }
  let categories: string[] = [];
  if (data.categories !== undefined) {
    const c = toStringArray(data.categories);
    if (c === null) issues.push({ field: "categories", message: "Categories must be a list of strings." });
    else categories = c.map((s) => s.toLowerCase());
  }

  let ingredients: Ingredient[] = [];
  if (data.ingredients !== undefined) {
    if (!Array.isArray(data.ingredients)) {
      issues.push({ field: "ingredients", message: "Ingredients must be a list." });
    } else {
      data.ingredients.forEach((raw: unknown, index: number) => {
        if (typeof raw === "string") {
          const name = raw.trim();
          if (!name) return;
          ingredients.push({ name, canonical: canonicalizeIngredientName(name), quantity: null, unit: null, note: null });
          return;
        }
        if (!isRecord(raw)) {
          issues.push({ field: `ingredients[${index}]`, message: "Each ingredient must be a name or a mapping with a name." });
          return;
        }
        const name = typeof raw.name === "string" ? raw.name.trim() : "";
        if (!name) {
          issues.push({ field: `ingredients[${index}].name`, message: "Ingredient name is required." });
          return;
        }
        let quantity: number | null = null;
        if (raw.quantity !== undefined && raw.quantity !== null && raw.quantity !== "") {
          if (typeof raw.quantity !== "number" || !Number.isFinite(raw.quantity) || raw.quantity < 0) {
            issues.push({ field: `ingredients[${index}].quantity`, message: "Quantity must be a number 0 or greater." });
          } else {
            quantity = raw.quantity;
          }
        }
        const unit = typeof raw.unit === "string" && raw.unit.trim() ? raw.unit.trim() : null;
        const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : null;
        ingredients.push({ name, canonical: canonicalizeIngredientName(name), quantity, unit, note });
      });
    }
  }

  if (issues.length > 0) throw new RecipeParseError(issues);

  const description = typeof data.description === "string" ? data.description.trim() : "";
  const image = typeof data.image === "string" && data.image.trim() ? data.image.trim() : null;
  const favorite = data.favorite === true;
  const id = typeof data.id === "string" && data.id.trim() ? data.id.trim() : slugifyTitle(title);

  return {
    id,
    title,
    description,
    tags,
    categories,
    image,
    prepMinutes: prepMinutes === "invalid" ? null : prepMinutes,
    cookMinutes: cookMinutes === "invalid" ? null : cookMinutes,
    servings,
    ingredients,
    bodyMarkdown: parsed.content.trim() + "\n",
    sourceMarkdown: source,
    favorite,
  };
}

/** Serialize a recipe back to canonical Markdown with YAML frontmatter. */
export function serializeRecipeMarkdown(recipe: RecipeInput): string {
  const lines: string[] = ["---"];
  lines.push(`id: ${recipe.id}`);
  lines.push(`title: ${JSON.stringify(recipe.title)}`);
  if (recipe.description) lines.push(`description: ${JSON.stringify(recipe.description)}`);
  if (recipe.tags.length > 0) {
    lines.push("tags:");
    for (const t of recipe.tags) lines.push(`  - ${t}`);
  }
  if (recipe.categories.length > 0) {
    lines.push("categories:");
    for (const c of recipe.categories) lines.push(`  - ${c}`);
  }
  if (recipe.image) lines.push(`image: ${JSON.stringify(recipe.image)}`);
  if (recipe.prepMinutes !== null) lines.push(`prepMinutes: ${recipe.prepMinutes}`);
  if (recipe.cookMinutes !== null) lines.push(`cookMinutes: ${recipe.cookMinutes}`);
  lines.push(`servings: ${recipe.servings}`);
  lines.push(`favorite: ${recipe.favorite}`);
  if (recipe.ingredients.length > 0) {
    lines.push("ingredients:");
    for (const ing of recipe.ingredients) {
      lines.push(`  - name: ${JSON.stringify(ing.name)}`);
      if (ing.quantity !== null) lines.push(`    quantity: ${ing.quantity}`);
      if (ing.unit) lines.push(`    unit: ${JSON.stringify(ing.unit)}`);
      if (ing.note) lines.push(`    note: ${JSON.stringify(ing.note)}`);
    }
  }
  lines.push("---");
  lines.push("");
  lines.push(recipe.bodyMarkdown.trimEnd() + "\n");
  return lines.join("\n");
}

/** Format a scaled quantity without noisy floating-point tails. */
export function formatQuantity(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Scale structured ingredient quantities to a target serving count.
 * Free-form Markdown text is never rewritten — only numeric quantities.
 */
export function scaleIngredients(ingredients: Ingredient[], baseServings: number, targetServings: number): Ingredient[] {
  if (baseServings <= 0 || targetServings <= 0) return ingredients;
  const factor = targetServings / baseServings;
  return ingredients.map((ing) => ({
    ...ing,
    quantity: ing.quantity === null ? null : Math.round(ing.quantity * factor * 100) / 100,
  }));
}

export function totalMinutes(recipe: Pick<Recipe, "prepMinutes" | "cookMinutes">): number | null {
  if (recipe.prepMinutes === null && recipe.cookMinutes === null) return null;
  return (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
}

/** Case-insensitive match across title, tags, categories, and ingredients. */
export function matchesQuery(recipe: Pick<Recipe, "title" | "tags" | "categories" | "ingredients">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (recipe.title.toLowerCase().includes(q)) return true;
  if (recipe.tags.some((t) => t.toLowerCase().includes(q))) return true;
  if (recipe.categories.some((c) => c.toLowerCase().includes(q))) return true;
  return recipe.ingredients.some(
    (ing) => ing.name.toLowerCase().includes(q) || ing.canonical.toLowerCase().includes(q),
  );
}
