// FAQ CRUD routes for business-owner-managed knowledge entries.
import { Router } from "express";
import { requireEditor } from "../middleware/auth";
import { createFaqSchema, updateFaqSchema } from "@supportai/shared";
import { asyncRoute } from "../utils/async-route";
import { createFaq, deleteFaq, listFaqs, updateFaq } from "../services/faq-service";
import { requireBusinessId } from "../services/business-service";
import "../types";

export const faqRouter = Router();

faqRouter.get(
  "/faqs",
  asyncRoute(async (req, res) => {
    res.json({ data: await listFaqs(requireBusinessId(req.context.auth?.businessId)) });
  })
);

faqRouter.post(
  "/faqs",
  requireEditor,
  asyncRoute(async (req, res) => {
    const input = createFaqSchema.parse(req.body);
    const faq = await createFaq(input, requireBusinessId(req.context.auth?.businessId));
    res.status(201).json({ data: faq });
  })
);

faqRouter.patch(
  "/faqs/:faqId",
  requireEditor,
  asyncRoute(async (req, res) => {
    const input = updateFaqSchema.parse(req.body);
    const faq = await updateFaq(req.params.faqId!, input, requireBusinessId(req.context.auth?.businessId));
    res.json({ data: faq });
  })
);

faqRouter.delete(
  "/faqs/:faqId",
  requireEditor,
  asyncRoute(async (req, res) => {
    await deleteFaq(req.params.faqId!, requireBusinessId(req.context.auth?.businessId));
    res.status(204).send();
  })
);
