import { getT } from "@/lib/i18n/server";

// The workouts index is a client component, so its title lives here. Repeating
// the root template keeps "%s · Times" on /workouts/new and /workouts/[id]/edit:
// a bare string here would replace the template those children inherit.
export async function generateMetadata() {
  const { t } = await getT();
  return { title: { default: t("workouts.title"), template: "%s · Times" } };
}

export default function WorkoutsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
