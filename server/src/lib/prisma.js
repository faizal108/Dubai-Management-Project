import { PrismaClient, Prisma } from "@prisma/client";
import { env, isDev } from "./env.js";
import { logger } from "./logger.js";
import { getUserId } from "./requestContext.js";

// Models supporting `isDeleted`. Read queries on these are auto-filtered.
const SOFT_DELETE_MODELS = new Set(["Foundation", "User", "Donor", "Donation", "Activity"]);
// Models with createdBy / updatedBy audit columns to auto-populate.
const AUDITED_MODELS = new Set(["Foundation", "User", "Donor", "Donation", "Activity"]);

const actor = () => getUserId() ?? "system";
const lcModel = (m) => m.charAt(0).toLowerCase() + m.slice(1);

function injectSoftDelete(where) {
  if (where && Object.prototype.hasOwnProperty.call(where, "isDeleted")) return where;
  return { ...(where ?? {}), isDeleted: false };
}

const extension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: "donation-platform",
    query: {
      $allModels: {
        // Reads — exclude soft-deleted rows unless caller explicitly asks otherwise.
        async findFirst({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) args.where = injectSoftDelete(args.where);
          return query(args);
        },
        async findFirstOrThrow({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) args.where = injectSoftDelete(args.where);
          return query(args);
        },
        async findMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) args.where = injectSoftDelete(args.where);
          return query(args);
        },
        async count({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) args.where = injectSoftDelete(args.where);
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) args.where = injectSoftDelete(args.where);
          return query(args);
        },
        async groupBy({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) args.where = injectSoftDelete(args.where);
          return query(args);
        },
        // findUnique can't take non-unique filters, so route to findFirst.
        async findUnique({ model, args, query }) {
          if (!SOFT_DELETE_MODELS.has(model)) return query(args);
          return client[lcModel(model)].findFirst({ ...args, where: injectSoftDelete(args.where) });
        },
        async findUniqueOrThrow({ model, args, query }) {
          if (!SOFT_DELETE_MODELS.has(model)) return query(args);
          return client[lcModel(model)].findFirstOrThrow({ ...args, where: injectSoftDelete(args.where) });
        },
        // Writes — auto-populate audit columns.
        async create({ model, args, query }) {
          if (AUDITED_MODELS.has(model)) {
            args.data = { createdBy: actor(), updatedBy: actor(), ...args.data };
          }
          return query(args);
        },
        async createMany({ model, args, query }) {
          if (AUDITED_MODELS.has(model) && Array.isArray(args.data)) {
            args.data = args.data.map((d) => ({ createdBy: actor(), updatedBy: actor(), ...d }));
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if (AUDITED_MODELS.has(model)) {
            args.data = { ...args.data, updatedBy: actor() };
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (AUDITED_MODELS.has(model)) {
            args.data = { ...args.data, updatedBy: actor() };
          }
          return query(args);
        },
        async upsert({ model, args, query }) {
          if (AUDITED_MODELS.has(model)) {
            args.create = { createdBy: actor(), updatedBy: actor(), ...args.create };
            args.update = { ...args.update, updatedBy: actor() };
          }
          return query(args);
        },
        // Block hard deletes on soft-delete models. Force callers to use softDelete.
        async delete({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            throw new Error(`Hard delete is not allowed on ${model}. Use softDelete().`);
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            throw new Error(`Hard delete is not allowed on ${model}. Use softDeleteMany().`);
          }
          return query(args);
        },
      },
    },
    model: {
      $allModels: {
        // Soft delete: marks a row as deleted and stamps deletedBy/deletedAt.
        async softDelete(args) {
          const ctx = Prisma.getExtensionContext(this);
          return ctx.update({
            where: args.where,
            data: { isDeleted: true, deletedAt: new Date(), deletedBy: actor() },
          });
        },
        async softDeleteMany(args) {
          const ctx = Prisma.getExtensionContext(this);
          return ctx.updateMany({
            where: args.where,
            data: { isDeleted: true, deletedAt: new Date(), deletedBy: actor() },
          });
        },
        async restore(args) {
          const ctx = Prisma.getExtensionContext(this);
          return ctx.update({
            where: args.where,
            data: { isDeleted: false, deletedAt: null, deletedBy: null },
          });
        },
      },
    },
  });
});

const globalForPrisma = globalThis;

function createClient() {
  const base = new PrismaClient({
    log: isDev ? ["warn", "error"] : ["error"],
  });
  return base.$extends(extension);
}

export const prisma = globalForPrisma.__prisma__ ?? createClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.__prisma__ = prisma;
}

export async function disconnectPrisma() {
  try {
    await prisma.$disconnect();
  } catch (err) {
    logger.error({ err }, "prisma disconnect failed");
  }
}
