import { AuthCard } from "@/components/AuthCard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("brand_name, brand_tagline, login_headline, login_subtitle")
    .eq("id", 1)
    .single();

  return (
    <AuthCard
      mode="register"
      brandName={data?.brand_name ?? "Kickoff"}
      brandTagline={data?.brand_tagline ?? "WC26 · Predictor"}
      heroHeadline={data?.login_headline ?? "Call the scoreline. Own the board."}
      heroSubtitle={data?.login_subtitle ?? undefined}
    />
  );
}
