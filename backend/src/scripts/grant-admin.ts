import { prisma } from '../prisma';

async function run() {
  const email = process.argv[2]?.toLowerCase().trim();
  if (!email) throw new Error('Usage: npm run admin:grant -- admin@example.com');
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) throw new Error(`No registered user exists for ${email}. Register or log in with that exact email first.`);
  const user = await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  console.log(`Granted ADMIN role to ${user.email}.`);
}
run().catch((error) => { console.error(error.message); process.exit(1); }).finally(() => prisma.$disconnect());
