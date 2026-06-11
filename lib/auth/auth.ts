import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { db } from "@/lib/db/prisma";
import { getSessionSecret } from "@/lib/env/config";
import { ensureServerEnvLoaded } from "@/lib/env/load-env";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/auth/password";

ensureServerEnvLoaded();

export const authOptions: NextAuthOptions = {
  secret: getSessionSecret(),
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: { volunteerProfile: true }
        });

        if (!user || !user.active) return null;

        const validPassword = await verifyPassword(
          parsed.data.password,
          user.passwordHash
        );

        if (!validPassword) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          volunteerProfileId: user.volunteerProfile?.id ?? null
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.volunteerProfileId = user.volunteerProfileId ?? null;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role ?? "VOLUNTEER";
        session.user.volunteerProfileId = token.volunteerProfileId ?? null;
      }

      return session;
    }
  }
};

export function getServerAuthSession() {
  return getServerSession(authOptions).then(async (session) => {
    if (!session?.user) return session;

    const userById = session.user.id
      ? await db.user.findUnique({
          where: { id: session.user.id },
          include: { volunteerProfile: true }
        })
      : null;

    const currentUser =
      userById ??
      (session.user.email
        ? await db.user.findUnique({
            where: { email: session.user.email.toLowerCase() },
            include: { volunteerProfile: true }
          })
        : null);

    if (!currentUser || !currentUser.active) {
      return null;
    }

    session.user.id = currentUser.id;
    session.user.name = currentUser.name;
    session.user.email = currentUser.email;
    session.user.role = currentUser.role;
    session.user.volunteerProfileId = currentUser.volunteerProfile?.id ?? null;

    return session;
  });
}
