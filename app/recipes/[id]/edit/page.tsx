import { notFound } from "next/navigation";
import RecipeEditor from "@/components/RecipeEditor";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function EditRecipePage({ params }: { params: { id: string } }) {
  const recipe = getStore().get(params.id);
  if (!recipe) notFound();
  return <RecipeEditor recipe={recipe} />;
}
