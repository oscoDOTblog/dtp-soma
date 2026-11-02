import { NextRequest, NextResponse } from "next/server";
import { RecipeParseError, parseRecipeMarkdown } from "@/lib/recipes";
import { getStore } from "@/lib/store";

interface Params {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  const recipe = getStore().get(params.id);
  if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  return NextResponse.json({ recipe });
}

export async function PUT(request: NextRequest, { params }: Params): Promise<NextResponse> {
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
    const recipe = getStore().update(params.id, { ...input, sourceMarkdown: markdown });
    if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
    return NextResponse.json({ recipe });
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

export async function DELETE(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  const removed = getStore().remove(params.id);
  if (!removed) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
