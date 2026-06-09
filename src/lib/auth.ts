// ── NextAuth v5 Configuration ──
// Provides Google OAuth and credentials-based authentication.
//
// Environment variables required:
//   AUTH_SECRET          — NextAuth secret (generate with: npx auth secret)
//   AUTH_GOOGLE_ID       — Google OAuth client ID
//   AUTH_GOOGLE_SECRET   — Google OAuth client secret
//   OBS_AUTH_USERNAME    — Fallback admin username (for credentials login)
//   OBS_AUTH_PASSWORD    — Fallback admin password (for credentials login)

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = process.env.OBS_AUTH_USERNAME || "admin";
        const password = process.env.OBS_AUTH_PASSWORD || "admin";

        if (
          credentials?.username === username &&
          credentials?.password === password
        ) {
          return { id: "1", name: username, email: `${username}@obs.local` };
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async session({ session }) {
      return session;
    },
    async authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user;
      const isOnLogin = nextUrl.pathname === "/login";
      const isOnApiAuth = nextUrl.pathname.startsWith("/api/auth");
      const isPublic =
        nextUrl.pathname.startsWith("/api/health") ||
        nextUrl.pathname.startsWith("/_next") ||
        nextUrl.pathname === "/favicon.ico";

      // Auth disabled? Allow everything
      if (process.env.OBS_AUTH_ENABLED !== "true") return true;

      // Public paths? Allow
      if (isPublic || isOnApiAuth) return true;

      // On login page? Allow if not logged in, redirect if logged in
      if (isOnLogin) return isLoggedIn ? Response.redirect(new URL("/", nextUrl)) : true;

      // Protected path? Require login
      if (!isLoggedIn) {
        const loginUrl = new URL("/login", nextUrl);
        loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
        return Response.redirect(loginUrl);
      }

      return true;
    },
  },
  trustHost: true,
});