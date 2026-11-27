import { getDBFromContext } from "@/lib/database/context";
import { adminOnly, forbidden, json } from "@/lib/env-manager/http";
import { listAudit } from "@/lib/env-manager/store";

/** Admin → Environment audit log (admins only): who changed which variable names, never values. */
export async function GET() {
  if (!(await adminOnly())) return forbidden();
  return json({ entries: await listAudit(await getDBFromContext()) });
}
