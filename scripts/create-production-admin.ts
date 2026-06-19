import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const FIXED_PREACHING_POINT_NAME = "Hospital Dr José G. Parres";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

async function main() {
  const email = requireEnv("ADMIN_EMAIL").toLowerCase();
  const password = requireEnv("ADMIN_PASSWORD");
  const name = process.env.ADMIN_NAME?.trim() || "PPAM Admin";
  const phone = requireEnv("ADMIN_PHONE");

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters long.");
  }

  const prisma = new PrismaClient();

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser && existingUser.role !== UserRole.ADMIN) {
      throw new Error(
        `A non-admin user already exists with ${email}. Use another ADMIN_EMAIL.`
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = existingUser
      ? await prisma.user.update({
          where: { email },
          data: {
            active: true,
            accessStatus: "APPROVED",
            name,
            passwordHash,
            phone
          }
        })
      : await prisma.user.create({
          data: {
            active: true,
            accessStatus: "APPROVED",
            email,
            name,
            passwordHash,
            phone,
            role: UserRole.ADMIN
          }
        });

    const point =
      (await prisma.preachingPoint.findFirst({
        where: { name: FIXED_PREACHING_POINT_NAME }
      })) ??
      (await prisma.preachingPoint.create({
        data: {
          active: true,
          area: "Hospital",
          name: FIXED_PREACHING_POINT_NAME,
          notes: "Punto fijo de predicación para toda la operación."
        }
      }));

    console.log(
      JSON.stringify(
        {
          adminEmail: admin.email,
          adminId: admin.id,
          preachingPointId: point.id,
          preachingPointName: point.name,
          status: existingUser ? "admin-updated" : "admin-created"
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
