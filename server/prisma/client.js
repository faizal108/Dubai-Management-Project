import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient().$extends({
  name: "SoftDeleteAndAuditExtension",

  model: {
    donor: {
      async createWithAudit(data, userId) {
        return prisma.donor.create({
          data: {
            ...data,
            createdBy: userId,
            updatedBy: userId,
          },
        });
      },

      async updateWithAudit(where, data, userId) {
        return prisma.donor.update({
          where,
          data: {
            ...data,
            updatedBy: userId,
          },
        });
      },

      async softDelete(where) {
        return prisma.donor.update({
          where,
          data: { isDeleted: true },
        });
      },

      async findManySafe(args = {}) {
        return prisma.donor.findMany({
          ...args,
          where: {
            ...args.where,
            isDeleted: false,
          },
        });
      },
    },

    donation: {
      async createWithAudit(data, userId) {
        return prisma.donation.create({
          data: {
            ...data,
            createdBy: userId,
            updatedBy: userId,
          },
        });
      },

      async updateWithAudit(where, data, userId) {
        return prisma.donation.update({
          where,
          data: {
            ...data,
            updatedBy: userId,
          },
        });
      },

      async softDelete(where) {
        return prisma.donation.update({
          where,
          data: { isDeleted: true },
        });
      },

      async findManySafe(args = {}) {
        return prisma.donation.findMany({
          ...args,
          where: {
            ...args.where,
            isDeleted: false,
          },
        });
      },
    },
  },
});

export default prisma;
