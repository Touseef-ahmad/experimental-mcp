import { END, START, Annotation, StateGraph } from "@langchain/langgraph";
import { runDemo, step, node, edge, toolResult } from "./utils/demo-utils.js";

const State = Annotation.Root({
  attempts: Annotation<number>,
  status: Annotation<"ok" | "failed">,
  trace: Annotation<string[]>,
});

function flakyTool(attempt: number): string {
  if (attempt < 2) {
    throw new Error("transient tool failure");
  }
  return "tool success";
}

export async function runFailureHandlingDemo(): Promise<void> {
  await runDemo("09 failure handling", async () => {
    const graph = new StateGraph(State)
      .addNode("executeWithRetry", async (state) => {
        try {
          const output = flakyTool(state.attempts + 1);
          return {
            attempts: state.attempts + 1,
            status: "ok",
            trace: [...state.trace, output],
          };
        } catch (error) {
          return {
            attempts: state.attempts + 1,
            status: "failed",
            trace: [...state.trace, `error=${(error as Error).message}`],
          };
        }
      })
      .addEdge(START, "executeWithRetry")
      .addConditionalEdges("executeWithRetry", (state) => {
        if (state.status === "ok") {
          return END;
        }
        return state.attempts >= 2 ? END : "executeWithRetry";
      })
      .compile();

    step("streaming execution with retry logic...");
    edge("START", "executeWithRetry");

    const stream = await graph.stream({
      attempts: 0,
      status: "failed",
      trace: [],
    });

    for await (const event of stream) {
      for (const [nodeName, output] of Object.entries(event)) {
        const outputObj = output as {
          attempts?: number;
          status?: string;
          trace?: string[];
        };
        const attempt = outputObj.attempts ?? 0;
        const status = outputObj.status ?? "unknown";
        const lastTrace = outputObj.trace?.[outputObj.trace.length - 1];

        node(nodeName, `attempt ${attempt} → ${status}`);

        if (lastTrace?.startsWith("error=")) {
          toolResult("flakyTool", `❌ ${lastTrace}`);
          if (attempt < 2) {
            edge(nodeName, "executeWithRetry (retry)");
          }
        } else if (lastTrace) {
          toolResult("flakyTool", `✅ ${lastTrace}`);
          edge(nodeName, "END");
        }
      }
    }

    step("retry pattern: fail → fail → success (or max attempts)");
  });
}
