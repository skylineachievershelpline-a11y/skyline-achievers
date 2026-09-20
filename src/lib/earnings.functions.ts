/** Fallback money rules, used only when the admin settings row is missing. */
export const LEAD_INVESTMENT_PKR = 35;
export const JOIN_EARNING_PKR = 245;

/** Current rates, editable by the admin. */
export async function loadRates(): Promise<{ lead: number; join: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("earning_rates")
    .select("lead_investment_pkr, join_earning_pkr")
    .eq("id", "default")
    .maybeSingle();
  return {
    lead: Number(data?.lead_investment_pkr ?? LEAD_INVESTMENT_PKR),
    join: Number(data?.join_earning_pkr ?? JOIN_EARNING_PKR),
  };
}

