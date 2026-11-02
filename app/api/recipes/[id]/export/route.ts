import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";

interface Params {
  params: { id: string };
}

/** Download the recipe's original Markdown source. */
export async function GET(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  const recipe = await (await getStore()).get(params.id);
  if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  return new NextResponse(recipe.sourceMarkdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${recipe.id}.md"`,
    },
  });
}
