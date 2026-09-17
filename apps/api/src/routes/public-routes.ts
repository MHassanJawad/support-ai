// Public customer support routes scoped by business id.
import { Router } from "express";
import { createMessageSchema } from "@supportai/shared";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { ForbiddenError } from "../errors/app-error";
import { supabaseAdmin } from "../config/supabase";
import { AppError, NotFoundError } from "../errors/app-error";
import { answerMessage, createConversation, getConversation } from "../services/chat-service";
import { listFaqs } from "../services/faq-service";
import { asyncRoute } from "../utils/async-route";

export const publicRouter = Router();

publicRouter.get(
  "/businesses",
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("businesses")
      .select("id, name, industry, address, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw new AppError("DATABASE_ERROR", "Could not list businesses.", 500);
    }

    res.json({ data: data ?? [] });
  })
);

publicRouter.get(
  "/businesses/:businessId",
  asyncRoute(async (req, res) => {
    const business = await getPublicBusiness(req.params.businessId!);
    res.json({ data: business });
  })
);

publicRouter.get(
  "/businesses/:businessId/faqs",
  asyncRoute(async (req, res) => {
    await getPublicBusiness(req.params.businessId!);
    res.json({ data: await listFaqs(req.params.businessId!) });
  })
);

publicRouter.post(
  "/businesses/:businessId/chat",
  requireAuth,
  asyncRoute(async (req, res) => {
    const businessId = req.params.businessId!;
    await getPublicBusiness(businessId);
    const input = createMessageSchema.extend({ conversationId: z.string().uuid().optional() }).parse(req.body);
    const conversationId =
      input.conversationId && input.conversationId.trim()
        ? await ensurePublicConversation(input.conversationId, businessId, req.context.auth!.userId)
        : (
            await createConversation(
              {
                customerId: req.context.auth!.userId,
                title: input.content.slice(0, 80) || "Customer support chat"
              },
              businessId
            )
          ).id;

    const answer = await answerMessage(conversationId, businessId, input.content);
    res.status(201).json({ data: answer });
  })
);

async function getPublicBusiness(businessId: string) {
  z.string().uuid().parse(businessId);
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id, name, industry, address, created_at")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    throw new AppError("DATABASE_ERROR", "Could not load business.", 500);
  }

  if (!data) {
    throw new NotFoundError("Business was not found.");
  }

  return data;
}

async function ensurePublicConversation(conversationId: string, businessId: string, userId: string): Promise<string> {
  z.string().uuid().parse(conversationId);
  const conversation = await getConversation(conversationId, businessId);
  if (conversation.customer_id !== userId) throw new ForbiddenError();
  return conversationId;
}

publicRouter.get("/businesses/:businessId/conversations", requireAuth, asyncRoute(async (req, res) => {
  const businessId = z.string().uuid().parse(req.params.businessId);
  const { data, error } = await supabaseAdmin.from("conversations")
    .select("id, title, created_at").eq("business_id", businessId)
    .eq("customer_id", req.context.auth!.userId).order("created_at", { ascending: false }).limit(50);
  if (error) throw new AppError("DATABASE_ERROR", "Could not load conversation history.", 500);
  res.json({ data });
}));

publicRouter.get("/businesses/:businessId/conversations/:conversationId", requireAuth, asyncRoute(async (req, res) => {
  const businessId = z.string().uuid().parse(req.params.businessId);
  const id = await ensurePublicConversation(req.params.conversationId!, businessId, req.context.auth!.userId);
  res.json({ data: await getConversation(id, businessId) });
}));
