const { PrismaClient } = require('@trustroom/db');
const prisma = new PrismaClient();
async function main() {
  const deals = await prisma.deal.findMany({ include: { participants: true } });
  console.log(JSON.stringify(deals, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
