import ImportPrompt from "@/components/ImportPrompt";
import RecipeEditor from "@/components/RecipeEditor";

export const dynamic = "force-dynamic";

export default function NewRecipePage() {
  return (
    <>
      <ImportPrompt />
      <RecipeEditor recipe={null} />
    </>
  );
}
