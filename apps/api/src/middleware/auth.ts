// Supabase JWT authentication and active business resolution middleware.
import type { NextFunction, Response } from "express";
import { AppError, AuthError, ForbiddenError } from "../errors/app-error";
import { supabaseAdmin, supabaseAuth } from "../config/supabase";
import type { Request } from "express";
import "../types";

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");

  if (!token) {
    next(new AuthError());
    return;
  }

  try {
  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data.user) {
    next(new AuthError("Invalid or expired session."));
    return;
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) throw new AppError("DATABASE_ERROR", "Could not verify workspace access.", 503);

  req.context.auth = {
    userId: data.user.id,
    ...(membership?.role ? { role: membership.role as string } : {}),
    ...(data.user.email ? { email: data.user.email } : {}),
    ...(membership?.business_id ? { businessId: membership.business_id as string } : {})
  };

  next();
  } catch (error) {
    next(error);
  }
}

export function requireEditor(req: Request, _res: Response, next: NextFunction): void {
  if (!["owner", "admin"].includes(req.context.auth?.role ?? "")) {
    next(new ForbiddenError("Only owners and admins can change workspace content."));
    return;
  }
  next();
}
