import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdmin, withBaseline } from '@/lib/permissions'
import { z } from 'zod'

const VALID_TEAM_ROLES = ['MEMBER', 'REPORTER', 'CAPTAIN', 'FINANCE'] as const

const schema = z.object({
  permissions:     z.array(z.enum(['ADMIN', 'DEVELOPER'])).default([]),
  developerId:     z.string().nullable().optional(),
  teamAssignments: z.array(z.object({
    teamId: z.string().min(1),
    roles:  z.array(z.enum(VALID_TEAM_ROLES)).min(1),
  })).optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const actor = session.user as any
  if (!isAdmin(actor.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { teamAssignments } = parsed.data
  // If developerId is undefined (not sent), keep existing; if null/string, set explicitly
  const devIdProvided = 'developerId' in body
  const developerId   = devIdProvided ? parsed.data.developerId : undefined
  const permissions   = withBaseline(parsed.data.permissions)

  try {
    const result = await db.$transaction(async tx => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          permissions,
          ...(devIdProvided ? { developerId } : {}),
        },
      })

      // Sync team memberships atomically
      const devId = developerId !== undefined ? developerId : updated.developerId
      if (devId && teamAssignments !== undefined) {
        await tx.teamMember.deleteMany({ where: { developerId: devId } })
        if (teamAssignments.length > 0) {
          await tx.teamMember.createMany({
            data: teamAssignments.map(a => ({
              teamId:      a.teamId,
              developerId: devId,
              roles:       a.roles,
            })),
          })
        }
      }

      // Return full user with developer + team memberships for immediate UI update
      return tx.user.findUniqueOrThrow({
        where: { id },
        include: {
          developer: {
            include: {
              teamMembers: {
                include: { team: { select: { id: true, name: true, slug: true } } },
              },
            },
          },
        },
      })
    })

    await db.auditLog.create({
      data: {
        entityType: 'User',
        entityId:   id,
        action:     `Permissions updated to [${permissions.join(', ')}]`,
        userId:     actor.id,
      },
    })

    return NextResponse.json(result)
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'This developer profile is already linked to another user.' }, { status: 409 })
    }
    return NextResponse.json({ error: err?.message ?? 'Failed to save' }, { status: 500 })
  }
}
