import { NextRequest, NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import {
  addAdminChannel,
  deleteAdminChannel,
  editAdminChannel,
  type AddChannelInput,
  type EditChannelInput,
} from "@/lib/youtube/admin-channel-writes";
import { listAdminChannels, type AdminChannelPage } from "@/lib/youtube/admin-channels";

/** Keyset-paginated list of every subscribed YouTube channel, newest first. */
export async function GET(req: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDBFromContext();
  const { searchParams } = new URL(req.url);
  const page: AdminChannelPage = await listAdminChannels(db, {
    cursor: searchParams.get("cursor"),
    limit: Number(searchParams.get("limit")) || undefined,
  });

  return NextResponse.json(page);
}

/** Adds one YouTube channel to the subscribed list. */
export async function POST(req: Request) {
  const { isAdmin, email } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let input: AddChannelInput;
  try {
    input = (await req.json()) as AddChannelInput;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const db = await getDBFromContext();
  const { channel, error } = await addAdminChannel(db, input, email);
  if (error) {
    return NextResponse.json({ error }, { status: 409 });
  }
  return NextResponse.json({ channel }, { status: 201 });
}

/** Edits a channel — rename it, toggle it on/off, or both. */
export async function PATCH(req: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Channel id is required." }, { status: 400 });
  }

  let input: EditChannelInput;
  try {
    input = (await req.json()) as EditChannelInput;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const db = await getDBFromContext();
  const { channel, error } = await editAdminChannel(db, id, input);
  if (error) {
    return NextResponse.json({ error }, { status: 409 });
  }
  return NextResponse.json({ channel });
}

/** Removes a channel from the subscribed list. */
export async function DELETE(req: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Channel id is required." }, { status: 400 });
  }

  const db = await getDBFromContext();
  const { deleted, error } = await deleteAdminChannel(db, id);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  return NextResponse.json({ deleted });
}