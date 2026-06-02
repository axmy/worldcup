import { ChangePasswordCard } from "@/components/ChangePasswordCard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("brand_name, brand_tagline")
    .eq("id", 1)
    .single();

  return (
    <ChangePasswordCard
      brandName={data?.brand_name ?? "Kickoff"}
      brandTagline={data?.brand_tagline ?? "WC26 · Predictor"}
    />
  );
}
