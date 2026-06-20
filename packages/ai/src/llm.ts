export interface LLMConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
}

export interface ChatMessageParam {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' | 'text' };
}

const defaultConfig: Required<Omit<LLMConfig, 'apiKey'>> & { apiKey?: string } = {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 4096,
  baseUrl: 'https://api.openai.com/v1',
};

export class LLMClient {
  private readonly config: Required<Omit<LLMConfig, 'apiKey'>> & { apiKey?: string };

  constructor(config?: LLMConfig) {
    this.config = {
      apiKey: config?.apiKey ?? defaultConfig.apiKey,
      model: config?.model ?? defaultConfig.model,
      temperature: config?.temperature ?? defaultConfig.temperature,
      maxTokens: config?.maxTokens ?? defaultConfig.maxTokens,
      baseUrl: config?.baseUrl ?? defaultConfig.baseUrl,
    };
  }

  async chat(messages: ChatMessageParam[], options?: ChatOptions): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OPENAI_API_KEY is required for LLM calls.');
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: options?.model ?? this.config.model,
        messages,
        temperature: options?.temperature ?? this.config.temperature,
        max_tokens: options?.maxTokens ?? this.config.maxTokens,
        response_format:
          options?.responseFormat?.type === 'json_object'
            ? { type: 'json_object' }
            : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    return payload.choices?.[0]?.message?.content ?? '';
  }

  async chatWithJSON<T>(
    messages: ChatMessageParam[],
    options?: Omit<ChatOptions, 'responseFormat'>,
  ): Promise<T> {
    const content = await this.chat(messages, {
      ...options,
      responseFormat: { type: 'json_object' },
    });

    return JSON.parse(content) as T;
  }
}

let defaultClient: LLMClient | null = null;

export function getLLMClient(config?: LLMConfig): LLMClient {
  if (!defaultClient || config) {
    defaultClient = new LLMClient(config);
  }
  return defaultClient;
}

export function createLLMClient(config?: LLMConfig): LLMClient {
  return new LLMClient(config);
}
