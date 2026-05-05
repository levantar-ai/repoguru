export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string;
}

export interface AnthropicResponse {
  content: Array<{ type: 'text'; text: string }>;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}
