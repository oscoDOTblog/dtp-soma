import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";

interface Params {
  params: { id: string };
}

/** Record that the recipe was just cooked. */
export async function POST(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  const recipe = await (await getStore()).markCooked(params.id);
  if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  return NextResponse.json({ recipe });
}
