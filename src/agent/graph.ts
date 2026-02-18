import { StateGraph, END, START } from "@langchain/langgraph";
import { MessagesAnnotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { StructuredToolInterface } from "@langchain/core/tools";
import { logger } from "../utils/index.js";

/**
 * LangGraph: ReAct loop
 * State uses MessagesAnnotation (keeps conversation + tool messages).
 */

export function createAgentNode(
  llm: ChatOpenAI,
  tools: StructuredToolInterface[],
  systemMessage: SystemMessage
) {
  return async function agentNode(state: typeof MessagesAnnotation.State) {
    const userMessages = state.messages.filter(m => m._getType() === "human");
    const lastUserMessage = userMessages[userMessages.length - 1];
    
    if (lastUserMessage) {
      logger.agent("Processing user request", {
        message: lastUserMessage.content,
        conversationLength: state.messages.length
      });
    }

    logger.agent("Calling LLM to generate response...");
    const bound = llm.bindTools(tools);
    const response = await bound.invoke([systemMessage, ...state.messages]);
    
    // @ts-ignore (tool_calls is present on AI messages)
    const toolCalls = response.tool_calls ?? [];
    
    if (toolCalls.length > 0) {
      logger.agent(`Planning to use ${toolCalls.length} tool(s)`, {
        tools: toolCalls.map((tc: any) => ({ name: tc.name, args: tc.args }))
      });
    } else {
      logger.agent("Responding with final answer (no tools needed)");
    }
    
    return { messages: [response] };
  };
}

export function createToolsNode(tools: StructuredToolInterface[]) {
  return async function toolsNode(state: typeof MessagesAnnotation.State) {
    // LangGraph has a prebuilt ToolNode in some versions, but implementing manually is straightforward:
    const last = state.messages[state.messages.length - 1];

    // If model didn't request tools, nothing to do
    // @ts-ignore (tool_calls is present on AI messages)
    const toolCalls = last?.tool_calls ?? [];
    if (!toolCalls.length) return { messages: [] };

    logger.tool(`Executing ${toolCalls.length} tool call(s)`);
    const results = [];
    for (const call of toolCalls) {
      const name = call.name as string;
      const args = call.args as Record<string, any>;
      const t = tools.find((x) => x.name === name);
      
      if (!t) {
        logger.error(`Unknown tool: ${name}`);
        results.push({
          role: "tool",
          name,
          content: `ERROR: unknown tool "${name}"`,
          tool_call_id: call.id,
        });
        continue;
      }
      
      try {
        logger.tool(`Calling ${name}`, { args });
        const startTime = Date.now();
        const out = await t.invoke(args);
        const duration = Date.now() - startTime;
        
        const resultStr = typeof out === "string" ? out : JSON.stringify(out);
        const resultPreview = resultStr.length > 200 
          ? resultStr.substring(0, 200) + "..." 
          : resultStr;
        
        logger.tool(`✓ ${name} completed in ${duration}ms`, { 
          result: resultPreview 
        });
        
        results.push({
          role: "tool",
          name,
          content: resultStr,
          tool_call_id: call.id,
        });
      } catch (e: any) {
        logger.error(`✗ ${name} failed: ${e?.message ?? String(e)}`);
        results.push({
          role: "tool",
          name,
          content: `ERROR running tool "${name}": ${e?.message ?? String(e)}`,
          tool_call_id: call.id,
        });
      }
    }

    return { messages: results };
  };
}

/**
 * Decide whether to continue:
 * - If the last assistant message contains tool calls => go to tools
 * - Else => END
 */
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const last = state.messages[state.messages.length - 1] as any;
  const toolCalls = last?.tool_calls ?? [];
  const nextStep = toolCalls.length ? "tools" : END;
  
  if (nextStep === "tools") {
    logger.step("→ Routing to tools node");
  } else {
    logger.step("→ Routing to END (conversation complete)");
  }
  
  return nextStep;
}

/**
 * Build the graph
 */
export function createGraph(
  llm: ChatOpenAI,
  tools: StructuredToolInterface[],
  systemMessage: SystemMessage
) {
  const agentNode = createAgentNode(llm, tools, systemMessage);
  const toolsNode = createToolsNode(tools);

  return new StateGraph(MessagesAnnotation)
    .addNode("agent", agentNode)
    .addNode("tools", toolsNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, ["tools", END])
    .addEdge("tools", "agent")
    .compile();
}

