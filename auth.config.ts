import type { NextAuthConfig } from 'next-auth'
import GitHub from 'next-auth/providers/github'

// Edge-safe config — NO database / Prisma imports here.
// Used by middleware (Edge runtime) and extended by auth.ts (Node runtime).
export const authConfig = {
  providers: [
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [GitHub({
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          // Normalize the profile so email is always present, even if the user's
          // GitHub email is private (falls back to the GitHub noreply address).
          profile(profile) {
            const login = profile.login as string
            return {
              id: String(profile.id),
              name: (profile.name as string) ?? login,
              email: (profile.email as string) ?? `${login}@users.noreply.github.com`,
              image: profile.avatar_url as string,
            }
          },
        })]
      : []),
  ],

  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,

  callbacks: {
    // Runs in middleware (Edge) — only validates the existing JWT, no DB.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const onLogin = nextUrl.pathname.startsWith('/login')
      if (onLogin) {
        if (isLoggedIn) return Response.redirect(new URL('/dashboard', nextUrl))
        return true
      }
      // GitHub sync routes use their own Basic Auth — bypass session check
      if (nextUrl.pathname.startsWith('/api/github/')) return true
      return isLoggedIn
    },

    // Pure token → session copy (no DB) — safe for both runtimes.
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).permissions = token.permissions ?? ['DEVELOPER']
        ;(session.user as any).developerId = token.developerId
        ;(session.user as any).avatarUrl = token.avatarUrl
      }
      return session
    },
  },
} satisfies NextAuthConfig
