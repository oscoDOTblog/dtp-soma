import LibraryClient from "@/components/LibraryClient";
import { getStore } from "@/lib/store";
import { seedDatabase } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    await seedDatabase();
  } catch {
    // First-run seeding is best-effort; the page renders whatever exists.
  }
  const initial = await (await getStore()).list();
  return <LibraryClient initial={initial} />;
}
