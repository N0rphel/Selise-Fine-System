import { db } from '@/lib/db'

export interface AssignmentConfig {
  cycleId: string
  reviewersPerProject: number
  maxProjectsPerDeveloper: number
  previousCycleId?: string
}

export async function generateAssignments(config: AssignmentConfig) {
  const { reviewersPerProject, maxProjectsPerDeveloper, previousCycleId } = config

  const [developers, projects] = await Promise.all([
    db.developer.findMany({ where: { active: true, deletedAt: null } }),
    db.project.findMany({ where: { active: true, deletedAt: null } }),
  ])

  const prevSet = new Set<string>()
  if (previousCycleId) {
    const prev = await db.projectAssignment.findMany({
      where: { cycleId: previousCycleId },
      select: { projectId: true, developerId: true },
    })
    prev.forEach(a => prevSet.add(`${a.projectId}:${a.developerId}`))
  }

  const devCount: Record<string, number> = {}
  developers.forEach(d => { devCount[d.id] = 0 })

  const assignments: { projectId: string; developerId: string }[] = []

  const shuffledProjects = [...projects].sort(() => Math.random() - 0.5)

  for (const project of shuffledProjects) {
    const sorted = [...developers]
      .filter(d => devCount[d.id] < maxProjectsPerDeveloper)
      .sort((a, b) => {
        const aScore = devCount[a.id] + (prevSet.has(`${project.id}:${a.id}`) ? 100 : 0) + Math.random() * 0.5
        const bScore = devCount[b.id] + (prevSet.has(`${project.id}:${b.id}`) ? 100 : 0) + Math.random() * 0.5
        return aScore - bScore
      })

    const picked = sorted.slice(0, reviewersPerProject)
    for (const dev of picked) {
      devCount[dev.id]++
      assignments.push({ projectId: project.id, developerId: dev.id })
    }
  }

  return assignments
}
