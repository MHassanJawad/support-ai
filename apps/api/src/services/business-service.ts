import { createBusinessSchema, type CreateBusinessInput } from "@supportai/shared";
import { supabaseAdmin } from "../config/supabase";
import { AppError, NotFoundError } from "../errors/app-error";

export async function createBusiness(input: CreateBusinessInput, userId: string) {
  const { data, error } = await supabaseAdmin.rpc("create_business_workspace", {
    owner_id: userId, business_name: input.name, business_industry: input.industry, business_address: input.address
  }).single();
  if (error) {
    throw new AppError("DATABASE_ERROR", error.code === "PGRST202"
      ? "Workspace setup needs database migration 003. Ask the administrator to apply it."
      : "Could not create your workspace. Please retry.", 500);
  }
  return data;
}

export async function getProfile(userId: string) {
  const { data, error } = await supabaseAdmin.from("business_members")
    .select("role, businesses(id, name, industry, address, created_at)")
    .eq("user_id", userId).order("created_at", { ascending: true });
  if (error) throw new AppError("DATABASE_ERROR", "Could not load profile.", 500);
  if (!data.length) {
    const { data: account, error: accountError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (accountError) throw new AppError("DATABASE_ERROR", "Could not load account details.", 503);
    const metadata = account.user?.user_metadata;
    if (metadata?.account_type === "business") {
      const input = createBusinessSchema.safeParse({
        name: metadata.company_name, industry: metadata.company_industry, address: metadata.company_address
      });
      if (input.success) {
        const business = await createBusiness(input.data, userId);
        return { userId, memberships: [{ role: "owner", businesses: business }] };
      }
    }
  }
  return { userId, memberships: data };
}

export function requireBusinessId(businessId?: string): string {
  if (!businessId) throw new NotFoundError("Create or join a business before using this endpoint.");
  return businessId;
}
