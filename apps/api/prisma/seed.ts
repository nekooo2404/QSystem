import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

// Seed password for local dev/test accounts only. Production users are
// created through the API with their own passwords — no real credential
// lives in this tracked file.
const SEED_PASSWORD = 'Qsystem-dev-1!';

async function main() {
  const prisma = new PrismaClient();
  const passwordHash = await argon2.hash(SEED_PASSWORD);

  const director = await prisma.user.upsert({
    where: { email: 'director@qsystem.local' },
    update: { passwordHash },
    create: {
      email: 'director@qsystem.local',
      name: 'Director',
      passwordHash,
      role: 'DIRECTOR',
      tenantId: null,
    },
  });

  const dept = await prisma.department.upsert({
    where: { id: 'seed-dept-01' },
    update: {},
    create: {
      id: 'seed-dept-01',
      name: 'Phong Mau',
      tenantId: null,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@qsystem.local' },
    update: { passwordHash },
    create: {
      email: 'manager@qsystem.local',
      name: 'Manager',
      passwordHash,
      role: 'MANAGER',
      tenantId: null,
    },
  });
  await prisma.department.update({
    where: { id: dept.id },
    data: { managerId: manager.id },
  });

  for (const [email, name] of [['employee-a@qsystem.local', 'Employee A'], ['employee-b@qsystem.local', 'Employee B']] as const) {
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: {
        email,
        name,
        passwordHash,
        role: 'EMPLOYEE',
        departmentId: dept.id,
        reportsToId: manager.id,
        tenantId: null,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`seeded: director=${director.email} manager=${manager.email} dept=${dept.name}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
