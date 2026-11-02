import { notFound } from "next/navigation";
import RecipeDetail from "@/components/RecipeDetail";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function RecipePage({ params }: { params: { id: string } }) {
  const recipe = getStore().get(params.id);
  if (!recipe) notFound();
  return <RecipeDetail recipe={recipe} />;
}
