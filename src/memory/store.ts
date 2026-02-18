import { BaseMessage } from "@langchain/core/messages";

/**
 * Simple in-memory conversation store
 * For production: replace with file-based storage, database, or vector store
 */
export class MemoryStore {
  private messages: BaseMessage[] = [];
  private maxMessages: number;

  constructor(maxMessages: number = 50) {
    this.maxMessages = maxMessages;
  }

  /**
   * Add messages to the conversation history
   */
  addMessages(messages: BaseMessage[]) {
    this.messages.push(...messages);
    
    // Keep only the most recent messages to prevent memory bloat
    if (this.messages.length > this.maxMessages) {
      // Keep system message if present, then keep the most recent messages
      const systemMessages = this.messages.filter(m => m._getType() === "system");
      const otherMessages = this.messages.filter(m => m._getType() !== "system");
      const recentMessages = otherMessages.slice(-this.maxMessages);
      this.messages = [...systemMessages, ...recentMessages];
    }
  }

  /**
   * Get all messages in the conversation
   */
  getMessages(): BaseMessage[] {
    return [...this.messages];
  }

  /**
   * Get the last N messages
   */
  getRecentMessages(count: number): BaseMessage[] {
    return this.messages.slice(-count);
  }

  /**
   * Clear all conversation history
   */
  clear() {
    this.messages = [];
  }

  /**
   * Get the number of messages stored
   */
  getMessageCount(): number {
    return this.messages.length;
  }
}

