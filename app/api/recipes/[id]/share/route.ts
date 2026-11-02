import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidRecipient, sendRecipeShare } from "@/lib/share";

interface Params {
  params: { id: string };
}

/** Email this recipe to someone via coss.com. */
export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const email =
    typeof body === "object" && body !== null && "email" in body
      ? (body as { email: unknown }).email
      : undefined;
  if (!isValidRecipient(email)) {
    return NextResponse.json({ error: "Provide a valid `email` address." }, { status: 422 });
  }
  const recipe = await (await getStore()).get(params.id);
  if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  const result = await sendRecipeShare(recipe, email.trim());
  if (!result.ok) {
    const status = result.message.startsWith("Email is not set up") ? 503 : 502;
    return NextResponse.json({ error: result.message }, { status });
  }
  return NextResponse.json({ ok: true, message: result.message });
}
