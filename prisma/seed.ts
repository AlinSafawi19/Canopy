import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.platformOwner.findFirst();
  if (!existing) {
    const ownerPassword = process.env.SEED_OWNER_PASSWORD || crypto.randomBytes(16).toString("hex");
    const ownerEmail = process.env.SEED_OWNER_EMAIL || "admin@example.com";

    await prisma.platformOwner.create({
      data: {
        id: nanoid(),
        username: "owner",
        password: await bcrypt.hash(ownerPassword, 12),
        displayName: "Platform Owner",
        email: ownerEmail,
        updatedBy: "seed",
      },
    });

    if (!process.env.SEED_OWNER_PASSWORD) {
      console.log(`\n✓ Created platform owner with auto-generated password: ${ownerPassword}\n`);
    } else {
      console.log("Created platform owner: owner");
    }
  } else {
    console.log("Platform owner already exists, skipping.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
