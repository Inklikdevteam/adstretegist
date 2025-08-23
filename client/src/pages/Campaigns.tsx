import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import AccountSelector from "@/components/AccountSelector";
import CampaignCard from "@/components/CampaignCard";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function Campaigns() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  // Authentication is handled by the Router component

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<any[]>({
    queryKey: ["/api/campaigns", selectedAccounts],
    queryFn: () => apiRequest("GET", `/api/campaigns?selectedAccounts=${encodeURIComponent(JSON.stringify(selectedAccounts))}`),
    enabled: isAuthenticated,
  });

  // Loading state handled by individual queries

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-gray-900">All Campaigns</h2>
              <p className="text-gray-600 mt-1">Manage and monitor your Google Ads campaigns</p>
              <div className="mt-3">
                <AccountSelector
                  selectedAccounts={selectedAccounts}
                  onAccountsChange={setSelectedAccounts}
                  className="flex-wrap"
                />
              </div>
            </div>
          </div>
        </header>

        <div className="p-6">
          {campaignsLoading ? (
            <div className="grid gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-4 w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded mb-2 w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : campaigns.length > 0 ? (
            <div className="grid gap-6">
              {campaigns.map((campaign: any) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onUpdate={() => queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] })}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg p-12 text-center text-gray-500">
              <p className="text-lg">No campaigns found</p>
              <p className="text-sm mt-2">Create your first campaign to get started</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}