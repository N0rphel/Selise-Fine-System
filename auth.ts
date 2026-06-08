import NextAuth from 'next-auth'
import { db } from '@/lib/db'
import { withBaseline } from '@/lib/permissions'
import { authConfig } from './auth.config'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // GitHub is the only provider (defined in authConfig); developers onboard via GitHub.
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user, account, profile }) {
      if (account?.provider !== 'github') return true

      const p = profile as any
      const githubId = String(p?.id ?? '')
      const login = p?.login as string | undefined
      if (!githubId || !login) return false

      const email = user.email ?? `${login}@users.noreply.github.com`
      const name = user.name ?? login
      const avatarUrl = user.image ?? null

      // Env-based admin bootstrap: comma-separated GitHub usernames get ADMIN (PR Owner)
      const adminLogins = (process.env.ADMIN_GITHUB_LOGINS ?? '')
        .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      const isBootstrapAdmin = adminLogins.includes(login.toLowerCase())

      const existing = await db.user.findFirst({ where: { OR: [{ githubId }, { email }] } })

      if (existing) {
        await db.user.update({
          where: { id: existing.id },
          data: {
            githubId, avatarUrl, name,
            // Grant ADMIN if listed in env; never strip existing permissions
            permissions: isBootstrapAdmin
              ? withBaseline([...existing.permissions, 'ADMIN'])
              : withBaseline(existing.permissions),
          },
        })
        return true
      }

      // New user → auto-link to an existing developer profile by GitHub username,
      // otherwise create a fresh developer record. Every user is a developer.
      let developer = await db.developer.findFirst({
        where: { githubUsername: login, deletedAt: null, user: { is: null } },
      })
      if (!developer) {
        developer = await db.developer.create({
          data: {
            employeeId: `GH-${login}`,
            name,
            githubUsername: login,
            department: 'Telco',
            active: true,
          },
        })
      }

      await db.user.create({
        data: {
          name, email, githubId, avatarUrl,
          permissions: isBootstrapAdmin ? ['DEVELOPER', 'ADMIN'] : ['DEVELOPER'],
          developerId: developer.id,
        },
      })
      return true
    },

    async jwt({ token, user, account, trigger }) {
      if (user || account || trigger === 'update') {
        const email = token.email ?? (user as any)?.email
        if (email) {
          const dbUser = await db.user.findUnique({ where: { email } })
          if (dbUser) {
            token.id = dbUser.id
            token.permissions = dbUser.permissions
            token.developerId = dbUser.developerId
            token.avatarUrl = dbUser.avatarUrl
          }
        }
      }
      return token
    },
  },
})
