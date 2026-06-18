import { END, START, Annotation, StateGraph } from "@langchain/langgraph";
import {
  runDemo,
  step,
  node,
  edge,
  thinking,
  printJson,
} from "./utils/demo-utils.js";

const State = Annotation.Root({
  goal: Annotation<string>,
  plan: Annotation<string[]>,
  executed: Annotation<string[]>,
  done: Annotation<boolean>,
});

export async function runMultiStepPlanningDemo(): Promise<void> {
  await runDemo("08 multi-step planning", async () => {
    const graph = new StateGraph(State)
      .addNode("planner", async (state) => ({
        plan: [
          `analyze goal: ${state.goal}`,
          "collect employee signals",
          "calculate engagement trend",
          "generate report",
        ],
      }))
      .addNode("execute", async (state) => {
        if (state.plan.length === 0) {
          return { done: true };
        }

        const [next, ...remaining] = state.plan;
        return {
          plan: remaining,
          executed: [...state.executed, next],
          done: remaining.length === 0,
        };
      })
      .addEdge(START, "planner")
      .addEdge("planner", "execute")
      .addConditionalEdges("execute", (state) => (state.done ? END : "execute"))
      .compile();

    step("streaming planning execution...");
    edge("START", "planner");

    const stream = await graph.stream({
      goal: "prepare engagement report",
      plan: [],
      executed: [],
      done: false,
    });

    let executionCount = 0;
    for await (const event of stream) {
      for (const [nodeName, output] of Object.entries(event)) {
        const outputObj = output as {
          plan?: string[];
          executed?: string[];
          done?: boolean;
        };

        if (nodeName === "planner") {
          node(nodeName, `created ${outputObj.plan?.length ?? 0} steps`);
          if (outputObj.plan) {
            for (const planStep of outputObj.plan) {
              thinking(`planned: ${planStep}`);
            }
          }
          edge("planner", "execute");
        }

        if (nodeName === "execute") {
          executionCount++;
          const lastExecuted =
            outputObj.executed?.[outputObj.executed.length - 1];
          node(nodeName, `step ${executionCount}: ${lastExecuted ?? "none"}`);

          if (outputObj.done) {
            edge("execute", "END");
          } else {
            edge("execute", "execute (loop)");
          }
        }
      }
    }

    step(`total execution loops: ${executionCount}`);
  });
}
