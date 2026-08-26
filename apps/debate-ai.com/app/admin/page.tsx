import type { Metadata } from "next";
import { getAdminAccess } from "@/lib/auth/admin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  const { isAdmin, email } = await getAdminAccess();

  if (!isAdmin) {
    return (
      <main className="mx-auto flex max-w-lg flex-col items-center gap-2 px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-muted-foreground">
          {email
            ? `${email} is not authorized to view this page.`
            : "Sign in with an authorized account to view this page."}
        </p>
      </main>
    );
  }

  return <AdminDashboard />;
}
