import { getDB } from "@/lib/database";
import { user, account } from "@/lib/database/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function seedDemoUser() {
  const demoEmail = "demo@debate-ai.com";
  const demoPassword = "demo";
  const demoName = "Demo User";
  const demoId = "demo-user-id";

  const db = await getDB();

  // Check if user already exists
  const existingUser = await db.select().from(user).where(eq(user.email, demoEmail)).get();
  
  if (existingUser) {
    console.log("Demo user already exists");
    return;
  }

  const passwordHash = await hashPassword(demoPassword);
  const now = new Date();

  // Insert user
  await db.insert(user).values({
    id: demoId,
    name: demoName,
    email: demoEmail,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
    isAnonymous: false,
  }).run();

  // Insert account with credential provider
  await db.insert(account).values({
    id: `account-${demoId}`,
    accountId: demoId,
    providerId: "credential",
    userId: demoId,
    password: passwordHash,
    createdAt: now,
    updatedAt: now,
  }).run();

  console.log("Demo user created successfully");
}

seedDemoUser().catch(console.error);