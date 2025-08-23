import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { formatAIContent } from "@/utils/aiFormatting";

interface RecommendationCardProps {
  recommendation: any;
  onApply: () => void;
  onDismiss: () => void;
}

export default function RecommendationCard({ 
  recommendation, 
  onApply, 
  onDismiss 
}: RecommendationCardProps) {
  const { toast } = useToast();
  const [showDetails, setShowDetails] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const getRecommendationEmoji = (type: string) => {
    switch (type) {
      case 'actionable': return '✅';
      case 'monitor': return '⌛';
      case 'clarification': return '🧐';
      default: return '📋';
    }
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-green-100 text-green-700';
    if (confidence >= 70) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  const handleApply = async () => {
    try {
      setIsApplying(true);
      await apiRequest("POST", `/api/recommendations/${recommendation.id}/apply`);
      toast({
        title: "Recommendation Applied",
        description: "The recommendation has been successfully applied.",
      });
      onApply();
    } catch (error) {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to apply recommendation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleDismiss = async () => {
    try {
      setIsDismissing(true);
      await apiRequest("POST", `/api/recommendations/${recommendation.id}/dismiss`);
      toast({
        title: "Recommendation Dismissed",
        description: "The recommendation has been dismissed.",
      });
      onDismiss();
    } catch (error) {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized", 
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to dismiss recommendation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <>
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{getRecommendationEmoji(recommendation.type)}</div>
            <div>
              <h4 className="font-semibold text-gray-900">{recommendation.title}</h4>
              <p className="text-sm text-gray-600">{recommendation.priority} Priority</p>
            </div>
          </div>
          <div className="text-right">
            <Badge className={getConfidenceBadgeColor(recommendation.confidence)}>
              {recommendation.confidence}% Confidence
            </Badge>
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-700 font-medium mb-2">AI Reasoning ({recommendation.aiModel}):</p>
          <div className="text-sm text-gray-600 leading-relaxed">
            {formatAIContent(recommendation.reasoning)}
          </div>
        </div>

        {/* Campaign Metrics Section - All Available Parameters */}
        <div className="bg-blue-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900 text-sm">Campaign Performance (7 days)</h4>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs text-gray-600 capitalize">{recommendation.campaignType}</span>
            </div>
          </div>
          
          {/* Main Metrics Grid - 4 columns like campaign cards */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <p className="text-xs text-gray-600">Daily Budget</p>
              <p className="font-semibold text-gray-900 text-sm">
                ₹{recommendation.campaignDailyBudget ? parseFloat(recommendation.campaignDailyBudget).toLocaleString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Cost (7d)</p>
              <p className="font-semibold text-gray-900 text-sm">
                ₹{recommendation.campaignSpend7d ? parseFloat(recommendation.campaignSpend7d).toLocaleString() : '0'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Conversions</p>
              <p className="font-semibold text-gray-900 text-sm">{recommendation.campaignConversions7d || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Conv. Value</p>
              <p className="font-semibold text-gray-900 text-sm">
                {recommendation.campaignConversionValue7d && parseFloat(recommendation.campaignConversionValue7d) > 0 ? 
                  `₹${parseFloat(recommendation.campaignConversionValue7d).toLocaleString()}` : 
                  'No data'
                }
              </p>
            </div>
          </div>

          {/* Performance Metrics Grid */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <p className="text-xs text-gray-600">CPA</p>
              <p className="font-semibold text-gray-900 text-sm">
                {recommendation.campaignActualCpa ? `₹${parseFloat(recommendation.campaignActualCpa).toLocaleString()}` : 'No data'}
              </p>
              {recommendation.campaignTargetCpa && (
                <p className="text-xs text-gray-500">Target: ₹{parseFloat(recommendation.campaignTargetCpa).toLocaleString()}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-600">ROAS</p>
              <p className="font-semibold text-gray-900 text-sm">
                {recommendation.campaignActualRoas ? `${parseFloat(recommendation.campaignActualRoas).toFixed(1)}x` : 'No data'}
              </p>
              {recommendation.campaignTargetRoas && (
                <p className="text-xs text-gray-500">Target: {parseFloat(recommendation.campaignTargetRoas).toFixed(1)}x</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-600">Impressions</p>
              <p className="font-semibold text-gray-900 text-sm">
                {recommendation.campaignImpressions7d ? parseInt(recommendation.campaignImpressions7d).toLocaleString() : 'No data'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Clicks</p>
              <p className="font-semibold text-gray-900 text-sm">
                {recommendation.campaignClicks7d ? parseInt(recommendation.campaignClicks7d).toLocaleString() : 'No data'}
              </p>
            </div>
          </div>

          {/* Additional Traffic Metrics Grid */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-gray-600">CTR</p>
              <p className="font-semibold text-gray-900 text-sm">
                {recommendation.campaignCtr7d ? `${(parseFloat(recommendation.campaignCtr7d) * 100).toFixed(2)}%` : 'No data'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Avg. CPC</p>
              <p className="font-semibold text-gray-900 text-sm">
                {recommendation.campaignAvgCpc7d ? `₹${parseFloat(recommendation.campaignAvgCpc7d).toFixed(2)}` : 'No data'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Conv. Rate</p>
              <p className="font-semibold text-gray-900 text-sm">
                {recommendation.campaignConversionRate7d ? `${(parseFloat(recommendation.campaignConversionRate7d) * 100).toFixed(2)}%` : 'No data'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Status</p>
              <p className="font-semibold text-gray-900 text-sm capitalize">{recommendation.campaignStatus || 'Active'}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {recommendation.potentialSavings && (
              <>
                <span className="font-medium">Potential Savings:</span> ₹{recommendation.potentialSavings}/day
              </>
            )}
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleDismiss}
              disabled={isDismissing || isApplying}
            >
              {isDismissing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Dismissing...
                </>
              ) : (
                'Dismiss'
              )}
            </Button>
            {recommendation.type === 'actionable' && (
              <Button 
                size="sm"
                onClick={handleApply}
                disabled={isApplying || isDismissing}
              >
                {isApplying ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Applying...
                  </>
                ) : (
                  'Apply Changes'
                )}
              </Button>
            )}
            {recommendation.type === 'clarification' && (
              <Button size="sm" onClick={() => setShowDetails(true)}>
                Provide Input
              </Button>
            )}
            {recommendation.type === 'monitor' && (
              <Button variant="outline" size="sm" onClick={() => setShowDetails(true)}>
                View Details
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>

    <Dialog open={showDetails} onOpenChange={setShowDetails}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span className="text-2xl">{getRecommendationEmoji(recommendation.type)}</span>
            <span>{recommendation.title}</span>
          </DialogTitle>
          <DialogDescription>
            Detailed AI analysis and recommendations for campaign optimization.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Recommendation Details</h4>
            <div className="text-gray-700">{formatAIContent(recommendation.description)}</div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">AI Analysis ({recommendation.aiModel})</h4>
            <div className="text-gray-700 leading-relaxed">{formatAIContent(recommendation.reasoning)}</div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-gray-900">Priority Level</h4>
              <p className="text-gray-600 capitalize">{recommendation.priority}</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Confidence Score</h4>
              <p className="text-gray-600">{recommendation.confidence}%</p>
            </div>
            {recommendation.potentialSavings && (
              <div className="col-span-2">
                <h4 className="font-medium text-gray-900">Potential Impact</h4>
                <p className="text-gray-600">₹{recommendation.potentialSavings}/day in potential savings</p>
              </div>
            )}
          </div>
          
          {recommendation.actionData && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Technical Details</h4>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                {JSON.stringify(recommendation.actionData, null, 2)}
              </pre>
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={() => setShowDetails(false)}>Close</Button>
            {recommendation.type === 'actionable' && (
              <Button onClick={() => { handleApply(); setShowDetails(false); }}>Apply Changes</Button>
            )}
            {recommendation.type !== 'actionable' && (
              <Button variant="ghost" onClick={() => { handleDismiss(); setShowDetails(false); }}>Dismiss</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
