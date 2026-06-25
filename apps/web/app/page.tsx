import { redirect } from "next/navigation";
import { getSession } from "@/lib/current-user";

export default async function Home() {
  const session = await getSession();
  redirect(session?.user ? "/dashboard" : "/login");
}
