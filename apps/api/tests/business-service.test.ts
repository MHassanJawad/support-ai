import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), single: vi.fn(), from: vi.fn(), getUser: vi.fn() }));
vi.mock("../src/config/supabase", () => ({ supabaseAdmin: {
  rpc: mocks.rpc, from: mocks.from, auth: { admin: { getUserById: mocks.getUser } }
} }));
import { createBusiness, getProfile } from "../src/services/business-service";
const input = { name: "Harbor Books", industry: "Retail", address: "24 Market Street" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockReturnValue({ single: mocks.single });
  mocks.single.mockResolvedValue({ data: { id: "business", ...input }, error: null });
});
describe("atomic business onboarding", () => {
  it("uses a single database transaction and requests a single workspace", async () => {
    expect(await createBusiness(input, "owner")).toEqual({ id: "business", ...input });
    expect(mocks.rpc).toHaveBeenCalledWith("create_business_workspace", {
      owner_id: "owner", business_name: input.name, business_industry: input.industry, business_address: input.address
    });
    expect(mocks.single).toHaveBeenCalledOnce();
  });
  it("explains the missing migration without claiming setup succeeded", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(createBusiness(input, "owner")).rejects.toThrow("migration 003");
  });
  it("creates a workspace from valid business registration metadata", async () => {
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) });
    mocks.getUser.mockResolvedValue({ data: { user: { user_metadata: {
      account_type: "business", company_name: input.name, company_industry: input.industry, company_address: input.address
    } } }, error: null });
    const profile = await getProfile("owner");
    expect(profile.memberships[0]?.role).toBe("owner");
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
  it("does not create a workspace for a customer", async () => {
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) });
    mocks.getUser.mockResolvedValue({ data: { user: { user_metadata: { account_type: "customer" } } }, error: null });
    expect((await getProfile("customer")).memberships).toEqual([]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
