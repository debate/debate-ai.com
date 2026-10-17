import { getDB } from "@/lib/database";
import { user, account } from "@/lib/database/schema";
import { eq } from "drizzle-orm";

async function verify() {
  const db = await getDB();
  const u = await db.select().from(user).where(eq(user.email, "demo@debate-ai.com")).get();
  const a = await db.select().from(account).where(eq(account.userId, "demo-user-id")).get();
  console.log("User:", u);
  console.log("Account:", a);
}

verify().catch(console.error);