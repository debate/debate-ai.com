import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import {
  ServiceLoginError,
  allServiceLoginStatuses,
  isServiceId,
  resetServiceSessions,
  serviceLoginSecret,
  serviceLoginStatus,
  serviceSession,
} from "@/lib/service-logins";
import { deleteServiceLogin, saveServiceCredentials } from "@/lib/service-logins/store";

/**
 * The admin page's Service logins section (admins only): the Tabroom and
 * openCaselist accounts the site signs its requests in as. Passwords and
 * session tokens are stored encrypted and never sent back; responses carry
 * only each service's status (`ServiceLoginStatus`).
 *
 * GET                                       — `{ services }`.
 * POST { service, username, password }      — saves the login and signs in now.
 * POST { service, action: "signin" }        — signs in again with the saved login.
 * DELETE ?service=tabroom|opencaselist      — forgets the login (the env secret, if any, takes over).
 */

const MAX_FIELD = 320;
const noStore = { "Cache-Control": "no-store" };

async function adminAccess() {
  const { isAdmin, email } = await getAdminAccess();
  return isAdmin ? { email } : null;
}

export async function GET() {
  if (!(await adminAccess())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const db = await getDBFromContext();
  return NextResponse.json({ services: await allServiceLoginStatuses(db) }, { headers: noStore });
}

export async function POST(request: Request) {
  const access = await adminAccess();
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const service = body?.service;
  if (!isServiceId(service)) return NextResponse.json({ error: 'service must be "tabroom" or "opencaselist".' }, { status: 400 });
  const db = await getDBFromContext();

  if (body?.action !== "signin") {
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!username || !password) return NextResponse.json({ error: "Enter the username and the password." }, { status: 400 });
    if (username.length > MAX_FIELD || password.length > MAX_FIELD) {
      return NextResponse.json({ error: "The username or password is too long." }, { status: 400 });
    }
    await saveServiceCredentials(db, service, { username, password }, serviceLoginSecret(), access.email);
  }

  resetServiceSessions(service);
  let error: string | null = null;
  try {
    await serviceSession(service).signIn();
  } catch (caught) {
    error = caught instanceof ServiceLoginError ? caught.message : "The login failed.";
  }
  const status = await serviceLoginStatus(db, service);
  return NextResponse.json({ ok: !error, error, status }, { status: error ? 502 : 200, headers: noStore });
}

export async function DELETE(request: Request) {
  if (!(await adminAccess())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = new URL(request.url).searchParams.get("service");
  if (!isServiceId(service)) return NextResponse.json({ error: 'service must be "tabroom" or "opencaselist".' }, { status: 400 });
  const db = await getDBFromContext();
  await deleteServiceLogin(db, service);
  resetServiceSessions(service);
  return NextResponse.json({ ok: true, status: await serviceLoginStatus(db, service) }, { headers: noStore });
}
