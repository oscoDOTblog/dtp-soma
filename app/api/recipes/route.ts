import { NextRequest, NextResponse } from "next/server";
import { RecipeParseError, parseRecipeMarkdown } from "@/lib/recipes";
import { getStore } from "@/lib/store";
import { seedDatabase } from "@/lib/seed";

async function ensureSeeded(): Promise<void> {
  try {
    await seedDatabase();
  } catch {
    // A seeding failure must not take the API down; the library
    // simply renders whatever is already stored.
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  await ensureSeeded();
  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const tag = (params.get("tag") ?? "").trim().toLowerCase();
  const category = (params.get("category") ?? "").trim().toLowerCase();
  const favoritesOnly = params.get("favorite") === "true";
  const sort = params.get("sort") ?? "recent";

  let recipes = await (await getStore()).list();

  if (favoritesOnly) recipes = recipes.filter((r) => r.favorite);
  if (tag) recipes = recipes.filter((r) => r.tags.includes(tag));
  if (category) recipes = recipes.filter((r) => r.categories.includes(category));
  if (q) {
    recipes = recipes.filter((r) => {
      if (r.title.toLowerCase().includes(q)) return true;
      if (r.tags.some((t) => t.includes(q))) return true;
      if (r.categories.some((c) => c.includes(q))) return true;
      return r.ingredients.some(
        (ing) => ing.name.toLowerCase().includes(q) || ing.canonical.includes(q),
      );
    });
  }

  if (sort === "title") {
    recipes = [...recipes].sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === "quick") {
    const time = (r: (typeof recipes)[number]) =>
      (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
    recipes = [...recipes].sort((a, b) => time(a) - time(b));
  }

  return NextResponse.json({ recipes });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  await ensureSeeded();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const markdown =
    typeof body === "object" && body !== null && "markdown" in body
      ? (body as { markdown: unknown }).markdown
      : undefined;
  if (typeof markdown !== "string" || !markdown.trim()) {
    return NextResponse.json(
      { error: "Provide recipe Markdown in the `markdown` field." },
      { status: 400 },
    );
  }
  try {
    const input = parseRecipeMarkdown(markdown);
    const recipe = await (await getStore()).create({ ...input, sourceMarkdown: markdown });
    return NextResponse.json({ recipe }, { status: 201 });
  } catch (error) {
    if (error instanceof RecipeParseError) {
      return NextResponse.json(
        { error: "Recipe Markdown is invalid.", issues: error.issues },
        { status: 422 },
      );
    }
    throw error;
  }
}
