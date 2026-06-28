import type { ReactNode } from "react";

import { requireAdminPage } from "@/lib/admin/permissions";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage("dataops.view");
  return children;
}
