import { runReasoningDemo } from "./01-reasoning.demo.js";
import { runParallelDemo } from "./02-parallel.demo.js";
import { runHandoffsDemo } from "./03-handoffs.demo.js";
import { runHitlDemo } from "./04-hitl.demo.js";
import { runStructuredOutputDemo } from "./05-structured-output.demo.js";
import { runTracingDemo } from "./06-tracing.demo.js";
import { runToolDiscoveryDemo } from "./07-tool-discovery.demo.js";
import { runMultiStepPlanningDemo } from "./08-multi-step-planning.demo.js";
import { runFailureHandlingDemo } from "./09-failure-handling.demo.js";
import { runLocalModelDemo } from "./10-local-model.demo.js";

const demos: Array<[string, () => Promise<void>]> = [
  ["01", runReasoningDemo],
  ["02", runParallelDemo],
  ["03", runHandoffsDemo],
  ["04", runHitlDemo],
  ["05", runStructuredOutputDemo],
  ["06", runTracingDemo],
  ["07", runToolDiscoveryDemo],
  ["08", runMultiStepPlanningDemo],
  ["09", runFailureHandlingDemo],
  ["10", runLocalModelDemo],
];

const demoMap = new Map(demos);

async function main(): Promise<void> {
  const requested = process.argv[2]?.replace("--demo=", "") ?? "all";

  if (requested !== "all") {
    const selected = demoMap.get(requested);
    if (!selected) {
      throw new Error(
        `Unknown demo '${requested}'. Use one of: ${demos.map(([id]) => id).join(", ")}, all`,
      );
    }
    await selected();
    return;
  }

  for (const [, runDemo] of demos) {
    await runDemo();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
