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

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';

type Provider = 'groq' | 'openai';

/**
 * Resolve the active provider from the environment. Groq is preferred when a Groq
 * key is present; OpenAI is the fallback. When neither key is set the resolver
 * still returns 'groq' as the nominal provider (its base URL / model are used for
 * defaults), but {@link resolveApiKey} returns undefined and the client is treated
 * as not configured.
 */
function resolveProvider(config?: LLMConfig): Provider {
  if (config?.apiKey) {
    // An explicit key was passed; infer provider from an explicit baseUrl when given.
    const baseUrl = config.baseUrl ?? process.env.LLM_BASE_URL;
    if (baseUrl?.includes('openai.com')) return 'openai';
    if (baseUrl?.includes('groq.com')) return 'groq';
    // No hint — default explicit keys to OpenAI-compatible behavior is ambiguous;
    // prefer Groq defaults only when GROQ_API_KEY is what populated env. Since this
    // branch has an explicit key, fall back to env precedence below.
  }
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'groq';
}

/** Resolve the API key in precedence order: explicit config > GROQ_API_KEY > OPENAI_API_KEY. */
function resolveApiKey(config?: LLMConfig): string | undefined {
  return config?.apiKey ?? process.env.GROQ_API_KEY ?? process.env.OPENAI_API_KEY;
}

/** Resolve the base URL. LLM_BASE_URL overrides everything; otherwise provider default. */
function resolveBaseUrl(config: LLMConfig | undefined, provider: Provider): string {
  if (config?.baseUrl) return config.baseUrl;
  if (process.env.LLM_BASE_URL) return process.env.LLM_BASE_URL;
  return provider === 'groq' ? GROQ_BASE_URL : OPENAI_BASE_URL;
}

/** Resolve the model: explicit config > GROQ_MODEL/OPENAI_MODEL env > provider default. */
function resolveModel(config: LLMConfig | undefined, provider: Provider): string {
  if (config?.model) return config.model;
  if (provider === 'groq') {
    return process.env.GROQ_MODEL ?? process.env.OPENAI_MODEL ?? GROQ_DEFAULT_MODEL;
  }
  return process.env.OPENAI_MODEL ?? process.env.GROQ_MODEL ?? OPENAI_DEFAULT_MODEL;
}

export class LLMClient {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly baseUrl: string;

  constructor(config?: LLMConfig) {
    const provider = resolveProvider(config);
    this.apiKey = resolveApiKey(config);
    this.model = resolveModel(config, provider);
    this.temperature = config?.temperature ?? 0.3;
    this.maxTokens = config?.maxTokens ?? 4096;
    this.baseUrl = resolveBaseUrl(config, provider);
  }

  /** True when an API key is available, i.e. real LLM calls can be made. */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async chat(messages: ChatMessageParam[], options?: ChatOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        'No LLM API key configured. Set GROQ_API_KEY or OPENAI_API_KEY, or guard the call with isConfigured().',
      );
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options?.model ?? this.model,
        messages,
        temperature: options?.temperature ?? this.temperature,
        max_tokens: options?.maxTokens ?? this.maxTokens,
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

/**
 * Return a shared default client. We only cache a CONFIGURED client — if no API key
 * is resolvable yet (e.g. the user hasn't added GROQ_API_KEY to .env), we return a
 * fresh unconfigured client each call and never memoize it. That way, once the key
 * appears in the environment, the very next call builds a real client without any
 * code change or stale-singleton problem. An explicit `config` always builds fresh.
 */
export function getLLMClient(config?: LLMConfig): LLMClient {
  if (config) {
    return new LLMClient(config);
  }
  // Reuse the cached client only when it is actually configured.
  if (defaultClient?.isConfigured()) {
    return defaultClient;
  }
  const client = new LLMClient();
  if (client.isConfigured()) {
    defaultClient = client;
  } else {
    // Don't pin an unconfigured client — the key may be added to the env later.
    defaultClient = null;
  }
  return client;
}

export function createLLMClient(config?: LLMConfig): LLMClient {
  return new LLMClient(config);
}

/**
 * Module-level availability check. Returns true when an LLM API key is resolvable
 * from the environment (GROQ_API_KEY or OPENAI_API_KEY). Lets callers detect
 * availability without constructing a client or catching exceptions.
 */
export function llmAvailable(): boolean {
  return Boolean(resolveApiKey());
}
