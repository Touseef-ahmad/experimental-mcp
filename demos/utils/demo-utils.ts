export type DemoFn = () => Promise<void>;

export function title(name: string): void {
  console.log(`\n=== ${name} ===`);
}

export function step(message: string): void {
  console.log(`- ${message}`);
}

export function node(nodeName: string, detail?: string): void {
  const suffix = detail ? ` → ${detail}` : "";
  console.log(`  [node:${nodeName}]${suffix}`);
}

export function thinking(content: string): void {
  const truncated =
    content.length > 150 ? content.slice(0, 150) + "..." : content;
  console.log(`  💭 thinking: ${truncated}`);
}

export function toolCall(name: string, args?: unknown): void {
  const argsStr = args ? JSON.stringify(args) : "";
  const truncatedArgs =
    argsStr.length > 80 ? argsStr.slice(0, 80) + "..." : argsStr;
  console.log(`  🔧 calling: ${name}(${truncatedArgs})`);
}

export function toolResult(name: string, result: string): void {
  const truncated = result.length > 100 ? result.slice(0, 100) + "..." : result;
  console.log(`  ✅ result: ${name} → ${truncated}`);
}

export function edge(from: string, to: string): void {
  console.log(`  ➡️  ${from} → ${to}`);
}

export function printJson(label: string, value: unknown): void {
  console.log(`${label}:`);
  console.log(JSON.stringify(value, null, 2));
}

// Helper to process streaming events and show orchestration
export async function streamWithLogging<T>(
  stream: AsyncIterable<T>,
  options?: { showMessages?: boolean },
): Promise<T | null> {
  let lastState: T | null = null;

  for await (const event of stream) {
    lastState = event;

    // Log each node that executed
    for (const [nodeName, output] of Object.entries(
      event as Record<string, unknown>,
    )) {
      node(nodeName);

      // Check for messages with tool calls or content
      const outputObj = output as {
        messages?: Array<{
          tool_calls?: Array<{ name: string; args: unknown }>;
          content?: string;
          role?: string;
        }>;
      };

      if (outputObj?.messages && Array.isArray(outputObj.messages)) {
        for (const msg of outputObj.messages) {
          // Show tool calls
          if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
            for (const tc of msg.tool_calls) {
              toolCall(tc.name, tc.args);
            }
          }

          // Show tool results
          if (msg.role === "tool" && typeof msg.content === "string") {
            toolResult("tool", msg.content);
          }

          // Show AI thinking (if it's generating content, not tool calls)
          if (
            msg.role === "assistant" &&
            msg.content &&
            !msg.tool_calls?.length
          ) {
            if (options?.showMessages !== false) {
              thinking(
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content),
              );
            }
          }
        }
      }
    }
  }

  return lastState;
}

export async function runDemo(name: string, fn: DemoFn): Promise<void> {
  title(name);
  try {
    await fn();
    step("status=ok");
  } catch (error) {
    step(`status=error message=${(error as Error).message}`);
  }
}
