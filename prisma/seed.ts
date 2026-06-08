import { PrismaClient } from '../app/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  // Grant the first admin via ADMIN_GITHUB_LOGINS in .env.
  // We only seed master config: Projects and Violation Rules.

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

  const rules = [
    { code: 'SEL_BRANCH001', category: 'Branching', description: 'Incorrect branch naming convention', fineAmount: 40 },
    { code: 'SEL_PULL001', category: 'Pull Request', description: 'PR Template Missing — fine per missing item (Description / Test Coverage / New Gem Reference)', fineAmount: 20 },
    { code: 'SEL_PULL002', category: 'Pull Request', description: 'PR not linked to a ticket', fineAmount: 20 },
    { code: 'SEL_PULL003', category: 'Pull Request', description: 'PR merged without required approval', fineAmount: 20 },
    { code: 'SEL_PULL004', category: 'Pull Request', description: 'Wrong PR label used', fineAmount: 20 },
    { code: 'SEL_PULL005', category: 'Pull Request', description: 'PR title does not follow naming convention', fineAmount: 20 },
    { code: 'SEL_PULL006', category: 'Pull Request', description: 'PR too large — exceeds size limit', fineAmount: 50 },
    { code: 'SEL_PULL007', category: 'Pull Request', description: 'Missing code owner review', fineAmount: 50 },
    { code: 'SEL_PULL008', category: 'Pull Request', description: 'Missing required commands — Developer: CHF 100, Approver: CHF 50 (dual violation auto-generated)', fineAmount: 100 },
    { code: 'SEL_PULL009', category: 'Pull Request', description: 'Indentation issues — fine per file', fineAmount: 20 },
    { code: 'SEL_PULL012', category: 'Pull Request', description: 'PR description incomplete or missing key sections', fineAmount: 20 },
    { code: 'SEL_RAILS001', category: 'Rails', description: 'Enum defined without default value', fineAmount: 20 },
    { code: 'SEL_RAILS002', category: 'Rails', description: 'Missing database index on foreign key / queried column', fineAmount: 50 },
    { code: 'SEL_RAILS003', category: 'Rails', description: 'N+1 query issue not resolved', fineAmount: 20 },
    { code: 'SEL_RAILS004', category: 'Rails', description: 'Business logic placed in controller instead of service/model', fineAmount: 30 },
    { code: 'SEL_RAILS005', category: 'Rails', description: 'Missing model validation for required field', fineAmount: 20 },
    { code: 'SEL_RAILS006', category: 'Rails', description: 'Incorrect use of Rails conventions', fineAmount: 20 },
    { code: 'SEL_RSPEC001', category: 'RSpec', description: 'Missing test coverage for new feature or bug fix', fineAmount: 50 },
    { code: 'SEL_RSPEC002', category: 'RSpec', description: 'Flaky or poorly written tests', fineAmount: 20 },
    { code: 'SEL_RSPEC003', category: 'RSpec', description: 'Missing edge case test', fineAmount: 10 },
    { code: 'SEL_RSPEC004', category: 'RSpec', description: 'Test description does not match actual implementation', fineAmount: 20 },
    { code: 'SEL_GQL001', category: 'GraphQL', description: 'Missing field description or documentation', fineAmount: 20 },
    { code: 'SEL_GQL002', category: 'GraphQL', description: 'N+1 query in GraphQL resolver', fineAmount: 20 },
    { code: 'SEL_GQL003', category: 'GraphQL', description: 'Incorrect GraphQL type usage', fineAmount: 10 },
    { code: 'SEL_GQL004', category: 'GraphQL', description: 'Missing authorization check in resolver', fineAmount: 10 },
    { code: 'SEL_GQL006', category: 'GraphQL', description: 'Schema naming convention violation', fineAmount: 20 },
  ]
  for (const r of rules) {
    await prisma.violationRule.upsert({ where: { code: r.code }, update: {}, create: r })
  }

  console.log('\nSeed complete — Projects + Violation Rules only.')
  console.log('Developers onboard via GitHub login.')
  console.log('Set ADMIN_GITHUB_LOGINS in .env to bootstrap the first admin (PR Owner).')
}

main().catch(console.error).finally(() => prisma.$disconnect())
