import { PrismaClient } from '../app/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  // Grant the first admin via ADMIN_GITHUB_LOGINS in .env.
  // We only seed master config: Teams, Projects and Violation Rules.

  const teams = [
    { slug: 'BE', name: 'Backend', description: 'Ruby on Rails backend developers' },
    { slug: 'FE', name: 'Frontend', description: 'React / Angular frontend developers' },
    { slug: 'QA', name: 'QA', description: 'Quality assurance engineers' },
  ]
  const teamMap: Record<string, string> = {}
  for (const t of teams) {
    const team = await prisma.team.upsert({ where: { slug: t.slug }, update: {}, create: t })
    teamMap[t.slug] = team.id
  }

  const projects = [
    { projectCode: 'OHB', name: 'OneHub', type: 'Product' },
    { projectCode: 'OHP', name: 'OneHubPlus', type: 'Product' },
    { projectCode: 'PQ', name: 'PQ-Mobile', type: 'Product' },
    { projectCode: 'SER', name: 'Serendipity', type: 'Product' },
    { projectCode: 'MIG', name: 'Migros', type: 'Product' },
    { projectCode: 'SWS', name: 'Swiss-Ski', type: 'Product' },
    { projectCode: 'SAH', name: 'Sunrise Academy', type: 'Product' },
    { projectCode: 'D2D', name: 'Capita D2D', type: 'Product' },
    { projectCode: 'PRT', name: 'Parato', type: 'Product' },
    { projectCode: 'SHB', name: 'Sunrise Business Hub', type: 'Product' }
  ]
  for (const p of projects) {
    await prisma.project.upsert({ where: { projectCode: p.projectCode }, update: {}, create: p })
  }

  // Rules are tagged with teamId where team-specific; null = applies to all teams
  const rules: Array<{ code: string; category: string; description: string; fineAmount: number; teamSlug?: string }> = [
    // ---- Branching (all teams) ----
    { code: 'SEL_BRANCH002', category: 'Branching', fineAmount: 0,
      description: 'Branch name must follow convention: feature/, fix/, release/, or hotfix/ prefix.' },

    // ---- Pull Request (all teams) ----
    { code: 'SEL_PULL001', category: 'Pull Request', fineAmount: 20,
      description: 'PR missing template essentials — fined per missing point: (1) description with tags, (2) test coverage, (3) new gem references.' },
    { code: 'SEL_PULL002', category: 'Pull Request', fineAmount: 20,
      description: 'PR description lacks a workflow summary for reviewers; required when the diff contains complex logic.' },
    { code: 'SEL_PULL003', category: 'Pull Request', fineAmount: 20,
      description: 'Major new module added without an ERD in the PR description.' },
    { code: 'SEL_PULL004', category: 'Pull Request', fineAmount: 20,
      description: 'PR title missing priority prefix ([HOTFIX]/[FIX]/[RUSH]/[NORMAL]/[WIP]/[RFC]), or changed-file count exceeds the limit for the chosen tag.' },
    { code: 'SEL_PULL005', category: 'Pull Request', fineAmount: 20,
      description: 'Meaningless or single-letter variable names that convey no intent.' },
    { code: 'SEL_PULL006', category: 'Pull Request', fineAmount: 50,
      description: 'Careless typo in a method name or variable that would raise an undefined-method/name error.' },
    { code: 'SEL_PULL008', category: 'Pull Request', fineAmount: 100,
      description: 'Rake task, data migration, or deploy command added in diff but not mentioned in PR description. Developer: Nu. 100 + Approver: Nu. 50 (auto-generated).' },
    { code: 'SEL_PULL009', category: 'Pull Request', fineAmount: 20,
      description: 'Incorrect indentation or spacing — fined per offending file.' },

    // ---- BE-specific Pull Request ----
    { code: 'SEL_PULL007', category: 'Pull Request', fineAmount: 10, teamSlug: 'BE',
      description: 'Predicate method (returns boolean) does not end with ?.' },
    { code: 'SEL_PULL010', category: 'Pull Request', fineAmount: 10, teamSlug: 'BE',
      description: 'Value reused in multiple places not extracted to a named constant.' },
    { code: 'SEL_PULL012', category: 'Pull Request', fineAmount: 20, teamSlug: 'BE',
      description: 'Enum declared in a model without a default value.' },

    // ---- RSpec (BE) ----
    { code: 'SEL_RSPEC002', category: 'RSpec', fineAmount: 20, teamSlug: 'BE',
      description: 'context block added without an opposite negative case (e.g. "with valid params" missing "with invalid params").' },
    { code: 'SEL_RSPEC003', category: 'RSpec', fineAmount: 10, teamSlug: 'BE',
      description: 'Empty line present between different nested block types (describe/context/it).' },
    { code: 'SEL_RSPEC004', category: 'RSpec', fineAmount: 20, teamSlug: 'BE',
      description: 'Sibling blocks of the same type (two it blocks, two context blocks) not separated by an empty line.' },

    // ---- Rails (BE) ----
    { code: 'SEL_RAILS001', category: 'Rails', fineAmount: 20, teamSlug: 'BE',
      description: 'Multi-attribute macro (attr_accessor, validates, etc.) exceeds line length without wrapping arguments one per line.' },
    { code: 'SEL_RAILS002', category: 'Rails', fineAmount: 50, teamSlug: 'BE',
      description: 'Integer enum column in migration lacks a default value and null: false constraint.' },
    { code: 'SEL_RAILS003', category: 'Rails', fineAmount: 20, teamSlug: 'BE',
      description: 'Resource uses a single form/service object for both create and update instead of two separate objects.' },
    { code: 'SEL_RAILS004', category: 'Rails', fineAmount: 30, teamSlug: 'BE',
      description: 'Model class grows past 50 LOC in this diff without being refactored into concerns or service objects.' },
    { code: 'SEL_RAILS005', category: 'Rails', fineAmount: 20, teamSlug: 'BE',
      description: 'Method chain crosses 2 association levels (Law of Demeter violation) — delegate instead.' },
    { code: 'SEL_RAILS006', category: 'Rails', fineAmount: 20, teamSlug: 'BE',
      description: 'Dead or commented-out code kept in the diff without a comment explaining why.' },

    // ---- File Naming (BE) ----
    { code: 'SEL_FNC001', category: 'File Naming', fineAmount: 20, teamSlug: 'BE',
      description: 'Namespace module not pluralized (e.g. module User instead of module Users).' },
    { code: 'SEL_FNC002', category: 'File Naming', fineAmount: 40, teamSlug: 'BE',
      description: 'Namespaced class name repeats the namespace (e.g. Mutations::Users::CreateUser instead of Mutations::Users::Create).' },

    // ---- GraphQL (BE) ----
    { code: 'SEL_GQL001', category: 'GraphQL', fineAmount: 20, teamSlug: 'BE',
      description: 'GraphQL mutation/query has more than 3 arguments not extracted to a separate arguments file.' },
    { code: 'SEL_GQL002', category: 'GraphQL', fineAmount: 20, teamSlug: 'BE',
      description: 'GraphQL argument file not placed inside an attributes folder.' },
    { code: 'SEL_GQL003', category: 'GraphQL', fineAmount: 10, teamSlug: 'BE',
      description: 'GraphQL field/argument type uses a raw scalar string instead of a GraphQL type class.' },
    { code: 'SEL_GQL004', category: 'GraphQL', fineAmount: 10, teamSlug: 'BE',
      description: 'GraphQL field or argument is missing a description.' },
    { code: 'SEL_GQL006', category: 'GraphQL', fineAmount: 20, teamSlug: 'BE',
      description: 'GraphQL enum violates conventions: wrong location, class name doesn\'t end with Enum, graphql_name contains "enum", or not defined dynamically from Rails enum.' },
  ]
  for (const { teamSlug, ...r } of rules) {
    const teamId = teamSlug ? (teamMap[teamSlug] ?? null) : null
    await prisma.violationRule.upsert({
      where: { code: r.code },
      update: { description: r.description, fineAmount: r.fineAmount, category: r.category, teamId },
      create: { ...r, teamId },
    })
  }

  console.log('\nSeed complete — Projects + Violation Rules only.')
  console.log('Developers onboard via GitHub login.')
  console.log('Set ADMIN_GITHUB_LOGINS in .env to bootstrap the first admin (PR Captain).')
}

main().catch(console.error).finally(() => prisma.$disconnect())
