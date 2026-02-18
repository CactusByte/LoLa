import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";

/**
 * LLM Configuration
 * Requires OPENAI_API_KEY environment variable
 * Can be set via:
 * - .env file: OPENAI_API_KEY=your-key-here
 * - Environment variable: export OPENAI_API_KEY='your-key-here'
 * - Windows: set OPENAI_API_KEY=your-key-here or $env:OPENAI_API_KEY='your-key-here'
 */
export function createLLM() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is required.\n" +
      "Create a .env file in the project root with: OPENAI_API_KEY=your-key-here\n" +
      "Or set it as an environment variable:\n" +
      "  - Linux/Mac: export OPENAI_API_KEY='your-key-here'\n" +
      "  - Windows PowerShell: $env:OPENAI_API_KEY='your-key-here'\n" +
      "  - Windows CMD: set OPENAI_API_KEY=your-key-here"
    );
  }

  return new ChatOpenAI({
    model: "gpt-4o", // or "gpt-3.5-turbo" for faster/cheaper, "gpt-4-turbo" for balance
    temperature: 0.2,
    // API key is automatically read from OPENAI_API_KEY env var if not specified
  });
}

/**
 * Agent System Prompt
 * Enforce: tool loops allowed, be explicit, don't hallucinate page state.
 */
export function createSystemPrompt(): SystemMessage {
  return new SystemMessage(
    [
      "You are a web-capable agent controlling a real browser via tools.",
      "Rules:",
      "- You may call tools multiple times before finishing.",
      "- If you need page info, use browser_extract_text or screenshot; do not guess.",
      "- When clicking fails or you don't know the selector:",
      "  1. Use browser_find_by_text to find elements by their visible text",
      "  2. Use browser_find_links to see all clickable elements on the page",
      "  3. Then use the returned selector with browser_click",
      "- Prefer stable selectors (input[name=...], button:has-text(...)) when possible.",
      "- If a click doesn't work, try browser_find_by_text first to get the correct selector.",
      "- Keep tool calls minimal and purposeful.",
      "- When done, provide a clear final answer and STOP.",
      "",
      "If the user asks for actions that violate a site's terms or attempt to evade bot detection, refuse that part and suggest compliant alternatives."
    ].join("\n")
  );
}

