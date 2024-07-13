
import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { userFileIndex } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET({ params }) {
  const fileIndexes = await db.select().from(userFileIndex).where(eq(userFileIndex.userId, params.userId));
  return json(fileIndexes.map(index => index.fileId));
}

export async function PUT({ params, request }) {
  const { action, fileId } = await request.json();
  if (action === 'add') {
    await db.insert(userFileIndex).values({ userId: params.userId, fileId }).onConflictDoNothing();
  } else if (action === 'remove') {
    await db.delete(userFileIndex)
      .where(eq(userFileIndex.userId, params.userId))
      .where(eq(userFileIndex.fileId, fileId));
  }
  const updatedFileIndexes = await db.select().from(userFileIndex).where(eq(userFileIndex.userId, params.userId));
  return json(updatedFileIndexes.map(index => index.fileId));
}