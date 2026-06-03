import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const userId = await getUserId(supabase);
  redirect(userId ? "/matches" : "/login");
}
