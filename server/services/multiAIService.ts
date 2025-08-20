import OpenAI from "openai";
import Anthropic from '@anthropic-ai/sdk';
import type { Campaign } from "@shared/schema";

// <important_do_not_delete>
const DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";
// </important_do_not_delete>

interface AIProvider {
  name: string;
  isAvailable: boolean;
  model: string;
}

interface AIResponse {
  content: string;
  provider: string;
  model: string;
  confidence: number;
  reasoning: string;
}

interface ConsensusResponse {
  finalRecommendation: string;
  confidence: number;
  agreementLevel: number;
  models: string[];
  individualResponses: AIResponse[];
  reasoning: string;
}

export class MultiAIService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private perplexity: any = null;

  constructor() {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    // Initialize Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }

    // Initialize Perplexity (using fetch for HTTP requests)
    if (process.env.PERPLEXITY_API_KEY) {
      this.perplexity = {
        apiKey: process.env.PERPLEXITY_API_KEY,
        baseUrl: 'https://api.perplexity.ai/chat/completions'
      };
    }
  }

  getAvailableProviders(): string[] {
    const providers: string[] = [];
    if (this.openai) providers.push('OpenAI');
    if (this.anthropic) providers.push('Anthropic');
    if (this.perplexity) providers.push('Perplexity');
    return providers;
  }

  isAvailable(): boolean {
    return this.getAvailableProviders().length > 0;
  }

  async generateSingle(prompt: string, provider: string, campaign: Campaign): Promise<AIResponse> {
    const campaignContext = this.buildCampaignContext(campaign);
    const fullPrompt = `${campaignContext}\n\n${prompt}\n\nProvide a detailed analysis with specific recommendations and confidence score (0-100).`;

    switch (provider.toLowerCase()) {
      case 'openai':
        return await this.generateOpenAI(fullPrompt);
      case 'anthropic':
        return await this.generateAnthropic(fullPrompt);
      case 'perplexity':
        return await this.generatePerplexity(fullPrompt);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async generateWithConsensus(prompt: string, campaign: Campaign): Promise<ConsensusResponse> {
    const availableProviders = this.getAvailableProviders();
    if (availableProviders.length < 2) {
      throw new Error('At least 2 AI providers are required for consensus generation');
    }

    const responses: AIResponse[] = [];
    
    // Generate responses from all available providers
    for (const provider of availableProviders) {
      try {
        const response = await this.generateSingle(prompt, provider, campaign);
        responses.push(response);
      } catch (error) {
        console.error(`Error generating response from ${provider}:`, error);
      }
    }

    if (responses.length < 2) {
      throw new Error('Not enough responses for consensus generation');
    }

    // Generate consensus
    return await this.buildConsensus(responses, campaign);
  }

  private buildCampaignContext(campaign: Campaign): string {
    return `Campaign Analysis Context:
Campaign Name: ${campaign.name}
Type: ${campaign.type}
Status: ${campaign.status}
Daily Budget: $${campaign.dailyBudget}
7-Day Spend: $${campaign.spend7d}
7-Day Conversions: ${campaign.conversions7d}
Actual CPA: ${campaign.actualCpa ? `$${campaign.actualCpa}` : 'N/A'}
Actual ROAS: ${campaign.actualRoas || 'N/A'}
Target CPA: ${campaign.targetCpa ? `$${campaign.targetCpa}` : 'N/A'}
Target ROAS: ${campaign.targetRoas || 'N/A'}
Goal: ${campaign.goalDescription || 'No specific goal set'}`;
  }

  private async generateOpenAI(prompt: string): Promise<AIResponse> {
    if (!this.openai) throw new Error('OpenAI not available');

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content || '';
    
    return {
      content,
      provider: 'OpenAI',
      model: 'gpt-4o',
      confidence: this.extractConfidence(content),
      reasoning: content
    };
  }

  private async generateAnthropic(prompt: string): Promise<AIResponse> {
    if (!this.anthropic) throw new Error('Anthropic not available');

    const response = await this.anthropic.messages.create({
      model: DEFAULT_MODEL_STR, // "claude-sonnet-4-20250514"
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    
    return {
      content,
      provider: 'Anthropic',
      model: DEFAULT_MODEL_STR,
      confidence: this.extractConfidence(content),
      reasoning: content
    };
  }

  private async generatePerplexity(prompt: string): Promise<AIResponse> {
    if (!this.perplexity) throw new Error('Perplexity not available');

    const response = await fetch(this.perplexity.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.perplexity.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are an expert Google Ads strategist. Analyze campaign data and provide optimization recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7,
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    return {
      content,
      provider: 'Perplexity',
      model: 'llama-3.1-sonar-small-128k-online',
      confidence: this.extractConfidence(content),
      reasoning: content
    };
  }

  private extractConfidence(content: string): number {
    // Look for confidence patterns in the response
    const confidenceMatch = content.match(/confidence[:\s]*(\d+)%?/i);
    if (confidenceMatch) {
      return parseInt(confidenceMatch[1]);
    }
    
    // Look for certainty indicators
    const certaintyWords = ['certain', 'confident', 'sure', 'likely', 'probable'];
    const uncertaintyWords = ['uncertain', 'unsure', 'maybe', 'might', 'possibly'];
    
    const lowerContent = content.toLowerCase();
    const certaintyCount = certaintyWords.filter(word => lowerContent.includes(word)).length;
    const uncertaintyCount = uncertaintyWords.filter(word => lowerContent.includes(word)).length;
    
    if (certaintyCount > uncertaintyCount) return 85;
    if (uncertaintyCount > certaintyCount) return 60;
    return 75; // Default confidence
  }

  private async buildConsensus(responses: AIResponse[], campaign: Campaign): Promise<ConsensusResponse> {
    if (!this.openai) throw new Error('OpenAI required for consensus generation');

    // Calculate agreement level based on response similarity
    const agreementLevel = this.calculateAgreementLevel(responses);
    
    // Use OpenAI to synthesize the final consensus
    const consensusPrompt = `Based on the following AI recommendations for campaign "${campaign.name}", provide a final consensus recommendation:

${responses.map((r, i) => `
${r.provider} (Confidence: ${r.confidence}%):
${r.content}
`).join('\n')}

Synthesize these recommendations into a single, actionable recommendation. Consider the confidence levels and identify areas of agreement and disagreement. Provide a confidence score for the final recommendation.`;

    const consensusResponse = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: consensusPrompt }],
      temperature: 0.5,
      max_tokens: 1500,
    });

    const finalRecommendation = consensusResponse.choices[0].message.content || '';
    const averageConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
    
    return {
      finalRecommendation,
      confidence: Math.round(averageConfidence * (agreementLevel / 100)),
      agreementLevel,
      models: responses.map(r => r.provider),
      individualResponses: responses,
      reasoning: `Consensus generated from ${responses.length} AI models with ${agreementLevel}% agreement level.`
    };
  }

  private calculateAgreementLevel(responses: AIResponse[]): number {
    // Simple keyword-based agreement calculation
    const allWords = responses.flatMap(r => 
      r.content.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3)
    );
    
    const wordCounts = new Map<string, number>();
    allWords.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
    
    const commonWords = Array.from(wordCounts.entries())
      .filter(([_, count]) => count >= 2)
      .length;
    
    const totalUniqueWords = wordCounts.size;
    
    return Math.min(100, Math.round((commonWords / totalUniqueWords) * 100 * 1.5));
  }
}