// Profile and business routes for authenticated SupportAI users.
import { Router } from "express";
import { createBusinessSchema } from "@supportai/shared";
import { requireEditor } from "../middleware/auth";
import { supabaseAdmin } from "../config/supabase";
import { AppError } from "../errors/app-error";
import { requireBusinessId } from "../services/business-service";
import { asyncRoute } from "../utils/async-route";
import { createBusiness, getProfile } from "../services/business-service";
import "../types";

export const profileRouter = Router();

profileRouter.patch("/businesses/current", requireEditor, asyncRoute(async (req, res) => {
  const input = createBusinessSchema.parse(req.body);
  const { data, error } = await supabaseAdmin.from("businesses")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", requireBusinessId(req.context.auth?.businessId)).select("*").single();
  if (error) throw new AppError("DATABASE_ERROR", "Could not update business information.", 500);
  res.json({ data });
}));

profileRouter.get(
  "/profile",
  asyncRoute(async (req, res) => {
    res.json({ data: await getProfile(req.context.auth!.userId) });
  })
);

profileRouter.post(
  "/businesses",
  asyncRoute(async (req, res) => {
    const input = createBusinessSchema.parse(req.body);
    const business = await createBusiness(input, req.context.auth!.userId);
    res.status(201).json({ data: business });
  })
);
