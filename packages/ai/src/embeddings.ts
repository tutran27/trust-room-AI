import { LLMConfig } from './llm';

const DEFAULT_DIMENSION = 64;

function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

function localEmbedding(text: string, dimension = DEFAULT_DIMENSION): number[] {
  const vector = new Array<number>(dimension).fill(0);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    vector[index % dimension]! += code / 255;
  }
  return normalizeVector(vector);
}

export class EmbeddingClient {
  constructor(private readonly config?: LLMConfig) {}

  async embedText(text: string): Promise<number[]> {
    if (!this.config?.apiKey) {
      return localEmbedding(text);
    }

    const response = await fetch(`${this.config.baseUrl ?? 'https://api.openai.com/v1'}/embeddings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding: number[] }>;
    };

    return payload.data?.[0]?.embedding ?? localEmbedding(text);
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embedText(text)));
  }
}

export async function embedText(text: string, config?: LLMConfig): Promise<number[]> {
  return new EmbeddingClient(config).embedText(text);
}

export async function embedTexts(
  texts: string[],
  config?: LLMConfig,
): Promise<number[][]> {
  return new EmbeddingClient(config).embedTexts(texts);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return embedText(text);
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return embedTexts(texts);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const ai = a[i]!;
    const bi = b[i]!;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
