import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MetricsCard from "@/components/MetricsCard";
import AccountSelector from "@/components/AccountSelector";
import DateRangeSelector, { DateRange } from "@/components/DateRangeSelector";
import { TrendingUp, Target, DollarSign, BarChart3, Users, Clock } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function Performance() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  
  // Date range state - default to last 7 days
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 7);
    return { from, to, preset: "7d" };
  });

  // Fetch user settings to get saved account selection
  const { data: userSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['/api/user/settings'],
    enabled: isAuthenticated,
  });

  // Update user settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (settings: any) => apiRequest('PATCH', '/api/user/settings', settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
    }
  });

  // Load account selection from user settings with proper fallback
  useEffect(() => {
    if (userSettings) {
      // If currentViewAccounts exists and is not empty, use it (temporary view filter)
      if (userSettings.currentViewAccounts && userSettings.currentViewAccounts.length > 0) {
        setSelectedAccounts(userSettings.currentViewAccounts);
      } 
      // Otherwise, use selectedGoogleAdsAccounts from Settings (master configuration)
      else if (userSettings.selectedGoogleAdsAccounts && userSettings.selectedGoogleAdsAccounts.length > 0) {
        setSelectedAccounts(userSettings.selectedGoogleAdsAccounts);
      }
      // If no accounts are configured in Settings, use empty array (will show all accounts)
      else {
        setSelectedAccounts([]);
      }
    }
  }, [userSettings]);

  // Save current view selection when it changes (NOT the active accounts config)
  const handleAccountsChange = async (newSelectedAccounts: string[]) => {
    setSelectedAccounts(newSelectedAccounts);
    
    // Save only the current view selection, preserve the active accounts configuration
    try {
      await updateSettingsMutation.mutateAsync({
        currentViewAccounts: newSelectedAccounts
      });
    } catch (error) {
      console.error('Failed to save current view selection:', error);
    }
  };

  // Authentication is handled by the Router component

  const { data: dashboardSummary, isLoading: summaryLoading } = useQuery<any>({
    queryKey: ["/api/performance/summary", selectedAccounts, dateRange],
    queryFn: () => {
      const params = new URLSearchParams({
        selectedAccounts: JSON.stringify(selectedAccounts),
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      return apiRequest("GET", `/api/performance/summary?${params}`);
    },
    enabled: isAuthenticated,
  });

  const { data: campaigns = [] } = useQuery<any[]>({
    queryKey: ["/api/performance/campaigns", selectedAccounts, dateRange],
    queryFn: () => {
      const params = new URLSearchParams({
        selectedAccounts: JSON.stringify(selectedAccounts),
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      return apiRequest("GET", `/api/performance/campaigns?${params}`);
    },
    enabled: isAuthenticated,
  });

  // Loading state handled by individual queries

  const summary = dashboardSummary || {};
  const totalSpend = summary.totalSpend || 0;
  const totalConversions = summary.totalConversions || 0;
  const totalConversionValue = summary.totalConversionValue || 0;
  const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const roas = summary.roas || 0;
  const impressions = 125400;
  const clicks = 3200;

  // Helper function to get days label for date range
  const getDaysLabel = (range: DateRange): string => {
    if (range.preset && range.preset !== "custom") {
      return range.preset.replace("d", " days");
    }
    const diffTime = Math.abs(range.to.getTime() - range.from.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} days`;
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-gray-900">Performance Analytics</h2>
              <p className="text-gray-600 mt-1">Track your campaign metrics and KPIs</p>
              <div className="mt-3 space-y-3">
                <AccountSelector
                  selectedAccounts={selectedAccounts}
                  onAccountsChange={handleAccountsChange}
                  className="flex-wrap"
                />
                <DateRangeSelector
                  value={dateRange}
                  onChange={setDateRange}
                  className="flex items-center"
                />
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Performance Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricsCard
              title="Total Campaigns"
              value={summary.totalCampaigns?.toString() || "0"}
              change="+2"
              changeType="positive"
              icon={BarChart3}
              iconBgColor="bg-blue-100"
              iconColor="text-primary"
            />
            <MetricsCard
              title="Active Campaigns"
              value={summary.activeCampaigns?.toString() || "0"}
              change="+1"
              changeType="positive"
              icon={Target}
              iconBgColor="bg-green-100"
              iconColor="text-green-600"
            />
            <MetricsCard
              title="Recommendations"
              value={((summary.recommendations?.actionable || 0) + (summary.recommendations?.monitor || 0) + (summary.recommendations?.clarification || 0)).toString()}
              change="New insights"
              changeType="positive"
              icon={TrendingUp}
              iconBgColor="bg-purple-100"
              iconColor="text-purple-600"
            />
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricsCard
              title={`Total Spend (${getDaysLabel(dateRange)})`}
              value={`₹${totalSpend.toLocaleString()}`}
              change="+12.5%"
              changeType="positive"
              icon={DollarSign}
              iconBgColor="bg-blue-100"
              iconColor="text-primary"
            />
            <MetricsCard
              title={`Conversions (${getDaysLabel(dateRange)})`}
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
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricsCard
              title="ROAS"
              value={`${roas.toFixed(1)}x`}
              change="+15.2%"
              changeType="positive"
              icon={BarChart3}
              iconBgColor="bg-green-100"
              iconColor="text-green-600"
            />
            <MetricsCard
              title={`Impressions (${getDaysLabel(dateRange)})`}
              value={impressions.toLocaleString()}
              change="+5.7%"
              changeType="positive"
              icon={Users}
              iconBgColor="bg-purple-100"
              iconColor="text-purple-600"
            />
            <MetricsCard
              title={`Clicks (${getDaysLabel(dateRange)})`}
              value={clicks.toLocaleString()}
              change="+9.1%"
              changeType="positive"
              icon={Clock}
              iconBgColor="bg-orange-100"
              iconColor="text-orange-600"
            />
          </div>

          {/* Campaign Performance */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Campaign Performance Breakdown</h3>
            </div>
            <div className="p-6">
              {summaryLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              ) : campaigns.length > 0 ? (
                <div className="space-y-4">
                  {campaigns.map((campaign: any) => (
                    <div key={campaign.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900">{campaign.name}</h4>
                        <p className="text-sm text-gray-600 capitalize">{campaign.type} • {campaign.status}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">₹{parseFloat(campaign.spend7d || '0').toLocaleString()}</p>
                        <p className="text-sm text-gray-600">{campaign.conversions7d || 0} conversions</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <p>No campaign data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}