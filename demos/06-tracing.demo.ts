import { END, START, Annotation, StateGraph } from "@langchain/langgraph";
import { runDemo, step, node, edge, printJson } from "./utils/demo-utils.js";

const State = Annotation.Root({
  trace: Annotation<string[]>,
  result: Annotation<string>,
});

export async function runTracingDemo(): Promise<void> {
  await runDemo("06 tracing", async () => {
    const graph = new StateGraph(State)
      .addNode("step1", async (state) => ({
        trace: [...state.trace, "entered step1"],
      }))
      .addNode("step2", async (state) => ({
        trace: [...state.trace, "entered step2"],
        result: "done",
      }))
      .addEdge(START, "step1")
      .addEdge("step1", "step2")
      .addEdge("step2", END)
      .compile();

    step("streaming graph execution...");
    edge("START", "step1");

    const stream = await graph.stream({ trace: [], result: "" });

    const traces: string[] = [];
    for await (const event of stream) {
      for (const [nodeName, output] of Object.entries(event)) {
        node(nodeName, `trace updated`);
        const outputObj = output as { trace?: string[] };
        if (outputObj?.trace) {
          traces.push(...outputObj.trace.filter((t) => !traces.includes(t)));
        }

        if (nodeName === "step1") edge("step1", "step2");
        if (nodeName === "step2") edge("step2", "END");
      }
    }

    printJson("collected trace", traces);
  });
}
