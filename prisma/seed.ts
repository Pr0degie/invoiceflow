import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("admin1234", 12);

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin",
      password,
      role: Role.ADMIN,
    },
  });

  console.log("Seeded admin user: admin@example.com / admin1234");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());