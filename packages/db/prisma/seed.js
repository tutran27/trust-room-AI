const bs58 = require('bs58');
const nacl = require('tweetnacl');
const { PrismaClient, DealStatus, EscrowStatus, DisputeStatus } = require('../generated/client');

const prisma = new PrismaClient();

const DEMO_SEED = Uint8Array.from([
  17, 34, 51, 68, 85, 102, 119, 136,
  153, 170, 187, 204, 221, 238, 1, 18,
  35, 52, 69, 86, 103, 120, 137, 154,
  171, 188, 205, 222, 239, 2, 19, 36,
]);

const demoWallet = bs58.encode(nacl.sign.keyPair.fromSeed(DEMO_SEED).publicKey);
const sellerWallet = '9xQeWvG816bUx9EPjHmaT23yvVM6Vx9vVYVn2qfB8P6N';
const arbiterWallet = '7Ytt1sJ9gLxA3XQ4nS8VfN2hP6mK4dR7cT5wU9eB2kLm';

async function ensureWallet(address) {
  const existing = await prisma.wallet.findUnique({ where: { address } });
  if (existing) return existing;
  const user = await prisma.user.create({ data: {} });
  return prisma.wallet.create({ data: { address, userId: user.id } });
}

async function main() {
  await ensureWallet(demoWallet);
  await ensureWallet(sellerWallet);
  await ensureWallet(arbiterWallet);

  await prisma.notification.deleteMany({
    where: {
      OR: [{ title: 'Demo seed ready' }, { title: 'Scam Guard sample alert' }],
    },
  });
  await prisma.dispute.deleteMany({ where: { id: 'demo-dispute-1' } });
  await prisma.deal.deleteMany({
    where: { id: { in: ['demo-draft-deal', 'demo-funded-deal'] } },
  });

  const draftDeal = await prisma.deal.create({
    data: {
      id: 'demo-draft-deal',
      title: 'Website redesign milestone payout',
      description:
        'Buyer pays in USDC after seller delivers Figma + landing page implementation. Demo draft deal for create/update/publish flow.',
      type: 'freelance_service',
      amount: '1500',
      token: 'USDC',
      status: DealStatus.Draft,
      participants: {
        create: [{ walletAddress: demoWallet, role: 'buyer', confirmed: true }],
      },
      events: {
        create: [{ actorWallet: demoWallet, type: 'deal.created', metadata: { source: 'seed' } }],
      },
    },
  });

  const fundedDeal = await prisma.deal.create({
    data: {
      id: 'demo-funded-deal',
      title: 'OTC USDC purchase with live negotiation',
      description:
        'Seeded active deal to exercise realtime chat, escrow transitions, AI monitor, and dispute handling.',
      type: 'token_otc',
      amount: '2500',
      token: 'USDC',
      status: DealStatus.Deposited,
      version: 3,
      participants: {
        create: [
          { walletAddress: demoWallet, role: 'buyer', confirmed: true },
          { walletAddress: sellerWallet, role: 'seller', confirmed: true },
        ],
      },
      events: {
        create: [
          { actorWallet: demoWallet, type: 'deal.created', metadata: { source: 'seed' } },
          { actorWallet: demoWallet, type: 'deal.published', metadata: { source: 'seed' } },
          { actorWallet: sellerWallet, type: 'wallet.verified', metadata: { source: 'seed' } },
        ],
      },
      escrow: {
        create: {
          amount: '2500',
          sellerAddress: sellerWallet,
          status: EscrowStatus.Funded,
          txSignature: 'SIMSEEDEDESCROWTX001',
        },
      },
    },
  });

  const dispute = await prisma.dispute.create({
    data: {
      id: 'demo-dispute-1',
      dealId: fundedDeal.id,
      raisedBy: demoWallet,
      reason: 'Quality disagreement',
      status: DisputeStatus.Open,
      aiSummary:
        'Buyer states the deliverable is incomplete; seller claims milestone was delivered. Demo dispute record.',
    },
  });

  await prisma.evidence.create({
    data: {
      disputeId: dispute.id,
      type: 'text',
      content:
        'Transcript excerpt: seller requested early release before final source files were delivered.',
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        wallet: demoWallet,
        type: 'SystemMessage',
        title: 'Demo seed ready',
        message: 'Demo wallet has seeded deals, escrow, and a dispute to explore.',
      },
      {
        wallet: demoWallet,
        type: 'AiAlert',
        title: 'Scam Guard sample alert',
        message: 'A seeded alert exists so the dashboard is not empty on first run.',
        dealId: fundedDeal.id,
      },
    ],
  });

  await prisma.reputation.upsert({
    where: { wallet: demoWallet },
    update: {
      completedDeals: 4,
      successfulDeals: 3,
      disputedDeals: 1,
      totalVolume: '8200',
      score: 0.62,
    },
    create: {
      wallet: demoWallet,
      completedDeals: 4,
      successfulDeals: 3,
      disputedDeals: 1,
      totalVolume: '8200',
      score: 0.62,
    },
  });

  await prisma.reputation.upsert({
    where: { wallet: sellerWallet },
    update: {
      completedDeals: 9,
      successfulDeals: 8,
      disputedDeals: 1,
      totalVolume: '15400',
      score: 0.81,
    },
    create: {
      wallet: sellerWallet,
      completedDeals: 9,
      successfulDeals: 8,
      disputedDeals: 1,
      totalVolume: '15400',
      score: 0.81,
    },
  });

  await prisma.reputation.upsert({
    where: { wallet: arbiterWallet },
    update: {
      completedDeals: 14,
      successfulDeals: 14,
      disputedDeals: 0,
      totalVolume: '42300',
      score: 0.93,
    },
    create: {
      wallet: arbiterWallet,
      completedDeals: 14,
      successfulDeals: 14,
      disputedDeals: 0,
      totalVolume: '42300',
      score: 0.93,
    },
  });

  console.log('Seed completed.');
  console.log(`Demo wallet: ${demoWallet}`);
  console.log(`Seller wallet: ${sellerWallet}`);
  console.log(`Draft deal: ${draftDeal.id}`);
  console.log(`Funded deal: ${fundedDeal.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
