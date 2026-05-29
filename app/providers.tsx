"use client";

import { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

import { AppQueryProvider } from "@/hooks/use-query-client-provider";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <AppQueryProvider>{children}</AppQueryProvider>
    </SessionProvider>
  );
}
