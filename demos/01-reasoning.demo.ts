import { END, START, Annotation, StateGraph } from "@langchain/langgraph";
import { runDemo, step, node, edge } from "./utils/demo-utils.js";

const State = Annotation.Root({
  question: Annotation<string>,
  answer: Annotation<string>,
  trace: Annotation<string[]>,
});

export async function runReasoningDemo(): Promise<void> {
  await runDemo("01 reasoning", async () => {
    const graph = new StateGraph(State)
      .addNode("reason", async (state) => {
        const answer = state.question.toLowerCase().includes("time")
          ? `The current UTC time is ${new Date().toISOString()}`
          : "I reasoned over the question and found a simple answer.";

        return {
          answer,
          trace: [...state.trace, "reason node evaluated question"],
        };
      })
      .addEdge(START, "reason")
      .addEdge("reason", END)
      .compile();

    step("streaming graph execution...");
    edge("START", "reason");

    const stream = await graph.stream({
      question: "Can you tell me the time?",
      answer: "",
      trace: [],
    });

    let result: typeof State.State | null = null;
    for await (const event of stream) {
      result = event as typeof State.State;
      for (const [nodeName, output] of Object.entries(event)) {
        node(nodeName, `produced answer`);
      }
    }

    edge("reason", "END");

    if (result) {
      step(
        `answer: ${(result as { reason?: { answer?: string } }).reason?.answer ?? "N/A"}`,
      );
    }
  });
}
