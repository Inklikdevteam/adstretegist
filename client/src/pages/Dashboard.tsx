import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/Sidebar";
import MetricsCard from "@/components/MetricsCard";
import RecommendationCard from "@/components/RecommendationCard";
import CampaignCard from "@/components/CampaignCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RefreshCw, TrendingUp, Target, DollarSign, BarChart3, Activity, MessageSquare } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showChatInterface, setShowChatInterface] = useState(false);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: dashboardSummary, isLoading: summaryLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/summary"],
    enabled: isAuthenticated,
  });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<any[]>({
    queryKey: ["/api/campaigns"],
    enabled: isAuthenticated,
  });

  const { data: recommendations = [], isLoading: recommendationsLoading } = useQuery<any[]>({
    queryKey: ["/api/recommendations"],
    enabled: isAuthenticated,
  });

  const { data: auditTrail = [], isLoading: auditLoading } = useQuery<any[]>({
    queryKey: ["/api/audit-trail"],
    enabled: isAuthenticated,
  });

  const handleConnectGoogleAds = async () => {
    try {
      const response = await apiRequest("GET", "/api/google-ads/auth");
      // Open the Google OAuth flow in a new window
      window.open(response.authUrl, 'google_auth', 'width=500,height=600');
      
      // Listen for the OAuth completion
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'GOOGLE_ADS_AUTH_SUCCESS') {
          window.removeEventListener('message', handleMessage);
          toast({
            title: "Success",
            description: "Google Ads account connected successfully!",
          });
          // Refresh the dashboard data
          queryClient.invalidateQueries();
        }
      };
      
      window.addEventListener('message', handleMessage);
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
        description: "Failed to connect Google Ads. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRunEvaluation = async () => {
    try {
      await apiRequest("POST", "/api/recommendations/generate");
      await queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      
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

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const summary = dashboardSummary || {};
  const totalSpend = summary.totalSpend || 0;
  const totalConversions = summary.totalConversions || 0;
  const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const roas = 4.2; // This would be calculated from actual revenue data

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Campaign Dashboard</h2>
              <p className="text-gray-600 mt-1">AI-powered insights and recommendations for your Google Ads</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Last updated: 2 minutes ago</span>
              </div>
              <Button onClick={handleConnectGoogleAds} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
                <Target className="w-4 h-4 mr-2" />
                Connect Google Ads
              </Button>
              <Button onClick={handleRunEvaluation} className="bg-primary hover:bg-blue-600">
                <RefreshCw className="w-4 h-4 mr-2" />
                Run Evaluation
              </Button>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Daily Summary Card */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold mb-2">Today's Smart Recommendations</h3>
                <p className="text-blue-100 text-sm">Generated by AI • {new Date().toLocaleDateString()}</p>
              </div>
              <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold">{summary.activeCampaigns || 0}</div>
                  <div className="text-xs text-blue-100">Active Campaigns</div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">✅</div>
                  <div>
                    <div className="text-lg font-semibold">{summary.recommendations?.actionable || 0}</div>
                    <div className="text-xs text-blue-100">Actionable</div>
                  </div>
                </div>
              </div>
              <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">⌛</div>
                  <div>
                    <div className="text-lg font-semibold">{summary.recommendations?.monitor || 0}</div>
                    <div className="text-xs text-blue-100">Monitor</div>
                  </div>
                </div>
              </div>
              <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">🧐</div>
                  <div>
                    <div className="text-lg font-semibold">{summary.recommendations?.clarification || 0}</div>
                    <div className="text-xs text-blue-100">Need Input</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricsCard
              title="Total Spend"
              value={`₹${totalSpend.toLocaleString()}`}
              change="+12.5%"
              changeType="positive"
              icon={DollarSign}
              iconBgColor="bg-blue-100"
              iconColor="text-primary"
            />
            <MetricsCard
              title="Conversions"
              value={totalConversions.toString()}
              change="+8.3%"
              changeType="positive"
              icon={TrendingUp}
              iconBgColor="bg-green-100"
              iconColor="text-green-600"
            />
            <MetricsCard
              title="Avg. CPA"
              value={`₹${Math.round(avgCpa)}`}
              change="+2.1%"
              changeType="negative"
              icon={Target}
              iconBgColor="bg-yellow-100"
              iconColor="text-yellow-600"
            />
            <MetricsCard
              title="ROAS"
              value={`${roas.toFixed(1)}x`}
              change="+15.2%"
              changeType="positive"
              icon={BarChart3}
              iconBgColor="bg-green-100"
              iconColor="text-green-600"
            />
          </div>

          {/* AI Recommendations & Campaign Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Priority Recommendations */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Priority Recommendations</h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowChatInterface(true)}
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Chat with AI
                </Button>
              </div>
              {recommendationsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-lg p-6 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              ) : recommendations.length > 0 ? (
                <div className="space-y-4">
                  {recommendations.slice(0, 3).map((recommendation: any) => (
                    <RecommendationCard
                      key={recommendation.id}
                      recommendation={recommendation}
                      onApply={() => queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] })}
                      onDismiss={() => queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] })}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                  <Target className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No recommendations available. Run an evaluation to generate new insights.</p>
                </div>
              )}
            </div>

            {/* Campaign Overview */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Campaign Overview</h3>
              {campaignsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-lg p-6 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : campaigns.length > 0 ? (
                <div className="space-y-4">
                  {campaigns.slice(0, 3).map((campaign: any) => (
                    <CampaignCard
                      key={campaign.id}
                      campaign={campaign}
                      onUpdate={() => queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] })}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No campaigns found. Create your first campaign to get started.</p>
                </div>
              )}
            </div>
          </div>

          {/* Audit Trail */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Recent Activity & Audit Trail</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowAuditModal(true)}>
                  View All →
                </Button>
              </div>
            </div>
            <div className="p-6">
              {auditLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start space-x-4 animate-pulse">
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : auditTrail.length > 0 ? (
                <div className="space-y-4">
                  {auditTrail.slice(0, 5).map((entry: any) => (
                    <div key={entry.id} className="flex items-start space-x-4 pb-4 border-b border-gray-100 last:border-b-0 last:pb-0">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{entry.action}</p>
                        <p className="text-sm text-gray-600 mt-1">{entry.details}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-xs text-gray-500">
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500">by {entry.performedBy}</span>
                          {entry.aiModel && (
                            <span className="text-xs text-primary font-medium">{entry.aiModel}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <p>No activity recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Audit Trail Modal */}
      <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span>Complete Activity & Audit Trail</span>
            </DialogTitle>
            <DialogDescription>
              View all system activities, AI decisions, and user actions with detailed timestamps.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {auditTrail.length > 0 ? (
              auditTrail.map((entry: any) => (
                <div key={entry.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{entry.action}</p>
                    <p className="text-sm text-gray-600 mt-1">{entry.details}</p>
                    <div className="flex items-center space-x-4 mt-3">
                      <span className="text-xs text-gray-500">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-500">by {entry.performedBy}</span>
                      {entry.aiModel && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                          {entry.aiModel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-12">
                <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No activity recorded yet.</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowAuditModal(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Interface */}
      <ChatInterface
        campaigns={campaigns}
        isOpen={showChatInterface}
        onClose={() => setShowChatInterface(false)}
      />
    </div>
  );
}
