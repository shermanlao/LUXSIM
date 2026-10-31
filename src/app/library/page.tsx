import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LibraryClient } from "@/components/LibraryClient";

export default async function LibraryPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <LibraryClient />;
}
