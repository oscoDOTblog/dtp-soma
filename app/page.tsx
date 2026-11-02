import LibraryClient from "@/components/LibraryClient";
import { getStore } from "@/lib/store";
import { seedDatabase } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default function HomePage() {
  try {
    seedDatabase();
  } catch {
    // First-run seeding is best-effort; the page renders whatever exists.
  }
  const initial = getStore().list();
  return <LibraryClient initial={initial} />;
}
