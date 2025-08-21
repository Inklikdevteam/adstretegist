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
    You are a senior Google Ads strategist with 10+ years of experience in the Indian market. Provide SPECIFIC, actionable recommendations.

    CAMPAIGN ANALYSIS:
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

    ANALYSIS REQUIREMENTS:
    1. Analyze campaign name "${campaign.name}" to infer:
       - Business type (e-commerce/service/brand)
       - Product/service category 
       - Target audience demographics
       - Competition level in Indian market

    2. Performance Analysis Rules:
       - If burn-in period active → recommend "monitor"
       - If no goals set → recommend "clarification" 
       - If CPA >20% above target + spend >₹500 → "actionable" with SPECIFIC fixes
       - If ROAS <20% below target + spend >₹500 → "actionable" with exact improvements
       - If meeting targets → suggest SPECIFIC optimizations

    3. Provide SPECIFIC recommendations:
       - Exact keyword suggestions (10-15 keywords with ₹ bid ranges)
       - Precise budget adjustments (exact ₹ amounts)
       - Targeting refinements for Indian market segments
       - Measurable improvement targets with timelines

    JSON Response Format:
    {
      "recommendation_type": "actionable|monitor|clarification",
      "priority": "high|medium|low",
      "title": "Specific action (e.g. 'Add 12 Gift Keywords + Increase Budget 15%')",
      "description": "Actionable description with exact numbers and ₹ amounts",
      "reasoning": "Data-driven reasoning including campaign name analysis",
      "confidence": "0-100",
      "potential_savings": "Monthly savings estimate in ₹",
      "action_data": {
        "specific_changes": ["Exact keywords to add", "Budget: ₹X→₹Y", "Bids: ₹X-Y range"],
        "keywords_to_add": ["keyword1 ₹X-Y CPC", "keyword2 ₹X-Y CPC"],
        "budget_recommendation": "₹X daily (current: ₹${campaign.dailyBudget})",
        "target_improvements": "CPA: ₹X→₹Y, ROAS: X→Y",
        "expected_impact": "X% conversion increase, Y% CPA reduction",
        "timeline": "Results in X days"
      }
    }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert Google Ads strategist specializing in the Indian market. Always use INR (₹) currency, never USD ($). Always respond with valid JSON only."
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
    Generate a strategic daily summary for Google Ads portfolio with specific action priorities.
    
    PORTFOLIO OVERVIEW:
    - Total Campaigns: ${campaigns.length}
    - Actionable Optimizations: ${recommendations.filter(r => r.type === 'actionable').length} campaigns need immediate fixes
    - Monitoring: ${recommendations.filter(r => r.type === 'monitor').length} campaigns stable  
    - Clarification Required: ${recommendations.filter(r => r.type === 'clarification').length} campaigns need goals set
    
    Provide 2-3 sentences highlighting:
    1. Overall portfolio health score (1-10)
    2. #1 priority action with specific impact
    3. Key opportunity with estimated ₹ savings potential
    
    Focus on actionable insights for Indian market campaigns.
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
