import { LLMClient } from './llm';

export interface ExtractedTermsResult {
  parties: Array<{ name: string; role: string; wallet?: string }>;
  deliverables: Array<{
    description: string;
    deadline?: string;
    amount?: string;
  }>;
  milestones: Array<{
    name: string;
    description: string;
    amount?: string;
    deadline?: string;
  }>;
  totalAmount?: string;
  currency?: string;
  deadline?: string;
  disputeResolution?: string;
  notes?: string;
  rawText: string;
}

const EXTRACTION_PROMPT = `You are a legal/contract term extractor. Analyze the following deal description 
and extract structured terms. Return a JSON object with the following structure:
{
  "parties": [{ "name": "string", "role": "string", "wallet": "optional solana address" }],
  "deliverables": [{ "description": "string", "deadline": "optional ISO date", "amount": "optional lamports" }],
  "milestones": [{ "name": "string", "description": "string", "amount": "optional lamports", "deadline": "optional ISO date" }],
  "totalAmount": "total in lamports if mentioned",
  "currency": "SOL or USDC",
  "deadline": "overall deadline ISO date if mentioned",
  "disputeResolution": "how disputes should be resolved",
  "notes": "any additional important terms"
}

Deal description:
`;

export async function extractTerms(
  client: LLMClient,
  dealDescription: string,
): Promise<ExtractedTermsResult> {
  const result = await client.chatWithJSON<ExtractedTermsResult>(
    [{ role: 'user', content: EXTRACTION_PROMPT + dealDescription }],
    { temperature: 0.1 },
  );

  return {
    ...result,
    rawText: dealDescription,
  };
}