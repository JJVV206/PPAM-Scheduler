import { db } from "@/lib/db/prisma";
import { AppError } from "@/services/errors";
import type { UserAccessStatus, UserRole } from "@/types/domain";

type VolunteerProfileRoleState = {
  id: string;
  active: boolean;
  temporaryUnavailable: boolean;
  canServeAsPrimary: boolean;
  canServeAsReplacement: boolean;
};

type UserAccountRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  active: boolean;
  accessStatus: UserAccessStatus;
  accessReviewedAt: Date | null;
  accessReviewNote: string | null;
  createdAt: Date;
  accessReviewedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  volunteerProfile: VolunteerProfileRoleState | null;
};

export type UserAccountDto = UserAccountRecord;

const VOLUNTEER_PROFILE_ROLE_SELECT = {
  id: true,
  active: true,
  temporaryUnavailable: true,
  canServeAsPrimary: true,
  canServeAsReplacement: true
} as const;

const USER_ACCOUNT_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  active: true,
  accessStatus: true,
  accessReviewedAt: true,
  accessReviewNote: true,
  createdAt: true,
  accessReviewedBy: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
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
    accessStatus: record.accessStatus,
    accessReviewedAt: record.accessReviewedAt,
    accessReviewNote: record.accessReviewNote,
    createdAt: record.createdAt,
    accessReviewedBy: record.accessReviewedBy,
    volunteerProfile: record.volunteerProfile
  };
}

export async function getUserAccounts(): Promise<UserAccountDto[]> {
  const users = await db.user.findMany({
    select: USER_ACCOUNT_SELECT,
    orderBy: [{ accessStatus: "asc" }, { role: "asc" }, { name: "asc" }]
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

    if (!user.active || user.accessStatus !== "APPROVED") {
      throw new AppError(
        "Solo puedes cambiar roles de cuentas activas y aprobadas.",
        409
      );
    }

    if (user.role === "ADMIN" && input.role === "VOLUNTEER" && user.active) {
      const remainingActiveAdmins = await tx.user.count({
        where: {
          id: { not: user.id },
          role: "ADMIN",
          active: true,
          accessStatus: "APPROVED"
        }
      });

      if (remainingActiveAdmins === 0) {
        throw new AppError(
          "No puedes convertir el último administrador activo en voluntario.",
          409
        );
      }
    }

    await tx.user.update({
      where: { id: user.id },
      data: { role: input.role }
    });

    if (input.role === "VOLUNTEER") {
      if (user.volunteerProfile) {
        await tx.volunteerProfile.update({
            where: { id: user.volunteerProfile.id },
            data: {
              active: true,
              temporaryUnavailable: false,
              canServeAsPrimary: true,
              canServeAsReplacement: false
            },
            select: VOLUNTEER_PROFILE_ROLE_SELECT
          });
      } else {
        await tx.volunteerProfile.create({
            data: {
              userId: user.id,
              preferredAreas: [],
              active: true,
              temporaryUnavailable: false,
              canServeAsPrimary: true,
              canServeAsReplacement: false
            },
            select: VOLUNTEER_PROFILE_ROLE_SELECT
          });
      }
    } else if (user.volunteerProfile) {
      await tx.volunteerProfile.update({
        where: { id: user.volunteerProfile.id },
        data: {
          active: false,
          temporaryUnavailable: true,
          canServeAsPrimary: false,
          canServeAsReplacement: false
        },
        select: VOLUNTEER_PROFILE_ROLE_SELECT
      });
    }

    const updatedUser = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: USER_ACCOUNT_SELECT
    });

    return mapUserAccount(updatedUser);
  });
}

export async function reviewUserAdmission(input: {
  userId: string;
  actorUserId: string;
  decision: "APPROVE" | "REJECT";
  note?: string;
}): Promise<UserAccountDto> {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      include: { volunteerProfile: true }
    });

    if (user.role !== "VOLUNTEER") {
      throw new AppError(
        "Solo se pueden revisar solicitudes de cuentas voluntarias.",
        409
      );
    }

    const now = new Date();
    const reviewNote = input.note?.trim() || null;

    if (input.decision === "APPROVE") {
      if (user.accessStatus === "SUSPENDED") {
        throw new AppError(
          "Esta cuenta está suspendida. Reactívala desde la gestión del perfil.",
          409
        );
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          active: true,
          accessStatus: "APPROVED",
          accessReviewedAt: now,
          accessReviewedById: input.actorUserId,
          accessReviewNote: null
        }
      });

      if (user.volunteerProfile) {
        await tx.volunteerProfile.update({
          where: { id: user.volunteerProfile.id },
          data: {
            active: true,
            temporaryUnavailable: false,
            canServeAsPrimary: true,
            canServeAsReplacement: false
          }
        });
      } else {
        await tx.volunteerProfile.create({
          data: {
            userId: user.id,
            preferredAreas: [],
            active: true,
            temporaryUnavailable: false,
            canServeAsPrimary: true,
            canServeAsReplacement: false
          }
        });
      }
    } else {
      if (
        user.accessStatus === "APPROVED" ||
        user.accessStatus === "SUSPENDED"
      ) {
        throw new AppError(
          "Solo se pueden rechazar solicitudes pendientes o previamente rechazadas.",
          409
        );
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          active: false,
          accessStatus: "REJECTED",
          accessReviewedAt: now,
          accessReviewedById: input.actorUserId,
          accessReviewNote: reviewNote
        }
      });

      if (user.volunteerProfile) {
        await tx.volunteerProfile.update({
          where: { id: user.volunteerProfile.id },
          data: {
            active: false,
            temporaryUnavailable: true,
            canServeAsPrimary: false,
            canServeAsReplacement: false
          }
        });
      }
    }

    const reviewedUser = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: USER_ACCOUNT_SELECT
    });

    return mapUserAccount(reviewedUser);
  });
}
