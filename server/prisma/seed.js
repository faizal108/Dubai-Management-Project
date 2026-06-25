import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_SUPERADMIN_EMAIL || "superadmin@example.com")
    .toLowerCase()
    .trim();
  const password = process.env.SEED_SUPERADMIN_PASSWORD || "ChangeMe@123";
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Superadmin ${email} already exists. Skipping.`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, saltRounds);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "SUPERADMIN",
      fullName: "Platform Superadmin",
      createdBy: "seed",
      updatedBy: "seed",
    },
  });
  console.log(`Created superadmin ${email}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
