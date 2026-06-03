import { ResetPasswordCard } from "@/components/ResetPasswordCard";
import { getSettingsCached } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const settings = await getSettingsCached();
  return (
    <ResetPasswordCard
      brandName={settings?.brand_name ?? "Kickoff"}
      brandTagline={settings?.brand_tagline ?? "WC26 · Predictor"}
    />
  );
}
