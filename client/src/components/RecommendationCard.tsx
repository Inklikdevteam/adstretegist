import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

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
    }
  };

  const handleDismiss = async () => {
    try {
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
    }
  };

  return (
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
          <p className="text-sm text-gray-600 leading-relaxed">
            {recommendation.reasoning}
          </p>
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
            >
              Dismiss
            </Button>
            {recommendation.type === 'actionable' && (
              <Button 
                size="sm"
                onClick={handleApply}
              >
                Apply Changes
              </Button>
            )}
            {recommendation.type === 'clarification' && (
              <Button size="sm">
                Provide Input
              </Button>
            )}
            {recommendation.type === 'monitor' && (
              <Button variant="outline" size="sm">
                View Details
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
