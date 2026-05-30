import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.platformOwner.findFirst();
  if (!existing) {
    await prisma.platformOwner.create({
      data: {
        id: nanoid(),
        username: "owner",
        password: await bcrypt.hash("owner", 12),
        displayName: "Platform Owner",
        email: "alinsafawi19@gmail.com",
        updatedBy: "seed",
      },
    });
    console.log("Created platform owner: owner");
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
