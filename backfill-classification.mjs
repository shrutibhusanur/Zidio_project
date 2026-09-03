import "dotenv/config";
import { PrismaClient } from "./app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { classifyFeedback } from "./app/lib/ai.ts";
import { linkFeedbackToThemes } from "./app/lib/themes.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const workspaces = await prisma.workspace.findMany();

  for (const workspace of workspaces) {
    console.log(`\nWorkspace: ${workspace.name}`);

    const themes = await prisma.theme.findMany({
      where: { workspaceId: workspace.id },
      select: { name: true },
    });
    const themeNames = themes.map((t) => t.name);

    const unclassified = await prisma.feedback.findMany({
      where: { workspaceId: workspace.id, sentiment: null },
    });

    console.log(`  ${unclassified.length} unclassified items found`);

    let succeeded = 0;
    let failed = 0;

    for (const item of unclassified) {
      const result = await classifyFeedback(item.content, themeNames);

      if (!result) {
        failed++;
        console.log(`  ✗ Failed: "${item.content.slice(0, 50)}..."`);
        continue;
      }

      try {
  await prisma.feedback.update({
    where: { id: item.id },
    data: {
      sentiment: result.sentiment,
      sentimentScore: result.sentimentScore,
    },
  });
} catch (dbErr) {
  console.log(`  DB write failed, retrying once: ${dbErr.message}`);
  await new Promise((r) => setTimeout(r, 2000));
  await prisma.feedback.update({
    where: { id: item.id },
    data: {
      sentiment: result.sentiment,
      sentimentScore: result.sentimentScore,
    },
  });
}

      if (result.themes?.length) {
        await linkFeedbackToThemes(item.id, result.themes, workspace.id);
      }

      succeeded++;
      // Small delay to be gentle on the free-tier rate limit
      await new Promise((r) => setTimeout(r, 1000));
    }

    console.log(`  Done: ${succeeded} classified, ${failed} failed`);
  }

  console.log("\nBackfill complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });