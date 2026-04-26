import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations";
import { apiClient } from "@/lib/api/client";
import { refreshAccessToken } from "@/lib/auth/refresh";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, user object is populated; merge invoice-api tokens into the JWT.
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExpires = user.accessTokenExpires;
        return token;
      }

      // On subsequent requests, check if the invoice-api access token is still valid.
      if (!token.accessToken || !token.accessTokenExpires) return token;

      const expiresAt = new Date(token.accessTokenExpires as string).getTime();
      if (Date.now() < expiresAt - 30_000) {
        // Token still valid (with 30 s buffer).
        return token;
      }

      // Token expired — attempt silent refresh.
      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = (token.role as string) ?? "USER";
      session.accessToken = token.accessToken as string | undefined;
      session.error = token.error as "RefreshAccessTokenError" | undefined;
      return session;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { data, error } = await apiClient.POST("/api/auth/login", {
          body: {
            email: parsed.data.email,
            password: parsed.data.password,
          },
        });

        if (error || !data?.token || !data?.user) return null;

        return {
          id: data.user.id ?? "",
          email: data.user.email ?? "",
          name: data.user.name ?? "",
          role: "USER",
          accessToken: data.token,
          refreshToken: data.refreshToken ?? undefined,
          accessTokenExpires: data.expiresAt ?? undefined,
        };
      },
    }),
  ],
});
