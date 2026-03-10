import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ConflictError, NotFoundError } from "../errors.js";
import { CreateUserSchema, IdParamSchema } from "../schemas.js";
import { Prisma } from "@prisma/client";

const router = Router();

/**
 * POST /api/users
 * Body: { email: string, name?: string }
 */
router.post("/", async (req, res, next) => {
  try {
    const { email, name } = CreateUserSchema.parse(req.body);
    const user = await prisma.user.create({
      data: { email, name: name ?? null },
    });
    res.status(201).json(user);
  } catch (err) {
    // Prisma unique constraint violation
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return next(new ConflictError("A user with this email already exists."));
    }
    next(err);
  }
});

/**
 * GET /api/users
 */
router.get("/", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:id
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = IdParamSchema.parse(req.params);
    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user) throw new NotFoundError("User", req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
