import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn(), remove: vi.fn(), embed: vi.fn(), chunkInsert: vi.fn(), statusUpdate: vi.fn(), cleanup: vi.fn() }));
vi.mock("../src/config/env", () => ({ env: { SUPABASE_STORAGE_BUCKET: "knowledge-base" } }));
vi.mock("../src/config/supabase", () => ({ supabaseAdmin: { from: mocks.from, storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) } } }));
vi.mock("../src/services/ai-provider", () => ({ aiProvider: { embed: mocks.embed } }));
import { uploadAndProcessDocument, deleteDocument } from "../src/services/document-service";

const file = { originalname: "policy.txt", mimetype: "text/plain", size: 30, buffer: Buffer.from("Refunds are available for 14 days.") } as Express.Multer.File;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.embed.mockResolvedValue(Array(768).fill(0.1));
  mocks.chunkInsert.mockResolvedValue({ error: null });
  mocks.from.mockImplementation((table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["eq", "select"]) chain[method] = vi.fn(() => chain);
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve);
    chain.insert = table === "document_chunks" ? mocks.chunkInsert : vi.fn(() => chain);
    chain.single = vi.fn(async () => ({ data: { id: "doc", status: "processing" }, error: null }));
    chain.maybeSingle = vi.fn(async () => ({ data: { id: "doc", storage_path: "tenant/file.txt" }, error: null }));
    chain.update = mocks.statusUpdate.mockImplementation(() => chain);
    chain.delete = mocks.cleanup.mockImplementation(() => chain);
    return chain;
  });
});
describe("document ingestion lifecycle", () => {
  it("returns ready only after storing tenant-scoped embeddings", async () => {
    const result = await uploadAndProcessDocument(file, "tenant");
    expect(result.status).toBe("ready");
    expect(mocks.chunkInsert).toHaveBeenCalledWith(expect.objectContaining({ business_id: "tenant", document_id: "doc" }));
    expect(mocks.statusUpdate).toHaveBeenCalledWith({ status: "ready" });
  });
  it("marks failed and cleans partial chunks when embedding fails", async () => {
    mocks.embed.mockRejectedValue(new Error("quota"));
    await expect(uploadAndProcessDocument(file, "tenant")).rejects.toThrow("quota");
    expect(mocks.cleanup).toHaveBeenCalled();
    expect(mocks.statusUpdate).toHaveBeenCalledWith({ status: "failed" });
  });
  it("rejects a path traversal filename before uploading", async () => {
    await expect(uploadAndProcessDocument({ ...file, originalname: "../policy.txt" }, "tenant")).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejects oversized or unsupported uploads", async () => {
    await expect(uploadAndProcessDocument({ ...file, size: 11 * 1024 * 1024 }, "tenant")).rejects.toMatchObject({ statusCode: 400 });
    await expect(uploadAndProcessDocument({ ...file, mimetype: "text/html" }, "tenant")).rejects.toMatchObject({ statusCode: 400 });
  });
  it("does not report deletion success when storage removal fails", async () => {
    mocks.remove.mockResolvedValue({ error: { message: "Unavailable" } });
    await expect(deleteDocument("doc", "tenant")).rejects.toMatchObject({ statusCode: 502 });
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
});
