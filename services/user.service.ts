import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db/prisma";
import { AppError } from "@/services/errors";
import { syncReplacementVolunteerWithOpenCensuses } from "@/services/replacement-census.service";
import { suspendVolunteerOperationalAccess } from "@/services/volunteer.service";
import type {
  UserAccessStatus,
  UserAccountAuditAction,
  UserRole
} from "@/types/domain";

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

const ANONYMIZED_EMAIL_PREFIX = "deleted+";
const ANONYMIZED_EMAIL_DOMAIN = "@ppam.local";
const ANONYMIZED_NAME = "Usuario eliminado";

function normalizeAccountName(name: string) {
  return name.trim();
}

function normalizeNote(note?: string) {
  return note?.trim() || null;
}

function isAnonymizedEmail(email: string) {
  return (
    email.startsWith(ANONYMIZED_EMAIL_PREFIX) &&
    email.endsWith(ANONYMIZED_EMAIL_DOMAIN)
  );
}

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

async function assertNotLastActiveAdmin(
  tx: Prisma.TransactionClient,
  user: {
    id: string;
    role: UserRole;
    active: boolean;
    accessStatus: UserAccessStatus;
  }
) {
  if (
    user.role !== "ADMIN" ||
    !user.active ||
    user.accessStatus !== "APPROVED"
  ) {
    return;
  }

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
      "No puedes modificar el acceso del último administrador activo.",
      409
    );
  }
}

async function recordUserAccountAudit(
  tx: Prisma.TransactionClient,
  input: {
    targetUserId: string;
    actorUserId: string;
    action: UserAccountAuditAction;
    note?: string | null;
    metadata?: Prisma.InputJsonObject;
  }
) {
  await tx.userAccountAuditLog.create({
    data: {
      targetUserId: input.targetUserId,
      actorUserId: input.actorUserId,
      action: input.action,
      note: input.note ?? null,
      metadata: input.metadata
    }
  });
}

export async function getUserAccounts(
  input: {
    accessStatuses?: UserAccessStatus[];
  } = {}
): Promise<UserAccountDto[]> {
  const users = await db.user.findMany({
    where: input.accessStatuses?.length
      ? { accessStatus: { in: input.accessStatuses } }
      : undefined,
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
      if (user.accessStatus !== "PENDING_APPROVAL") {
        const message =
          user.accessStatus === "SUSPENDED"
            ? "Esta cuenta está suspendida. Reactívala desde la gestión del perfil."
            : "Solo se pueden aprobar solicitudes pendientes.";

        throw new AppError(message, 409);
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
      if (user.accessStatus === "REJECTED") {
        const reviewedUser = await tx.user.findUniqueOrThrow({
          where: { id: user.id },
          select: USER_ACCOUNT_SELECT
        });

        return mapUserAccount(reviewedUser);
      }

      if (user.accessStatus !== "PENDING_APPROVAL") {
        throw new AppError(
          "Solo se pueden rechazar solicitudes pendientes.",
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

export async function updateOwnAccountName(input: {
  userId: string;
  name: string;
}): Promise<UserAccountDto> {
  const normalizedName = normalizeAccountName(input.name);

  return db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: input.userId },
      data: { name: normalizedName },
      select: USER_ACCOUNT_SELECT
    });

    await recordUserAccountAudit(tx, {
      targetUserId: input.userId,
      actorUserId: input.userId,
      action: "NAME_CHANGE",
      metadata: { source: "self_service" }
    });

    return mapUserAccount(user);
  });
}

export async function updateUserAccountName(input: {
  userId: string;
  actorUserId: string;
  name: string;
}): Promise<UserAccountDto> {
  const normalizedName = normalizeAccountName(input.name);

  return db.$transaction(async (tx) => {
    const currentUser = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: {
        id: true,
        email: true
      }
    });

    if (isAnonymizedEmail(currentUser.email)) {
      throw new AppError("No puedes editar una cuenta anonimizada.", 409);
    }

    const user = await tx.user.update({
      where: { id: input.userId },
      data: { name: normalizedName },
      select: USER_ACCOUNT_SELECT
    });

    await recordUserAccountAudit(tx, {
      targetUserId: input.userId,
      actorUserId: input.actorUserId,
      action: "NAME_CHANGE",
      metadata: { source: "admin" }
    });

    return mapUserAccount(user);
  });
}

export async function suspendUserAccount(input: {
  userId: string;
  actorUserId: string;
  note?: string;
}): Promise<UserAccountDto> {
  if (input.userId === input.actorUserId) {
    throw new AppError("No puedes suspender tu propia cuenta.", 409);
  }

  const note = normalizeNote(input.note);

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      include: { volunteerProfile: true }
    });

    if (isAnonymizedEmail(user.email)) {
      throw new AppError("No puedes suspender una cuenta anonimizada.", 409);
    }

    if (!user.active || user.accessStatus !== "APPROVED") {
      throw new AppError(
        "Solo puedes suspender cuentas activas y aprobadas.",
        409
      );
    }

    await assertNotLastActiveAdmin(tx, user);

    await tx.user.update({
      where: { id: user.id },
      data: {
        active: false,
        accessStatus: "SUSPENDED",
        accessReviewedAt: new Date(),
        accessReviewedById: input.actorUserId,
        accessReviewNote: note
      }
    });

    await tx.session.deleteMany({
      where: { userId: user.id }
    });
    await tx.passwordResetToken.deleteMany({
      where: { userId: user.id }
    });

    let operationalResult:
      | Awaited<ReturnType<typeof suspendVolunteerOperationalAccess>>
      | undefined;

    if (user.role === "VOLUNTEER" && user.volunteerProfile) {
      operationalResult = await suspendVolunteerOperationalAccess({
        client: tx,
        volunteerId: user.volunteerProfile.id,
        volunteerUserId: user.id,
        actorUserId: input.actorUserId,
        reason: "account_suspended"
      });
    } else if (user.volunteerProfile) {
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

    await recordUserAccountAudit(tx, {
      targetUserId: user.id,
      actorUserId: input.actorUserId,
      action: "SUSPEND",
      note,
      metadata: {
        role: user.role,
        volunteerProfileId: user.volunteerProfile?.id ?? null,
        affectedAssignmentCount:
          operationalResult?.affectedAssignmentCount ?? 0,
        expiredInvitationCount:
          operationalResult?.expiredInvitationCount ?? 0
      }
    });

    const suspendedUser = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: USER_ACCOUNT_SELECT
    });

    return mapUserAccount(suspendedUser);
  });
}

export async function reactivateUserAccount(input: {
  userId: string;
  actorUserId: string;
  note?: string;
  canServeAsPrimary?: boolean;
  canServeAsReplacement?: boolean;
}): Promise<UserAccountDto> {
  if (input.userId === input.actorUserId) {
    throw new AppError("No puedes reactivar tu propia cuenta.", 409);
  }

  const note = normalizeNote(input.note);
  const hasVolunteerCapacity =
    input.canServeAsPrimary === true || input.canServeAsReplacement === true;

  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      include: { volunteerProfile: true }
    });

    if (isAnonymizedEmail(user.email)) {
      throw new AppError("No puedes reactivar una cuenta anonimizada.", 409);
    }

    if (user.accessStatus !== "SUSPENDED") {
      throw new AppError("Solo puedes reactivar cuentas suspendidas.", 409);
    }

    if (user.role === "VOLUNTEER" && !hasVolunteerCapacity) {
      throw new AppError(
        "Selecciona al menos una capacidad operativa para reactivar al voluntario.",
        400
      );
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        active: true,
        accessStatus: "APPROVED",
        accessReviewedAt: new Date(),
        accessReviewedById: input.actorUserId,
        accessReviewNote: note
      }
    });

    let volunteerProfileId = user.volunteerProfile?.id ?? null;
    const canServeAsReplacement = input.canServeAsReplacement === true;

    if (user.role === "VOLUNTEER") {
      if (user.volunteerProfile) {
        await tx.volunteerProfile.update({
          where: { id: user.volunteerProfile.id },
          data: {
            active: true,
            temporaryUnavailable: false,
            canServeAsPrimary: input.canServeAsPrimary === true,
            canServeAsReplacement
          }
        });
      } else {
        const profile = await tx.volunteerProfile.create({
          data: {
            userId: user.id,
            preferredAreas: [],
            active: true,
            temporaryUnavailable: false,
            canServeAsPrimary: input.canServeAsPrimary === true,
            canServeAsReplacement
          },
          select: { id: true }
        });
        volunteerProfileId = profile.id;
      }
    } else if (user.volunteerProfile) {
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

    await recordUserAccountAudit(tx, {
      targetUserId: user.id,
      actorUserId: input.actorUserId,
      action: "REACTIVATE",
      note,
      metadata: {
        role: user.role,
        volunteerProfileId,
        canServeAsPrimary:
          user.role === "VOLUNTEER" ? input.canServeAsPrimary === true : null,
        canServeAsReplacement:
          user.role === "VOLUNTEER" ? canServeAsReplacement : null
      }
    });

    const reactivatedUser = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: USER_ACCOUNT_SELECT
    });

    return {
      account: mapUserAccount(reactivatedUser),
      shouldSyncReplacement:
        user.role === "VOLUNTEER" && canServeAsReplacement && !!volunteerProfileId,
      volunteerProfileId
    };
  });

  if (result.shouldSyncReplacement && result.volunteerProfileId) {
    await syncReplacementVolunteerWithOpenCensuses({
      volunteerProfileId: result.volunteerProfileId,
      actorUserId: input.actorUserId
    });
  }

  return result.account;
}

export async function anonymizeUserAccount(input: {
  userId: string;
  actorUserId: string;
  confirmationEmail: string;
}): Promise<UserAccountDto> {
  if (input.userId === input.actorUserId) {
    throw new AppError("No puedes anonimizar tu propia cuenta.", 409);
  }

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      include: { volunteerProfile: true }
    });

    if (
      user.email.toLowerCase() !== input.confirmationEmail.trim().toLowerCase()
    ) {
      throw new AppError("El correo de confirmación no coincide.", 400);
    }

    if (isAnonymizedEmail(user.email)) {
      throw new AppError("Esta cuenta ya está anonimizada.", 409);
    }

    if (user.active || user.accessStatus === "APPROVED") {
      throw new AppError(
        "Solo puedes anonimizar cuentas inactivas que no estén aprobadas.",
        409
      );
    }

    await assertNotLastActiveAdmin(tx, user);

    await tx.session.deleteMany({
      where: { userId: user.id }
    });
    await tx.passwordResetToken.deleteMany({
      where: { userId: user.id }
    });

    if (user.volunteerProfile) {
      await tx.volunteerProfile.update({
        where: { id: user.volunteerProfile.id },
        data: {
          active: false,
          temporaryUnavailable: true,
          canServeAsPrimary: false,
          canServeAsReplacement: false,
          notes: null,
          transportationNotes: null,
          preferredAreas: []
        }
      });
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        email: `${ANONYMIZED_EMAIL_PREFIX}${user.id}${ANONYMIZED_EMAIL_DOMAIN}`,
        name: ANONYMIZED_NAME,
        phone: `deleted-${user.id}`,
        active: false,
        accessStatus: "SUSPENDED",
        accessReviewedAt: new Date(),
        accessReviewedById: input.actorUserId,
        accessReviewNote: "Cuenta anonimizada por administrador."
      }
    });

    await recordUserAccountAudit(tx, {
      targetUserId: user.id,
      actorUserId: input.actorUserId,
      action: "ANONYMIZE",
      metadata: {
        previousRole: user.role,
        previousAccessStatus: user.accessStatus,
        hadVolunteerProfile: !!user.volunteerProfile
      }
    });

    const anonymizedUser = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: USER_ACCOUNT_SELECT
    });

    return mapUserAccount(anonymizedUser);
  });
}
