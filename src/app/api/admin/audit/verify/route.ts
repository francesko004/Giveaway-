import { adminRoute, jsonOk } from "@/lib/api";
import { verifyAuditChain } from "@/services/audit";

export const GET = adminRoute("VIEWER", async () => jsonOk(await verifyAuditChain()));
