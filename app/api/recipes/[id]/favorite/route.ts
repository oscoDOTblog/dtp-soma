import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";

interface Params {
  params: { id: string };
}

/** Toggle favorite without resubmitting the whole recipe. */
export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const favorite =
    typeof body === "object" && body !== null && "favorite" in body
      ? (body as { favorite: unknown }).favorite
      : undefined;
  if (typeof favorite !== "boolean") {
    return NextResponse.json({ error: "Provide a boolean `favorite` field." }, { status: 400 });
  }
  const recipe = await (await getStore()).setFavorite(params.id, favorite);
  if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  return NextResponse.json({ recipe });
}
