import { notFound } from "next/navigation";

import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { getPasswordResetTokenState } from "@/services/auth.service";

type ResetPasswordPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ResetPasswordPage({
  params
}: ResetPasswordPageProps) {
  const { token } = await params;
  const tokenState = await getPasswordResetTokenState(token);

  if (!tokenState.valid) {
    notFound();
  }

  return <ResetPasswordForm token={token} />;
}
