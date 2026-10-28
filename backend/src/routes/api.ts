import { Router } from "express";
import { z } from "zod";
import { PrismaClient, Platform, JobStatus, ItemStatus } from "@prisma/client";

import {
  createConnection,
  listConnections,
  testConnection,
  deleteConnection,
  getConnection,
} from "../services/connections.js";

import { fetchShopifyProducts } from "../adapters/shopify/client.js";
import { summarizeProduct, toWooProduct } from "../migrations/transform.js";

const prisma = new PrismaClient();

export const api = Router();

const connectionSchema = z.object({
  name: z.string().min(1).max(120),
  platform: z.nativeEnum(Platform),
  storeUrl: z.string().url(),
  credentials: z.record(z.string().min(1)),
});

const pairSchema = z.object({
  sourceConnectionId: z.string().min(1),
  destinationConnectionId: z.string().min(1),
});

api.get("/connections", async (_req, res, next) => {
  try {
    res.json(await listConnections());
  } catch (error) {
    next(error);
  }
});

api.post("/connections", async (req, res, next) => {
  try {
    const input = connectionSchema.parse(req.body);
    res.status(201).json(await createConnection(input));
  } catch (error) {
    next(error);
  }
});

api.post("/connections/:id/test", async (req, res, next) => {
  try {
    res.json(await testConnection(req.params.id));
  } catch (error) {
    next(error);
  }
});

api.delete("/connections/:id", async (req, res, next) => {
  try {
    res.json(await deleteConnection(req.params.id));
  } catch (error) {
    next(error);
  }
});

api.post("/scan", async (req, res, next) => {
  try {
    const { sourceConnectionId } = z
      .object({ sourceConnectionId: z.string().min(1) })
      .parse(req.body);

    const connection = await getConnection(sourceConnectionId);

    if (connection.platform !== "SHOPIFY") {
      throw new Error("The source must be a Shopify connection.");
    }

    const products = await fetchShopifyProducts(connection.storeUrl, {
      accessToken: connection.credentials.accessToken,
      apiVersion: connection.credentials.apiVersion,
    });

    res.json({
      productCount: products.length,
      variantCount: products.reduce(
        (total, product) => total + product.variants.length,
        0,
      ),
      imageCount: products.reduce(
        (total, product) => total + product.images.length,
        0,
      ),
      warningCount: products.reduce(
        (total, product) => total + product.warnings.length,
        0,
      ),
      products: products.slice(0, 100).map(summarizeProduct),
      truncated: products.length > 100,
    });
  } catch (error) {
    next(error);
  }
});

api.post("/preview", async (req, res, next) => {
  try {
    const { sourceConnectionId, destinationConnectionId } = pairSchema.parse(
      req.body,
    );

    const [source, destination] = await Promise.all([
      getConnection(sourceConnectionId),
      getConnection(destinationConnectionId),
    ]);

    if (
      source.platform !== "SHOPIFY" ||
      destination.platform !== "WOOCOMMERCE"
    ) {
      throw new Error("Initial migration path must be Shopify → WooCommerce.");
    }

    const products = await fetchShopifyProducts(source.storeUrl, {
      accessToken: source.credentials.accessToken,
      apiVersion: source.credentials.apiVersion,
    });

    const previews = products.map((product) => ({
      ...summarizeProduct(product),
      payload: toWooProduct(product),
    }));

    res.json({
      total: previews.length,
      create: previews.length,
      update: 0,
      skip: 0,
      flagged: previews.filter((product) => product.warnings.length).length,
      products: previews.slice(0, 100),
      truncated: previews.length > 100,
      notice:
        "Preview performs source reads only; it does not write to WooCommerce. Duplicate detection and update behavior remain limited in this release.",
    });
  } catch (error) {
    next(error);
  }
});

api.post("/jobs", async (req, res, next) => {
  try {
    const { sourceConnectionId, destinationConnectionId } = pairSchema.parse(
      req.body,
    );

    const [source, destination] = await Promise.all([
      getConnection(sourceConnectionId),
      getConnection(destinationConnectionId),
    ]);

    if (
      source.platform !== "SHOPIFY" ||
      destination.platform !== "WOOCOMMERCE"
    ) {
      throw new Error("Initial migration path must be Shopify → WooCommerce.");
    }

    const products = await fetchShopifyProducts(source.storeUrl, {
      accessToken: source.credentials.accessToken,
      apiVersion: source.credentials.apiVersion,
    });

    const job = await prisma.migrationJob.create({
      data: {
        sourceConnectionId,
        destinationConnectionId,
        status: JobStatus.QUEUED,
        total: products.length,
        items: {
          create: products.map((product) => ({
            sourceId: product.sourceId,
            sourceTitle: product.title,
            status: ItemStatus.PENDING,
          })),
        },
        logs: {
          create: {
            event: "job_queued",
            message: `Migration queued with ${products.length} source products.`,
          },
        },
      },
    });

    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
});

api.get("/jobs", async (_req, res, next) => {
  try {
    res.json(
      await prisma.migrationJob.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          _count: {
            select: { items: true },
          },
        },
      }),
    );
  } catch (error) {
    next(error);
  }
});

api.get("/jobs/:id", async (req, res, next) => {
  try {
    const job = await prisma.migrationJob.findUnique({
      where: { id: req.params.id },
      include: {
        logs: {
          orderBy: { createdAt: "desc" },
          take: 30,
        },
      },
    });

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    res.json(job);
  } catch (error) {
    next(error);
  }
});

api.get("/jobs/:id/items", async (req, res, next) => {
  try {
    const status = req.query.status
      ? z.nativeEnum(ItemStatus).parse(String(req.query.status))
      : undefined;

    res.json(
      await prisma.jobItem.findMany({
        where: {
          jobId: req.params.id,
          status,
        },
        orderBy: { createdAt: "asc" },
        take: 500,
      }),
    );
  } catch (error) {
    next(error);
  }
});

api.post("/jobs/:id/cancel", async (req, res, next) => {
  try {
    const job = await prisma.migrationJob.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      throw new Error("Job not found.");
    }

    const queued = job.status === JobStatus.QUEUED;

    res.json(
      await prisma.migrationJob.update({
        where: { id: job.id },
        data: {
          cancelRequested: true,
          status: queued ? JobStatus.CANCELLED : job.status,
          finishedAt: queued ? new Date() : undefined,
          logs: {
            create: {
              event: "cancel_requested",
              message: queued
                ? "Queued job cancelled before execution."
                : "Cancellation requested by operator.",
            },
          },
        },
      }),
    );
  } catch (error) {
    next(error);
  }
});

api.post("/jobs/:id/retry-failed", async (req, res, next) => {
  try {
    const job = await prisma.migrationJob.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      throw new Error("Job not found.");
    }

    await prisma.jobItem.updateMany({
      where: {
        jobId: job.id,
        status: ItemStatus.FAILED,
      },
      data: {
        status: ItemStatus.PENDING,
        errorCode: null,
        errorMessage: null,
      },
    });

    res.json(
      await prisma.migrationJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.QUEUED,
          cancelRequested: false,
          finishedAt: null,
          logs: {
            create: {
              event: "retry_queued",
              message: "Failed items returned to pending status.",
            },
          },
        },
      }),
    );
  } catch (error) {
    next(error);
  }
});

api.get("/jobs/:id/report.json", async (req, res, next) => {
  try {
    const job = await prisma.migrationJob.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        logs: true,
      },
    });

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    res.setHeader(
      "content-disposition",
      `attachment; filename="pme-report-${job.id}.json"`,
    );

    res.json(job);
  } catch (error) {
    next(error);
  }
});

api.get("/jobs/:id/report.csv", async (req, res, next) => {
  try {
    const items = await prisma.jobItem.findMany({
      where: { jobId: req.params.id },
      orderBy: { createdAt: "asc" },
    });

    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader(
      "content-disposition",
      `attachment; filename="pme-report-${req.params.id}.csv"`,
    );

    const cell = (value: unknown) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const rows = [
      "sourceId,title,status,destinationId,errorCode,errorMessage,attempts",
      ...items.map((item) =>
        [
          item.sourceId,
          item.sourceTitle,
          item.status,
          item.destinationId,
          item.errorCode,
          item.errorMessage,
          item.attempts,
        ]
          .map(cell)
          .join(","),
      ),
    ];

    res.send(rows.join("\n"));
  } catch (error) {
    next(error);
  }
});
