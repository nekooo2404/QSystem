import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  const director = await prisma.user.upsert({
    where: { email: 'director@qsystem.local' },
    update: {},
    create: {
      email: 'director@qsystem.local',
      name: 'Director',
      passwordHash: 'seed-only-not-a-real-hash',
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
    update: {},
    create: {
      email: 'manager@qsystem.local',
      name: 'Manager',
      passwordHash: 'seed-only-not-a-real-hash',
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
      update: {},
      create: {
        email,
        name,
        passwordHash: 'seed-only-not-a-real-hash',
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
