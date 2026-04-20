import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth/auth";

export default async function HomePage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/login");
  }

  redirect(session.user.role === "ADMIN" ? "/admin" : "/volunteer");
}
