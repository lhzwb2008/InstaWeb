import EventEmitter from 'events';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getApiKey } from '../utils/config.js';

/**
 * Handler for OpenRouter API communication with Claude 3.7
 * Extends EventEmitter to emit events during streaming
 */
export class OpenRouterApiHandler extends EventEmitter {
  private client: OpenAI;
  private apiKey: string;
  
  /**
   * Create a new OpenRouterApiHandler
   * @param apiKey The OpenRouter API key (optional, will use config if not provided)
   */
  constructor(apiKey?: string) {
    super();
    
    // Use provided API key or get from config
    this.apiKey = apiKey || getApiKey();
    
    // Validate API key format
    if (!this.apiKey || this.apiKey.trim() === '') {
      throw new Error('API key is required. Please provide an API key or set it in the config file.');
    }
    
    // Log for debugging
    console.log(`Using API key: ${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}`);
    
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: this.apiKey,
      defaultHeaders: {
        "HTTP-Referer": "https://instaweb.example.com",
        "X-Title": "InstaWeb - WebApp Generator",
      },
    });
  }
  
  /**
   * Create a chat completion with the OpenRouter API using Claude 3.7
   * @param systemPrompt The system prompt
   * @param messages The conversation history
   * @param model The model to use (defaults to Claude-3.7-Sonnet)
   * @param max_tokens The maximum number of tokens to generate (optional)
   * @returns The generated text
   */
  async createChatCompletion(
    systemPrompt: string, 
    messages: Array<{role: string, content: string}>,
    model: string = "anthropic/claude-3.7-sonnet",
    max_tokens?: number
  ): Promise<string> {
    try {
      // Format messages for OpenRouter API
      const formattedMessages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({
          role: m.role === 'user' ? 'user' : 
                m.role === 'assistant' ? 'assistant' : 
                m.role === 'system' ? 'system' : 'user',
          content: m.content
        })) as ChatCompletionMessageParam[]
      ];
      
      // Print request details for debugging
      console.log("\n=== REQUEST DETAILS ===");
      console.log("URL:", "https://openrouter.ai/api/v1/chat/completions");
      console.log("Headers:");
      console.log({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}`,
        'HTTP-Referer': 'https://instaweb.example.com',
        'X-Title': 'InstaWeb - WebApp Generator'
      });
      console.log("Body:");
      console.log(JSON.stringify({
        model: model,
        messages: formattedMessages,
        max_tokens: max_tokens,
        stream: true,
      }, null, 2));
      console.log("======================\n");
      
      // Create the completion with streaming
      const stream = await this.client.chat.completions.create({
        model: model,
        messages: formattedMessages,
        max_tokens: max_tokens,
        stream: true,
      });
      
      let result = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          result += content;
          this.emit('data', content);
        }
      }
      
      return result;
    } catch (error) {
      console.error('OpenRouter API Error:', error);
      throw error;
    }
  }

  /**
   * Create a chat completion with online search capability
   * @param systemPrompt The system prompt
   * @param messages The conversation history
   * @param model The model to use (defaults to Claude-3.7-Sonnet:online)
   * @param max_tokens The maximum number of tokens to generate (optional)
   * @returns The generated text
   */
  async createChatCompletionWithSearch(
    systemPrompt: string, 
    messages: Array<{role: string, content: string}>,
    model: string = "anthropic/claude-3.7-sonnet:online",
    max_tokens?: number
  ): Promise<string> {
    try {
      // Format messages for OpenRouter API
      const formattedMessages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({
          role: m.role === 'user' ? 'user' : 
                m.role === 'assistant' ? 'assistant' : 
                m.role === 'system' ? 'system' : 'user',
          content: m.content
        })) as ChatCompletionMessageParam[]
      ];
      
      // Print request details for debugging
      console.log("\n=== REQUEST DETAILS ===");
      console.log("URL:", "https://openrouter.ai/api/v1/chat/completions");
      console.log("Headers:");
      console.log({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}`,
        'HTTP-Referer': 'https://instaweb.example.com',
        'X-Title': 'InstaWeb - WebApp Generator'
      });
      console.log("Body:");
      console.log(JSON.stringify({
        model: model,
        messages: formattedMessages,
        max_tokens: max_tokens,
        stream: true,
      }, null, 2));
      console.log("======================\n");
      
      // Create the completion with streaming and online search
      const stream = await this.client.chat.completions.create({
        model: model, // Use the online version of Claude 3.7
        messages: formattedMessages,
        max_tokens: max_tokens,
        stream: true,
      });
      
      let result = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          result += content;
          this.emit('data', content);
        }
      }
      
      return result;
    } catch (error) {
      console.error('OpenRouter API Error:', error);
      throw error;
    }
  }
  
  /**
   * Get the API key
   * @returns The API key
   */
  getApiKey(): string {
    return this.apiKey;
  }
}
