
import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { files } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const allFiles = await db.select().from(files);
  return json(allFiles);
}

export async function POST({ request }) {
  const { title, content, users } = await request.json();
  const newFile = {
    id: crypto.randomUUID(),
    title,
    content,
    users: JSON.stringify(users),
    lastUpdated: new Date()
  };
  await db.insert(files).values(newFile);
  return json(newFile, { status: 201 });
}