import { db } from "@/lib/db/prisma";
import { AppError } from "@/services/errors";
import type { UserRole } from "@/types/domain";

type VolunteerProfileRoleState = {
  id: string;
  active: boolean;
  temporaryUnavailable: boolean;
  canServeAsReplacement: boolean;
};

type UserAccountRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  volunteerProfile: VolunteerProfileRoleState | null;
};

export type UserAccountDto = UserAccountRecord;

const VOLUNTEER_PROFILE_ROLE_SELECT = {
  id: true,
  active: true,
  temporaryUnavailable: true,
  canServeAsReplacement: true
} as const;

const USER_ACCOUNT_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  active: true,
  createdAt: true,
  volunteerProfile: {
    select: VOLUNTEER_PROFILE_ROLE_SELECT
  }
} as const;

function mapUserAccount(record: UserAccountRecord): UserAccountDto {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    role: record.role,
    active: record.active,
    createdAt: record.createdAt,
    volunteerProfile: record.volunteerProfile
  };
}

export async function getUserAccounts(): Promise<UserAccountDto[]> {
  const users = await db.user.findMany({
    select: USER_ACCOUNT_SELECT,
    orderBy: [{ role: "asc" }, { name: "asc" }]
  });

  return users.map(mapUserAccount);
}

export async function updateUserRole(input: {
  userId: string;
  role: UserRole;
}): Promise<UserAccountDto> {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      include: { volunteerProfile: true }
    });

    if (user.role === "ADMIN" && input.role === "VOLUNTEER" && user.active) {
      const remainingActiveAdmins = await tx.user.count({
        where: {
          id: { not: user.id },
          role: "ADMIN",
          active: true
        }
      });

      if (remainingActiveAdmins === 0) {
        throw new AppError(
          "No puedes convertir el último administrador activo en voluntario.",
          409
        );
      }
    }

    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: { role: input.role },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true
      }
    });

    let volunteerProfile: VolunteerProfileRoleState | null = null;

    if (input.role === "VOLUNTEER") {
      volunteerProfile = user.volunteerProfile
        ? await tx.volunteerProfile.update({
            where: { id: user.volunteerProfile.id },
            data: {
              active: true,
              temporaryUnavailable: false,
              canServeAsReplacement: true
            },
            select: VOLUNTEER_PROFILE_ROLE_SELECT
          })
        : await tx.volunteerProfile.create({
            data: {
              userId: user.id,
              preferredAreas: [],
              active: true,
              temporaryUnavailable: false,
              canServeAsReplacement: true
            },
            select: VOLUNTEER_PROFILE_ROLE_SELECT
          });
    } else if (user.volunteerProfile) {
      volunteerProfile = await tx.volunteerProfile.update({
        where: { id: user.volunteerProfile.id },
        data: {
          active: false,
          temporaryUnavailable: true,
          canServeAsReplacement: false
        },
        select: VOLUNTEER_PROFILE_ROLE_SELECT
      });
    }

    return mapUserAccount({
      ...updatedUser,
      volunteerProfile
    });
  });
}
