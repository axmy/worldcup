import { redirect } from "next/navigation";

// Standings moved into per-league pages (/leagues). Keep this path working.
export default function LeaderboardPage() {
  redirect("/leagues");
}
