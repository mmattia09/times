import { Badge } from "@/components/ui/badge";
import type { Dictionary } from "@/lib/i18n";

/** Owner / Admin / User — the three roles, coloured by how much they can do. */
export function RoleBadge({
  isOwner,
  isAdmin,
  dict,
}: {
  isOwner: boolean;
  isAdmin: boolean;
  dict: Dictionary;
}) {
  if (isOwner) return <Badge variant="success">{dict.admin.roleOwner}</Badge>;
  if (isAdmin) return <Badge>{dict.admin.roleAdmin}</Badge>;
  return <Badge variant="muted">{dict.admin.roleUser}</Badge>;
}
