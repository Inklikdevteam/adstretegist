import OpenAI from "openai";

interface AIProvider {
  name: string;
  generate(prompt: string, context?: any): Promise<AIResponse>;
}

interface AIResponse {
  content: string;
  confidence: number;
  model: string;
  provider: string;
  reasoning?: string;
}

interface ConsensusResult {
  finalRecommendation: string;
  confidence: number;
  agreementLevel: number;
  models: string[];
  reasoning: string;
}

class OpenAIProvider implements AIProvider {
  name = 'OpenAI';
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async generate(prompt: string, context?: any): Promise<AIResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert Google Ads strategist specializing in the Indian market. Always use INR (₹) currency, never USD ($). Provide specific, actionable recommendations with confidence scores. Always respond in JSON format."
          },
          {
            role: "user",
            content: `${prompt}\n\nContext: ${JSON.stringify(context)}\n\nRespond with JSON in this format: {"recommendation": "your recommendation", "confidence": number, "reasoning": "your reasoning"}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        content: result.recommendation || "No recommendation generated",
        confidence: Math.max(0, Math.min(100, result.confidence || 75)),
        model: "gpt-4o",
        provider: this.name,
        reasoning: result.reasoning || "No reasoning provided"
      };
    } catch (error) {
      console.error('OpenAI provider error:', error);
      return {
        content: "Error generating recommendation",
        confidence: 0,
        model: "gpt-4o",
        provider: this.name,
        reasoning: "API error occurred"
      };
    }
  }
}

// Placeholder for future AI providers
class ClaudeProvider implements AIProvider {
  name = 'Claude';

  async generate(prompt: string, context?: any): Promise<AIResponse> {
    // Placeholder implementation - would integrate with Anthropic's Claude API
    return {
      content: "Claude provider not yet implemented",
      confidence: 50,
      model: "claude-3",
      provider: this.name,
      reasoning: "Placeholder response from Claude provider"
    };
  }
}

class PerplexityProvider implements AIProvider {
  name = 'Perplexity';

  async generate(prompt: string, context?: any): Promise<AIResponse> {
    // Placeholder implementation - would integrate with Perplexity API
    return {
      content: "Perplexity provider not yet implemented",
      confidence: 50,
      model: "perplexity-sonar",
      provider: this.name,
      reasoning: "Placeholder response from Perplexity provider"
    };
  }
}

export class MultiAIService {
  private providers: AIProvider[] = [];

  constructor() {
    // Initialize available providers
    if (process.env.OPENAI_API_KEY) {
      this.providers.push(new OpenAIProvider());
    }
    
    // Add other providers when API keys are available
    if (process.env.CLAUDE_API_KEY) {
      this.providers.push(new ClaudeProvider());
    }
    
    if (process.env.PERPLEXITY_API_KEY) {
      this.providers.push(new PerplexityProvider());
    }

    if (this.providers.length === 0) {
      console.warn('No AI providers configured. Check your API keys.');
    }
  }

  async generateWithConsensus(prompt: string, context?: any): Promise<ConsensusResult> {
    if (this.providers.length === 0) {
      throw new Error('No AI providers available');
    }

    // Get responses from all available providers
    const responses = await Promise.allSettled(
      this.providers.map(provider => provider.generate(prompt, context))
    );

    const validResponses = responses
      .filter((result): result is PromiseFulfilledResult<AIResponse> => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(response => response.confidence > 0);

    if (validResponses.length === 0) {
      throw new Error('No valid responses from AI providers');
    }

    // For now, use the highest confidence response as the consensus
    // In a more sophisticated implementation, you could analyze similarities
    const bestResponse = validResponses.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    const averageConfidence = validResponses.reduce((sum, response) => 
      sum + response.confidence, 0
    ) / validResponses.length;

    // Simple agreement calculation - in reality, this would analyze content similarity
    const agreementLevel = validResponses.length === 1 ? 100 : 
      (validResponses.filter(r => r.confidence > 70).length / validResponses.length) * 100;

    return {
      finalRecommendation: bestResponse.content,
      confidence: Math.round(averageConfidence),
      agreementLevel: Math.round(agreementLevel),
      models: validResponses.map(r => `${r.provider}:${r.model}`),
      reasoning: `Consensus from ${validResponses.length} AI model(s). Best response from ${bestResponse.provider} with ${bestResponse.confidence}% confidence. ${bestResponse.reasoning}`
    };
  }

  async generateSingle(prompt: string, provider?: string, context?: any): Promise<AIResponse> {
    let targetProvider = this.providers[0]; // Default to first available

    if (provider) {
      const found = this.providers.find(p => p.name.toLowerCase() === provider.toLowerCase());
      if (found) {
        targetProvider = found;
      }
    }

    if (!targetProvider) {
      throw new Error('No AI provider available');
    }

    return targetProvider.generate(prompt, context);
  }

  getAvailableProviders(): string[] {
    return this.providers.map(p => p.name);
  }

  isAvailable(): boolean {
    return this.providers.length > 0;
  }
}

export const multiAIService = new MultiAIService();