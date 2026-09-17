// Document upload, extraction, chunking, embedding, and tenant-scoped retrieval.
import path from "node:path";
import { randomUUID } from "node:crypto";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import type { SourceReference } from "@supportai/shared";
import { env } from "../config/env";
import { supabaseAdmin } from "../config/supabase";
import { AppError, NotFoundError, ValidationError } from "../errors/app-error";
import { aiProvider } from "./ai-provider";
import { chunkText } from "./text-chunker";

const allowedMimeTypes = new Set(["application/pdf", "text/plain"]);

export async function uploadAndProcessDocument(file: Express.Multer.File, businessId: string) {
  assertAllowedFile(file);
  const safeName = sanitizeFilename(file.originalname);
  const storagePath = `${businessId}/${randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });

  if (uploadError) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Supabase storage upload failed",
        bucket: env.SUPABASE_STORAGE_BUCKET,
        storagePath,
        file: {
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size
        },
        supabaseError: toSafeSupabaseError(uploadError)
      })
    );
    throw new AppError("UPLOAD_REJECTED", getStorageUploadMessage(uploadError), 400);
  }

  const { data: document, error: documentError } = await supabaseAdmin
    .from("documents")
    .insert({
      business_id: businessId,
      filename: safeName,
      mime_type: file.mimetype,
      storage_path: storagePath,
      status: "processing"
    })
    .select("*")
    .single();

  if (documentError || !document) {
    await supabaseAdmin.storage.from(env.SUPABASE_STORAGE_BUCKET).remove([storagePath]);
    throw new AppError("DATABASE_ERROR", "Could not create document record.", 500);
  }

  try {
    const text = await extractText(file);
    const chunks = chunkText(text);

    console.log(
      JSON.stringify({
        level: "info",
        message: "Document text extracted",
        documentId: document.id,
        filename: safeName,
        textLength: text.length,
        chunkCount: chunks.length
      })
    );

    if (chunks.length === 0) {
      throw new AppError("UPLOAD_REJECTED", "No readable text was extracted from this document.", 400);
    }

    for (const [index, chunk] of chunks.entries()) {
      const embedding = await aiProvider.embed(chunk.content, "RETRIEVAL_DOCUMENT", safeName);
      const { error: chunkError } = await supabaseAdmin.from("document_chunks").insert({
        business_id: businessId,
        document_id: document.id,
        chunk_text: chunk.content,
        embedding: toPgVector(embedding),
        chunk_index: index,
        token_estimate: chunk.tokenEstimate
      });

      if (chunkError) {
        console.error(
          JSON.stringify({
            level: "error",
            message: "Document chunk insert failed",
            documentId: document.id,
            chunkIndex: index,
            supabaseError: toSafeSupabaseError(chunkError)
          })
        );
        throw new AppError("DATABASE_ERROR", "Could not store document chunk embedding.", 500);
      }
    }

    const { error: readyError } = await supabaseAdmin.from("documents").update({ status: "ready" }).eq("id", document.id).eq("business_id", businessId);
    if (readyError) throw new AppError("DATABASE_ERROR", "Could not mark document ready.", 500);
  } catch (error) {
    await supabaseAdmin.from("document_chunks").delete().eq("document_id", document.id).eq("business_id", businessId);
    await supabaseAdmin.from("documents").update({ status: "failed" }).eq("id", document.id);
    throw error;
  }

  return { ...document, status: "ready" };
}

function getStorageUploadMessage(error: unknown): string {
  const message = getSupabaseMessage(error);
  const statusCode = getSupabaseStatusCode(error);

  if (statusCode === 404 || message.includes("bucket not found") || message.includes("not found")) {
    return "Could not upload document because the Supabase Storage bucket was not found. Create a bucket named knowledge-base or update SUPABASE_STORAGE_BUCKET.";
  }

  if (statusCode === 401 || statusCode === 403 || message.includes("invalid api key")) {
    return "Could not upload document because Supabase rejected the API key or storage permission. Check SUPABASE_SERVICE_ROLE_KEY and restart the API.";
  }

  if (message.includes("row-level security") || message.includes("violates row-level security")) {
    return "Could not upload document because Supabase Storage policies blocked the upload. Use the service role key on the API or add storage policies.";
  }

  return "Could not upload document to storage. Check the API log for the Supabase Storage error code.";
}

function getSupabaseMessage(error: unknown): string {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return "";
  }

  return String(error.message).toLowerCase();
}

function getSupabaseStatusCode(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as { statusCode?: number | string; status?: number | string };
  const value = candidate.statusCode ?? candidate.status;
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function toSafeSupabaseError(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
    status?: number | string;
    statusCode?: number | string;
  };

  return {
    code: candidate.code,
    message: candidate.message,
    details: candidate.details,
    hint: candidate.hint,
    status: candidate.status,
    statusCode: candidate.statusCode
  };
}

export async function listDocuments(businessId: string) {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("DATABASE_ERROR", "Could not list documents.", 500);
  }

  return data;
}

export async function deleteDocument(documentId: string, businessId: string): Promise<void> {
  const { data: document } = await supabaseAdmin
    .from("documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!document) {
    throw new NotFoundError("Document was not found.");
  }

  const { error: storageError } = await supabaseAdmin.storage.from(env.SUPABASE_STORAGE_BUCKET).remove([document.storage_path]);
  if (storageError) throw new AppError("DATABASE_ERROR", "Could not delete the stored file. Please retry.", 502);
  const { error: deleteError } = await supabaseAdmin.from("documents").delete().eq("id", documentId).eq("business_id", businessId);
  if (deleteError) throw new AppError("DATABASE_ERROR", "Could not delete document metadata. Please retry.", 500);
}

export async function retrieveRelevantChunks(
  businessId: string,
  question: string,
  limit = 5
): Promise<SourceReference[]> {
  const embedding = await aiProvider.embed(question, "RETRIEVAL_QUERY");
  const { data, error } = await supabaseAdmin.rpc("match_document_chunks", {
    query_embedding: toPgVector(embedding),
    match_business_id: businessId,
    match_count: limit
  });

  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Document chunk retrieval failed",
        businessId,
        supabaseError: toSafeSupabaseError(error)
      })
    );
    throw new AppError("DATABASE_ERROR", "Could not retrieve relevant knowledge base chunks.", 500);
  }

  const sources = (data ?? []).map((row: Record<string, unknown>) => ({
    documentId: String(row.document_id),
    documentName: String(row.filename),
    chunkId: String(row.id),
    score: Number(row.similarity),
    excerpt: String(row.chunk_text)
  }));

  console.log(
    JSON.stringify({
      level: "info",
      message: "Document chunks retrieved",
      businessId,
      sourceCount: sources.length,
      topScore: sources[0]?.score ?? null
    })
  );

  return sources;
}

function toPgVector(values: number[]): string {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

function assertAllowedFile(file: Express.Multer.File): void {
  if (!allowedMimeTypes.has(file.mimetype)) {
    throw new ValidationError("Only PDF and TXT uploads are supported.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new ValidationError("Documents must be 10 MB or smaller.");
  }
}

function sanitizeFilename(filename: string): string {
  if (filename.includes("/") || filename.includes("\\")) throw new ValidationError("Filename must not contain a path.");
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "-");
  if (!base || base.includes("..")) {
    throw new ValidationError("Filename is invalid.");
  }

  return base;
}

async function extractText(file: Express.Multer.File): Promise<string> {
  if (file.mimetype === "text/plain") {
    return file.buffer.toString("utf8");
  }

  const parsed = await pdfParse(file.buffer);
  return parsed.text;
}
