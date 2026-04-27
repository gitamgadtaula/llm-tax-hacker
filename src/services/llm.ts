import OpenAI from "openai";
import { config } from "../utils/config";
import { ReceiptAnalysis } from "../types";

interface LLMProvider {
  analyzeReceipt(imageBase64: string): Promise<ReceiptAnalysis>;
}

class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
  }

  async analyzeReceipt(imageBase64: string): Promise<ReceiptAnalysis> {
    const prompt = `Analyze this receipt image and extract the following information:
    - Name of the service/product
    - Merchant who issued the receipt
    - Description if available
    - Type (expense, income, pending, or other)
    - Issue date
    - Category
    - Location if available
    - Notes if available
    - Contact information if available
    - Individual transaction items with names and amounts
    - Tax amount if applicable
    - VAT amount if applicable
    - Refund amount if applicable
    - Other charges if applicable
    - Total amount
    
    Return the data as a JSON object with the following structure:
    {
      "name": "string",
      "merchant": "string",
      "description": "string",
      "type": "expense|income|pending|other",
      "issued_at": "YYYY-MM-DD",
      "category": "string",
      "location": "string or null",
      "note": "string or null",
      "contact": "string or null",
      "transactions": [{"name": "string", "amount": number}],
      "tax": number or null,
      "vat": number or null,
      "refund": number or null,
      "other_charges": number or null,
      "total": number
    }
    
    Important: Calculate the total programmatically from all transaction amounts, taxes, and charges, subtracting any refunds.
    Ensure all numeric values are numbers, not strings. If a field is not found, use null.`;

    try {
      const response = await this.client.chat.completions.create({
        model: config.OPENAI_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_completion_tokens: config.OPENAI_MAX_TOKENS,
        temperature: config.OPENAI_TEMPERATURE,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const result = JSON.parse(content);

      // Calculate total if not provided or verify the provided total
      const transactionTotal =
        result.transactions?.reduce(
          (sum: number, t: any) => sum + (t.amount || 0),
          0,
        ) || 0;
      const calculatedTotal =
        transactionTotal +
        (result.tax || 0) +
        (result.vat || 0) -
        (result.refund || 0) +
        (result.other_charges || 0);

      return {
        ...result,
        total: calculatedTotal,
        issued_at: result.issued_at || new Date().toISOString().split("T")[0],
        type: result.type || "other",
        transactions: result.transactions || [],
        tokenUsage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
          model: config.OPENAI_MODEL,
        },
      };
    } catch (error) {
      console.error("OpenAI API error:", error);
      throw new Error("Failed to analyze receipt");
    }
  }
}

class AnthropicProvider implements LLMProvider {
  async analyzeReceipt(imageBase64: string): Promise<ReceiptAnalysis> {
    // Anthropic implementation would go here
    throw new Error("Anthropic provider not implemented");
  }
}

class OllamaProvider implements LLMProvider {
  async analyzeReceipt(imageBase64: string): Promise<ReceiptAnalysis> {
    // Ollama implementation would go here
    throw new Error("Ollama provider not implemented");
  }
}

export function getLLMProvider(): LLMProvider {
  switch (config.LLM_PROVIDER) {
    case "openai":
      return new OpenAIProvider();
    case "anthropic":
      return new AnthropicProvider();
    case "ollama":
      return new OllamaProvider();
    default:
      throw new Error(`Unsupported LLM provider: ${config.LLM_PROVIDER}`);
  }
}
