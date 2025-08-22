import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShoppingCart, Megaphone, RotateCcw, Calendar, TrendingUp, Brain, Sparkles, AlertCircle } from "lucide-react";
import GoalSettingModal from "./GoalSettingModal";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CampaignCardProps {
  campaign: any;
  onUpdate: () => void;
}

// Format AI content with proper styling
const formatAIContent = (content: string) => {
  if (!content) return content;
  
  // Split content into lines for processing
  const lines = content.split('\n');
  const formattedLines = lines.map((line, index) => {
    // Convert markdown headers
    if (line.startsWith('### ')) {
      return <h3 key={index} className="text-lg font-semibold mt-4 mb-2 text-gray-800">{line.replace('### ', '')}</h3>;
    }
    if (line.startsWith('## ')) {
      return <h2 key={index} className="text-xl font-bold mt-5 mb-3 text-gray-900">{line.replace('## ', '')}</h2>;
    }
    if (line.startsWith('# ')) {
      return <h1 key={index} className="text-2xl font-bold mt-6 mb-4 text-gray-900">{line.replace('# ', '')}</h1>;
    }
    
    // Convert bullet points with better styling
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <div key={index} className="flex items-start ml-1 my-2 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
          <span className="text-blue-600 mr-3 mt-1 text-lg font-bold">•</span>
          <span className="flex-1 text-gray-800">{formatInlineTextAI(line.replace(/^[•-]\s+/, ''))}</span>
        </div>
      );
    }
    
    // Convert numbered lists with better styling
    const numberedMatch = line.match(/^\d+\.\s+(.+)/);
    if (numberedMatch) {
      return (
        <div key={index} className="flex items-start ml-1 my-2 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-600">
          <span className="text-blue-700 mr-3 font-bold min-w-[2rem] bg-blue-200 px-2 py-1 rounded-full text-center text-sm">{line.match(/^\d+/)?.[0]}</span>
          <span className="flex-1 text-gray-800">{formatInlineTextAI(numberedMatch[1])}</span>
        </div>
      );
    }
    
    // Skip empty lines 
    if (line.trim() === '') {
      return <div key={index} className="h-3"></div>;
    }
    
    // Regular paragraphs with better spacing
    return <p key={index} className="my-3 text-gray-700 leading-relaxed text-base">{formatInlineTextAI(line)}</p>;
  });
  
  return <div className="space-y-2">{formattedLines}</div>;
};

// Format inline text with bold, emphasis, etc.
const formatInlineTextAI = (text: string) => {
  if (!text) return text;
  
  // Split by **bold** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-gray-900 bg-yellow-200 px-2 py-1 rounded-md">{part.slice(2, -2)}</strong>;
    }
    
    // Handle ₹ currency formatting with better styling
    const currencyFormatted = part.replace(/₹(\d+(?:,\d+)*(?:\.\d+)?)/g, '<span class="font-bold text-green-800 bg-green-200 px-2 py-1 rounded-md">₹$1</span>');
    if (currencyFormatted !== part) {
      return <span key={index} dangerouslySetInnerHTML={{ __html: currencyFormatted }} />;
    }
    
    return part;
  });
};

export default function CampaignCard({ campaign, onUpdate }: CampaignCardProps) {
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const { toast } = useToast();

  const getCampaignIcon = (type: string) => {
    switch (type) {
      case 'search': return ShoppingCart;
      case 'display': return RotateCcw;
      case 'shopping': return ShoppingCart;
      default: return Megaphone;
    }
  };

  const getCampaignStatus = (campaign: any) => {
    if (campaign.burnInUntil && new Date(campaign.burnInUntil) > new Date()) {
      return { text: "Monitoring", color: "bg-yellow-100 text-yellow-700" };
    }
    if (!campaign.targetCpa && !campaign.targetRoas) {
      return { text: "Unclear Goals", color: "bg-gray-100 text-gray-700" };
    }
    
    const cpaTarget = parseFloat(campaign.targetCpa || '0');
    const actualCpa = parseFloat(campaign.actualCpa || '0');
    const roasTarget = parseFloat(campaign.targetRoas || '0');
    const actualRoas = parseFloat(campaign.actualRoas || '0');
    
    if ((cpaTarget > 0 && actualCpa <= cpaTarget) || (roasTarget > 0 && actualRoas >= roasTarget)) {
      return { text: "Healthy", color: "bg-green-100 text-green-700" };
    }
    
    return { text: "Needs Attention", color: "bg-red-100 text-red-700" };
  };

  const Icon = getCampaignIcon(campaign.type);
  const status = getCampaignStatus(campaign);
  const hasGoals = campaign.targetCpa || campaign.targetRoas;

  // Generate AI recommendations for this specific campaign
  const generateAIRecommendations = async () => {
    setIsLoadingAI(true);
    try {
      // Try all three AI providers for comprehensive analysis
      const providers = ['OpenAI', 'Anthropic', 'Perplexity'];
      const recommendations = [];

      for (const provider of providers) {
        try {
          const response = await apiRequest("POST", "/api/recommendations/generate-with-provider", {
            campaignId: campaign.id,
            provider,
            prompt: `Provide 3 specific actionable optimization recommendations for campaign "${campaign.name}".`
          });

          if (response?.content) {
            recommendations.push({
              provider,
              content: response.content,
              confidence: response.confidence || 85,
              model: response.model || provider
            });
          }
        } catch (error) {
          console.error(`Error getting ${provider} recommendations:`, error);
          console.error(`Full error details for ${provider}:`, JSON.stringify(error, null, 2));
        }
      }

      if (recommendations.length === 0) {
        // Fallback - generate simple recommendations based on campaign data
        recommendations.push({
          provider: 'AI Analysis',
          content: generateBasicRecommendations(campaign),
          confidence: 75,
          model: 'Smart Analysis'
        });
      }

      setAiRecommendations(recommendations);
      setShowAIRecommendations(true);
    } catch (error) {
      console.error('Error generating AI recommendations:', error);
      toast({
        title: "Error",
        description: "Failed to generate AI recommendations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Basic recommendation fallback
  const generateBasicRecommendations = (campaign: any) => {
    const recommendations = [];
    const spend = parseFloat(campaign.spend7d || '0');
    const conversions = parseInt(campaign.conversions7d || '0');
    const actualCpa = parseFloat(campaign.actualCpa || '0');
    const targetCpa = parseFloat(campaign.targetCpa || '0');

    if (conversions === 0) {
      recommendations.push("• **Improve Ad Relevance**: No conversions detected - review ad copy and landing page alignment");
    }
    
    if (targetCpa > 0 && actualCpa > targetCpa * 1.2) {
      recommendations.push("• **Reduce CPA**: Current CPA is above target - consider lowering bids or improving quality score");
    }
    
    if (spend > 0 && conversions < 5) {
      recommendations.push("• **Optimize Targeting**: Low conversion volume - refine audience targeting and keywords");
    }

    return recommendations.join('\n') || "• **Set Campaign Goals**: Define target CPA and ROAS to get personalized recommendations\n• **Monitor Performance**: Track daily metrics to identify optimization opportunities\n• **Test Ad Variations**: Create multiple ad copies to improve CTR and conversion rates";
  };

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon className="text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{campaign.name}</h4>
                <p className="text-sm text-gray-500 capitalize">{campaign.type} • {campaign.status}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <Badge className={status.color}>
                {status.text}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Campaign Type</p>
              <p className="font-semibold text-gray-900 capitalize">{campaign.type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Daily Budget</p>
              <p className="font-semibold text-gray-900">₹{parseFloat(campaign.dailyBudget).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Cost (7d)</p>
              <p className="font-semibold text-gray-900">₹{parseFloat(campaign.spend7d || '0').toLocaleString()}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Conversions</p>
              <p className="font-semibold text-gray-900">{campaign.conversions7d || campaign.conversions || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Conv. Value</p>
              <p className="font-semibold text-gray-900">
                {campaign.conversionValue && campaign.conversionValue > 0 ? 
                  `₹${parseFloat(campaign.conversionValue).toLocaleString()}` : 
                  'No data'
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">ROAS</p>
              <p className={`font-semibold ${hasGoals ? 'text-green-600' : 'text-gray-700'}`}>
                {campaign.actualRoas ? `${parseFloat(campaign.actualRoas).toFixed(1)}x` : 'No data'}
              </p>
              {campaign.targetRoas && (
                <p className="text-xs text-gray-500">Target: {parseFloat(campaign.targetRoas).toFixed(1)}x</p>
              )}
            </div>
            
            <div>
              <p className="text-sm text-gray-600">CPA</p>
              <p className={`font-semibold ${hasGoals ? 'text-green-600' : 'text-gray-700'}`}>
                {campaign.actualCpa ? `₹${parseFloat(campaign.actualCpa).toLocaleString()}` : 'No data'}
              </p>
              {campaign.targetCpa && (
                <p className="text-xs text-gray-500">Target: ₹{parseFloat(campaign.targetCpa).toLocaleString()}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Target ROAS</p>
              <p className="font-semibold text-gray-900">
                {campaign.targetRoas ? `${parseFloat(campaign.targetRoas).toFixed(1)}x` : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Impressions</p>
              <p className="font-semibold text-gray-900">{campaign.impressions?.toLocaleString() || 'No data'}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Clicks</p>
              <p className="font-semibold text-gray-900">{campaign.clicks?.toLocaleString() || 'No data'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CTR</p>
              <p className="font-semibold text-gray-900">
                {campaign.ctr ? `${(parseFloat(campaign.ctr) * 100).toFixed(2)}%` : 'No data'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg. CPC</p>
              <p className="font-semibold text-gray-900">
                {campaign.avgCpc ? `₹${parseFloat(campaign.avgCpc).toFixed(2)}` : 'No data'}
              </p>
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {campaign.burnInUntil && new Date(campaign.burnInUntil) > new Date()
                  ? `Modified ${Math.floor((Date.now() - new Date(campaign.lastModified).getTime()) / (1000 * 60 * 60 * 24))} days ago • Burn-in period active`
                  : hasGoals 
                    ? "AI Confidence: High Performance"
                    : "Goals needed for AI optimization"
                }
              </span>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={generateAIRecommendations}
                  disabled={isLoadingAI}
                  className="border-purple-500 text-purple-600 hover:bg-purple-50"
                >
                  {isLoadingAI ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                  ) : (
                    <Brain className="w-4 h-4 mr-1" />
                  )}
                  {isLoadingAI ? 'Analyzing...' : 'AI Ideas'}
                </Button>
                {!hasGoals ? (
                  <Button 
                    size="sm"
                    onClick={() => setIsGoalModalOpen(true)}
                  >
                    Set Goals
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setShowDetails(true)}>
                    Details →
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <GoalSettingModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        campaign={campaign}
        onSave={onUpdate}
      />
      
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon className="text-primary" />
              </div>
              <span>{campaign.name}</span>
            </DialogTitle>
            <DialogDescription>
              Detailed campaign performance metrics, goals, and optimization insights.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Campaign Overview</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Campaign Type:</span>
                    <span className="capitalize font-medium">{campaign.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Badge className={status.color}>{status.text}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Daily Budget:</span>
                    <span className="font-medium">₹{parseFloat(campaign.dailyBudget).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Target CPA:</span>
                    <span className="font-medium">{campaign.targetCpa ? `₹${parseFloat(campaign.targetCpa).toLocaleString()}` : 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Target ROAS:</span>
                    <span className="font-medium">{campaign.targetRoas ? `${parseFloat(campaign.targetRoas).toFixed(1)}x` : 'Not set'}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Performance (7 days)</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cost:</span>
                    <span className="font-medium">₹{parseFloat(campaign.spend7d || '0').toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Conversions:</span>
                    <span className="font-medium">{campaign.conversions7d || campaign.conversions || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Conv. Value:</span>
                    <span className="font-medium">
                      {campaign.conversionValue && campaign.conversionValue > 0 ? 
                        `₹${parseFloat(campaign.conversionValue).toLocaleString()}` : 
                        'No data'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CPA:</span>
                    <span className="font-medium">{campaign.actualCpa ? `₹${parseFloat(campaign.actualCpa).toLocaleString()}` : 'No data'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ROAS:</span>
                    <span className="font-medium">{campaign.actualRoas ? `${parseFloat(campaign.actualRoas).toFixed(1)}x` : 'No data'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Traffic Metrics</h4>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Impressions:</span>
                    <span className="font-medium">{campaign.impressions?.toLocaleString() || 'No data'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Clicks:</span>
                    <span className="font-medium">{campaign.clicks?.toLocaleString() || 'No data'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">CTR:</span>
                    <span className="font-medium">
                      {campaign.ctr ? `${(parseFloat(campaign.ctr) * 100).toFixed(2)}%` : 'No data'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg. CPC:</span>
                    <span className="font-medium">
                      {campaign.avgCpc ? `₹${parseFloat(campaign.avgCpc).toFixed(2)}` : 'No data'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {(campaign.targetCpa || campaign.targetRoas) && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Goals & Targets</h4>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    {campaign.targetCpa && (
                      <div>
                        <span className="text-gray-600">Target CPA:</span>
                        <p className="font-medium text-blue-700">₹{parseFloat(campaign.targetCpa).toLocaleString()}</p>
                      </div>
                    )}
                    {campaign.targetRoas && (
                      <div>
                        <span className="text-gray-600">Target ROAS:</span>
                        <p className="font-medium text-blue-700">{parseFloat(campaign.targetRoas).toFixed(1)}x</p>
                      </div>
                    )}
                  </div>
                  {campaign.goalDescription && (
                    <div className="mt-3">
                      <span className="text-gray-600">Goal Description:</span>
                      <p className="text-gray-800 mt-1">{campaign.goalDescription}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Timeline</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>Created: {new Date(campaign.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <TrendingUp className="w-4 h-4" />
                  <span>Last Modified: {new Date(campaign.lastModified || campaign.updatedAt).toLocaleDateString()}</span>
                </div>
                {campaign.burnInUntil && new Date(campaign.burnInUntil) > new Date() && (
                  <div className="flex items-center space-x-2 text-sm text-amber-600">
                    <span>⌛</span>
                    <span>Burn-in period until: {new Date(campaign.burnInUntil).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowDetails(false)}>Close</Button>
              {!hasGoals && (
                <Button onClick={() => { setShowDetails(false); setIsGoalModalOpen(true); }}>Set Goals</Button>
              )}
              {hasGoals && (
                <Button onClick={() => { setShowDetails(false); setIsGoalModalOpen(true); }}>Edit Goals</Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Recommendations Modal */}
      <Dialog open={showAIRecommendations} onOpenChange={setShowAIRecommendations}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Sparkles className="text-purple-600 w-5 h-5" />
              </div>
              <span>AI Recommendations for {campaign.name}</span>
            </DialogTitle>
            <DialogDescription>
              Personalized optimization suggestions from multiple AI models based on your campaign performance.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {aiRecommendations.length > 0 ? (
              <>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-900">Campaign Overview</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700">Type:</span> <span className="capitalize">{campaign.type}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Budget:</span> ₹{parseFloat(campaign.dailyBudget || '0').toLocaleString()}/day
                    </div>
                    <div>
                      <span className="text-blue-700">7-day Spend:</span> ₹{parseFloat(campaign.spend7d || '0').toLocaleString()}
                    </div>
                    <div>
                      <span className="text-blue-700">Conversions:</span> {campaign.conversions7d || 0}
                    </div>
                  </div>
                </div>

                {aiRecommendations.map((rec, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold ${
                          rec.provider === 'OpenAI' ? 'bg-green-500' :
                          rec.provider === 'Anthropic' ? 'bg-orange-500' :
                          rec.provider === 'Perplexity' ? 'bg-blue-500' :
                          'bg-purple-500'
                        }`}>
                          {rec.provider === 'OpenAI' ? 'O' :
                           rec.provider === 'Anthropic' ? 'A' :
                           rec.provider === 'Perplexity' ? 'P' : 'AI'}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{rec.provider} Analysis</h4>
                          <p className="text-sm text-gray-500">Confidence: {rec.confidence}% • {rec.model}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="prose prose-sm max-w-none">
                      <div className="text-gray-700 leading-relaxed">
                        {formatAIContent(rec.content)}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-900">Next Steps</h4>
                  </div>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Review all AI suggestions and prioritize based on your business goals</li>
                    <li>• Test recommendations incrementally to measure impact</li>
                    <li>• Monitor performance for 7-14 days after implementing changes</li>
                    <li>• Use the chat interface for specific follow-up questions</li>
                  </ul>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Generating personalized AI recommendations...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
