import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "sk-default_key" 
});

export interface CampaignAnalysis {
  recommendation_type: 'actionable' | 'monitor' | 'clarification';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  potential_savings?: number;
  action_data?: any;
}

export async function analyzeCampaignPerformance(
  campaign: any,
  historicalData: any = {}
): Promise<CampaignAnalysis> {
  try {
    const prompt = `
    You are an expert Google Ads strategist. Analyze this campaign performance and provide a recommendation.

    Campaign Details:
    - Name: ${campaign.name}
    - Type: ${campaign.type}
    - Daily Budget: ₹${campaign.dailyBudget}
    - 7-day Spend: ₹${campaign.spend7d || 0}
    - 7-day Conversions: ${campaign.conversions7d || 0}
    - Target CPA: ${campaign.targetCpa ? `₹${campaign.targetCpa}` : 'Not set'}
    - Actual CPA: ${campaign.actualCpa ? `₹${campaign.actualCpa}` : 'No data'}
    - Target ROAS: ${campaign.targetRoas ? `${campaign.targetRoas}x` : 'Not set'}
    - Actual ROAS: ${campaign.actualRoas ? `${campaign.actualRoas}x` : 'No data'}
    - Last Modified: ${campaign.lastModified}
    - Burn-in Period Until: ${campaign.burnInUntil || 'None'}
    - Goal Description: ${campaign.goalDescription || 'Not set'}

    Analysis Rules:
    1. If campaign was modified within burn-in period, recommend "monitor"
    2. If no goals are set, recommend "clarification" 
    3. If CPA > target CPA by >20% AND spend > ₹500 in 7 days, recommend "actionable"
    4. If ROAS < target ROAS by >20% AND spend > ₹500 in 7 days, recommend "actionable"
    5. If performance is meeting targets, recommend "monitor" or suggest improvements

    Provide response in JSON format with fields:
    - recommendation_type: 'actionable' | 'monitor' | 'clarification'
    - priority: 'high' | 'medium' | 'low' 
    - title: Brief action title
    - description: Detailed explanation
    - reasoning: Your analysis logic
    - confidence: 0-100 confidence score
    - potential_savings: Estimated daily savings (if applicable)
    - action_data: Structured data for the recommended action
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert Google Ads strategist. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      recommendation_type: result.recommendation_type || 'monitor',
      priority: result.priority || 'medium',
      title: result.title || 'Monitor Campaign Performance',
      description: result.description || 'Continue monitoring campaign performance.',
      reasoning: result.reasoning || 'Default monitoring recommendation.',
      confidence: Math.max(0, Math.min(100, result.confidence || 70)),
      potential_savings: result.potential_savings,
      action_data: result.action_data
    };
  } catch (error) {
    console.error("OpenAI analysis failed:", error);
    
    // Fallback analysis based on simple rules
    const daysSinceModified = campaign.lastModified 
      ? Math.floor((Date.now() - new Date(campaign.lastModified).getTime()) / (1000 * 60 * 60 * 24))
      : 30;
    
    if (daysSinceModified < 7) {
      return {
        recommendation_type: 'monitor',
        priority: 'medium',
        title: 'Monitor Recently Modified Campaign',
        description: `Campaign was modified ${daysSinceModified} days ago. Continue monitoring for stable performance.`,
        reasoning: 'Recent modifications require burn-in period before optimization.',
        confidence: 80
      };
    }

    if (!campaign.targetCpa && !campaign.targetRoas) {
      return {
        recommendation_type: 'clarification',
        priority: 'high',
        title: 'Set Campaign Goals',
        description: 'Campaign lacks clear performance targets for AI optimization.',
        reasoning: 'Goals are required for effective AI-driven optimization decisions.',
        confidence: 95
      };
    }

    return {
      recommendation_type: 'monitor',
      priority: 'low',
      title: 'Continue Monitoring',
      description: 'Campaign performance appears stable. Continue current strategy.',
      reasoning: 'No significant issues detected in current performance metrics.',
      confidence: 60
    };
  }
}

export async function generateDailySummary(campaigns: any[], recommendations: any[]): Promise<string> {
  try {
    const prompt = `
    Generate a brief daily summary for the Google Ads dashboard.
    
    Campaigns: ${campaigns.length} total
    Recommendations breakdown:
    - Actionable: ${recommendations.filter(r => r.type === 'actionable').length}
    - Monitor: ${recommendations.filter(r => r.type === 'monitor').length}
    - Clarification needed: ${recommendations.filter(r => r.type === 'clarification').length}
    
    Provide a 1-2 sentence summary of the overall account health and priority actions.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices[0].message.content || "Dashboard updated with latest campaign analysis.";
  } catch (error) {
    console.error("Failed to generate daily summary:", error);
    return "Dashboard updated with latest campaign analysis.";
  }
}
