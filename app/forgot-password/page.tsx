import { ForgotPasswordCard } from "@/components/ForgotPasswordCard";
import { getSettingsCached } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const settings = await getSettingsCached();
  return (
    <ForgotPasswordCard
      brandName={settings?.brand_name ?? "Kickoff"}
      brandTagline={settings?.brand_tagline ?? "WC26 · Predictor"}
    />
  );
}
