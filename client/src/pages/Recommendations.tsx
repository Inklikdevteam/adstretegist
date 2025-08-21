import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import RecommendationCard from "@/components/RecommendationCard";
import { Button } from "@/components/ui/button";
import { RefreshCw, Brain } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function Recommendations() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Authentication is handled by the Router component

  const { data: recommendations = [], isLoading: recommendationsLoading } = useQuery<any[]>({
    queryKey: ["/api/recommendations"],
    enabled: isAuthenticated,
  });

  const handleRunEvaluation = async () => {
    try {
      await apiRequest("POST", "/api/recommendations/generate");
      await queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      
      toast({
        title: "Evaluation Complete",
        description: "AI recommendations have been generated successfully.",
      });
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
        description: "Failed to run evaluation. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Loading state handled by individual queries

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">AI Recommendations</h2>
              <p className="text-gray-600 mt-1">Smart insights and optimization suggestions</p>
            </div>
            <Button onClick={handleRunEvaluation} className="bg-primary hover:bg-blue-600">
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate New Recommendations
            </Button>
          </div>
        </header>

        <div className="p-6">
          {recommendationsLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-4 w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded mb-2 w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-6">
              {recommendations.map((recommendation: any) => (
                <RecommendationCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  onApply={() => queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] })}
                  onDismiss={() => queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] })}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg p-12 text-center text-gray-500">
              <Brain className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No recommendations available</p>
              <p className="text-sm mt-2 mb-4">Run an evaluation to generate new AI insights</p>
              <Button onClick={handleRunEvaluation}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Generate Recommendations
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}