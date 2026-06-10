import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { isAppError } from "@/services/errors";
import { humanizeErrorMessage } from "@/lib/utils/error-message";

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Revisa los campos capturados e inténtalo de nuevo.",
        issues: error.flatten()
      },
      { status: 422 }
    );
  }

  if (isAppError(error)) {
    return NextResponse.json(
      { error: humanizeErrorMessage(error.message), details: error.details },
      { status: error.statusCode }
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const statusCode =
      error.code === "P2002" || error.code === "P2003"
        ? 409
        : error.code === "P2025"
          ? 404
          : 500;

    return NextResponse.json(
      { error: humanizeErrorMessage(error.message) },
      { status: statusCode }
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      { error: humanizeErrorMessage(error.message) },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: "Ocurrió un error inesperado. Inténtalo de nuevo." },
    { status: 500 }
  );
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}
