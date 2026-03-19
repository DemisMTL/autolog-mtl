import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const records = await prisma.record.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log("App-MTL Latest Records:", JSON.stringify(records, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
