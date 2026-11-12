import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/users");
  if (!session.user.isSiteAdmin) redirect("/projects");

  return (
    <div className="admin-shell mx-auto max-w-7xl px-4 py-8">
      <AdminNav />
      <div className="admin-main min-w-0">{children}</div>
    </div>
  );
}
