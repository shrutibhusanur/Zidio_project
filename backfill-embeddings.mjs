import "dotenv/config";
import { PrismaClient } from "./app/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { embedText } from "./app/lib/ai.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const feedbackWithoutEmbedding = await prisma.feedback.findMany({
    where: { embedding: null },
  });

  console.log(`${feedbackWithoutEmbedding.length} items need embeddings`);

  let succeeded = 0;
  let failed = 0;

  for (const item of feedbackWithoutEmbedding) {
    try {
      const vector = await embedText(item.content);
      await prisma.embedding.create({
        data: { feedbackId: item.id, vector },
      });
      succeeded++;
    } catch (err) {
      failed++;
      console.log(`  ✗ Failed: "${item.content.slice(0, 50)}..." — ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`Done: ${succeeded} embedded, ${failed} failed`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });