/**
 * Chat storage for the OpenAI integration.
 * Uses in-memory storage for demo purposes.
 * For production, wire up to your existing database tables.
 */

interface Conversation {
  id: number;
  title: string;
  createdAt: Date;
}

interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: Date;
}

export interface IChatStorage {
  getConversation(id: number): Promise<Conversation | undefined>;
  getAllConversations(): Promise<Conversation[]>;
  createConversation(title: string): Promise<Conversation>;
  deleteConversation(id: number): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<Message[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<Message>;
}

class InMemoryChatStorage implements IChatStorage {
  private conversations: Conversation[] = [];
  private messages: Message[] = [];
  private nextConvId = 1;
  private nextMsgId = 1;

  async getConversation(id: number) {
    return this.conversations.find(c => c.id === id);
  }

  async getAllConversations() {
    return [...this.conversations].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createConversation(title: string) {
    const conversation: Conversation = {
      id: this.nextConvId++,
      title,
      createdAt: new Date(),
    };
    this.conversations.push(conversation);
    return conversation;
  }

  async deleteConversation(id: number) {
    this.conversations = this.conversations.filter(c => c.id !== id);
    this.messages = this.messages.filter(m => m.conversationId !== id);
  }

  async getMessagesByConversation(conversationId: number) {
    return this.messages
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(conversationId: number, role: string, content: string) {
    const message: Message = {
      id: this.nextMsgId++,
      conversationId,
      role,
      content,
      createdAt: new Date(),
    };
    this.messages.push(message);
    return message;
  }
}

export const chatStorage: IChatStorage = new InMemoryChatStorage();
