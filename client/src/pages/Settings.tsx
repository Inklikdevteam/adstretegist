import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, User, Bell, Shield, HelpCircle, ExternalLink } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [selectedAccount, setSelectedAccount] = useState<string>("");

  // Get available Google Ads accounts
  const { data: accountsData, isLoading: accountsLoading } = useQuery<any>({
    queryKey: ["/api/google-ads/available-accounts"],
    enabled: isAuthenticated,
  });

  // Load selected account from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('selectedGoogleAdsAccount');
    if (saved) {
      setSelectedAccount(saved);
    }
  }, []);

  const handleAccountChange = async (accountId: string) => {
    setSelectedAccount(accountId);
    localStorage.setItem('selectedGoogleAdsAccount', accountId);
    
    toast({
      title: "Account Updated",
      description: "Your selected Google Ads account has been updated. Campaign data will refresh.",
    });

    // Force refresh of campaign data
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const userInfo = user as any;

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Settings</h2>
              <p className="text-gray-600 mt-1">Manage your account and AI preferences</p>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Google Ads Account Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ExternalLink className="w-5 h-5" />
                <span>Google Ads Account</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {accountsLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-sm text-gray-600">Loading accounts...</span>
                </div>
              ) : accountsData?.hasConnection ? (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Active Account</h4>
                  <p className="text-sm text-gray-600 mb-3">Choose which Google Ads account to display campaigns from</p>
                  <Select
                    value={selectedAccount}
                    onValueChange={handleAccountChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an account..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts (Default)</SelectItem>
                      {accountsData?.accounts?.map((account: any) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAccount && selectedAccount !== "all" && (
                    <p className="text-xs text-gray-500 mt-2">
                      Currently viewing campaigns from: {accountsData?.accounts?.find((a: any) => a.id === selectedAccount)?.name}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">No Google Ads Connection</h4>
                  <p className="text-sm text-gray-600 mb-3">Connect your Google Ads account to manage campaigns</p>
                  <Button variant="outline" size="sm">
                    Connect Google Ads
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>Profile Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
                  {userInfo?.profileImageUrl ? (
                    <img 
                      src={userInfo.profileImageUrl} 
                      alt="Profile" 
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-gray-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">
                    {userInfo?.firstName && userInfo?.lastName 
                      ? `${userInfo.firstName} ${userInfo.lastName}`
                      : userInfo?.email || "User"
                    }
                  </h3>
                  <p className="text-sm text-gray-600">{userInfo?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <SettingsIcon className="w-5 h-5" />
                <span>AI Preferences</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Recommendation Frequency</h4>
                <p className="text-sm text-gray-600 mb-3">How often should AI analyze your campaigns?</p>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="frequency" defaultChecked className="text-primary" />
                    <span className="text-sm">Daily (Recommended)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="frequency" className="text-primary" />
                    <span className="text-sm">Weekly</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="frequency" className="text-primary" />
                    <span className="text-sm">Manual only</span>
                  </label>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Confidence Threshold</h4>
                <p className="text-sm text-gray-600 mb-3">Minimum confidence level for AI recommendations</p>
                <select className="w-full p-2 border border-gray-300 rounded-lg">
                  <option value="70">70% - More recommendations (default)</option>
                  <option value="80">80% - Balanced</option>
                  <option value="90">90% - Only high confidence</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>Notifications</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Email alerts for high-priority recommendations</span>
                <input type="checkbox" defaultChecked className="toggle" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Daily performance summaries</span>
                <input type="checkbox" className="toggle" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Budget alerts</span>
                <input type="checkbox" defaultChecked className="toggle" />
              </label>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Security & Access</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Account Access</h4>
                  <p className="text-sm text-gray-600">Managed through secure authentication</p>
                </div>
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Data Export</h4>
                  <p className="text-sm text-gray-600">Download your campaign data and AI insights</p>
                </div>
                <Button variant="outline" size="sm">
                  Export Data
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Help & Support */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <HelpCircle className="w-5 h-5" />
                <span>Help & Support</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="justify-start">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Documentation
                </Button>
                <Button variant="outline" className="justify-start">
                  <Bell className="w-4 h-4 mr-2" />
                  Contact Support
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Save Changes */}
          <div className="flex justify-end">
            <Button>Save Changes</Button>
          </div>
        </div>
      </main>
    </div>
  );
}