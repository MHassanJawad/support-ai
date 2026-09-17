// Document management routes for tenant knowledge bases.
import { Router } from "express";
import multer from "multer";
import { requireEditor } from "../middleware/auth";
import { asyncRoute } from "../utils/async-route";
import { deleteDocument, listDocuments, uploadAndProcessDocument } from "../services/document-service";
import { requireBusinessId } from "../services/business-service";
import "../types";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const documentRouter = Router();

documentRouter.get(
  "/documents",
  asyncRoute(async (req, res) => {
    const businessId = requireBusinessId(req.context.auth?.businessId);
    res.json({ data: await listDocuments(businessId) });
  })
);

documentRouter.post(
  "/documents",
  requireEditor,
  upload.single("file"),
  asyncRoute(async (req, res) => {
    const businessId = requireBusinessId(req.context.auth?.businessId);
    if (!req.file) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "File is required.", requestId: req.context.requestId } });
      return;
    }

    const document = await uploadAndProcessDocument(req.file, businessId);
    res.status(201).json({ data: document });
  })
);

documentRouter.delete(
  "/documents/:documentId",
  requireEditor,
  asyncRoute(async (req, res) => {
    const businessId = requireBusinessId(req.context.auth?.businessId);
    await deleteDocument(req.params.documentId!, businessId);
    res.status(204).send();
  })
);
