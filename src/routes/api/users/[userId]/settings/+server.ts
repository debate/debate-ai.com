
import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { userSettings } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET({ params }) {
  const settings = await db.select().from(userSettings).where(eq(userSettings.userId, params.userId)).get();
  if (!settings) {
    return json({}, { status: 200 });
  }
  return json(JSON.parse(settings.settings));
}

export async function PUT({ params, request }) {
  const newSettings = await request.json();
  await db.insert(userSettings)
    .values({ userId: params.userId, settings: JSON.stringify(newSettings) })
    .onConflictDoUpdate({ target: userSettings.userId, set: { settings: JSON.stringify(newSettings) } });
  return json(newSettings);
}
