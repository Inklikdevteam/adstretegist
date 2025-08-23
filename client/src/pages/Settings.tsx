import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings as SettingsIcon, User, Bell, Shield, HelpCircle, ExternalLink } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [appliedAccounts, setAppliedAccounts] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // AI Preferences state
  const [frequency, setFrequency] = useState('daily');
  const [confidenceThreshold, setConfidenceThreshold] = useState('70');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [dailySummaries, setDailySummaries] = useState(false);
  const [budgetAlerts, setBudgetAlerts] = useState(true);

  // Get available Google Ads accounts
  const { data: accountsData, isLoading: accountsLoading } = useQuery<any>({
    queryKey: ["/api/google-ads/available-accounts"],
    enabled: isAuthenticated,
  });

  // Fetch user settings from database
  const { data: userSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['/api/user/settings'],
    onSuccess: (settings: any) => {
      setSelectedAccounts(settings.selectedGoogleAdsAccounts || []);
      setAppliedAccounts(settings.selectedGoogleAdsAccounts || []);
      setFrequency(settings.aiFrequency || 'daily');
      setConfidenceThreshold(settings.confidenceThreshold?.toString() || '70');
      setEmailAlerts(settings.emailAlerts !== false);
      setDailySummaries(settings.dailySummaries === true);
      setBudgetAlerts(settings.budgetAlerts !== false);
    },
    onError: (error: any) => {
      console.error('Failed to load user settings:', error);
      // Fallback to localStorage if database fails
      const saved = localStorage.getItem('selectedGoogleAdsAccounts');
      if (saved) {
        try {
          const parsedAccounts = JSON.parse(saved);
          const accounts = Array.isArray(parsedAccounts) ? parsedAccounts : [];
          setSelectedAccounts(accounts);
          setAppliedAccounts(accounts);
        } catch {
          setSelectedAccounts([]);
          setAppliedAccounts([]);
        }
      }
      
      const savedFrequency = localStorage.getItem('aiFrequency') || 'daily';
      const savedConfidence = localStorage.getItem('confidenceThreshold') || '70';
      const savedEmailAlerts = localStorage.getItem('emailAlerts') !== 'false';
      const savedDailySummaries = localStorage.getItem('dailySummaries') === 'true';
      const savedBudgetAlerts = localStorage.getItem('budgetAlerts') !== 'false';
      
      setFrequency(savedFrequency);
      setConfidenceThreshold(savedConfidence);
      setEmailAlerts(savedEmailAlerts);
      setDailySummaries(savedDailySummaries);
      setBudgetAlerts(savedBudgetAlerts);
    }
  });
  
  // Update user settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (settings: any) => apiRequest('PATCH', '/api/user/settings', settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
    }
  });

  const handleAccountToggle = (accountId: string, checked: boolean) => {
    let newSelectedAccounts: string[];
    
    if (checked) {
      newSelectedAccounts = [...selectedAccounts, accountId];
    } else {
      newSelectedAccounts = selectedAccounts.filter(id => id !== accountId);
    }
    
    setSelectedAccounts(newSelectedAccounts);
  };

  const handleSelectAll = () => {
    const allAccountIds = accountsData?.accounts?.map((account: any) => account.id) || [];
    setSelectedAccounts(allAccountIds);
  };

  const handleClearAll = () => {
    setSelectedAccounts([]);
  };

  const handleUpdateAccounts = async () => {
    try {
      setIsUpdating(true);
      
      // Save to database instead of localStorage
      await updateSettingsMutation.mutateAsync({
        selectedGoogleAdsAccounts: selectedAccounts
      });
      
      // Fallback to localStorage for immediate use
      localStorage.setItem('selectedGoogleAdsAccounts', JSON.stringify(selectedAccounts));
      setAppliedAccounts(selectedAccounts);
      
      toast({
        title: "Accounts Updated",
        description: `${selectedAccounts.length === 0 ? 'All accounts' : selectedAccounts.length + ' account(s)'} selected. Campaign data will refresh.`,
      });
      
      // Invalidate all relevant queries to trigger refresh
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      
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
        description: "Failed to update account selection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const hasChanges = JSON.stringify(selectedAccounts.sort()) !== JSON.stringify(appliedAccounts.sort());
  
  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      
      // Save all preferences to database
      await updateSettingsMutation.mutateAsync({
        aiFrequency: frequency,
        confidenceThreshold: parseInt(confidenceThreshold),
        emailAlerts,
        dailySummaries,
        budgetAlerts,
        selectedGoogleAdsAccounts: appliedAccounts // Preserve current account selection
      });
      
      // Fallback to localStorage for immediate use
      localStorage.setItem('aiFrequency', frequency);
      localStorage.setItem('confidenceThreshold', confidenceThreshold);
      localStorage.setItem('emailAlerts', emailAlerts.toString());
      localStorage.setItem('dailySummaries', dailySummaries.toString());
      localStorage.setItem('budgetAlerts', budgetAlerts.toString());
      
      toast({
        title: "Settings Saved",
        description: "Your AI and notification preferences have been saved successfully.",
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
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
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
                  <h4 className="font-medium text-gray-900 mb-2">Active Accounts</h4>
                  <p className="text-sm text-gray-600 mb-3">Choose which Google Ads accounts to display campaigns from</p>
                  
                  <div className="flex gap-2 mb-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleSelectAll}
                      data-testid="button-select-all"
                    >
                      Select All
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleClearAll}
                      data-testid="button-clear-all"
                    >
                      Clear All
                    </Button>
                    {hasChanges && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={handleUpdateAccounts}
                        disabled={isUpdating}
                        data-testid="button-update-accounts"
                        className="ml-auto"
                      >
                        {isUpdating ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                            Updating...
                          </>
                        ) : (
                          'Update'
                        )}
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {accountsData?.accounts?.map((account: any) => (
                      <div key={account.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                        <Checkbox
                          id={`account-${account.id}`}
                          checked={selectedAccounts.includes(account.id)}
                          onCheckedChange={(checked) => handleAccountToggle(account.id, checked as boolean)}
                          data-testid={`checkbox-account-${account.id}`}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded-sm border-2 border-gray-300 w-5 h-5"
                        />
                        <label 
                          htmlFor={`account-${account.id}`} 
                          className="text-sm font-medium text-gray-900 cursor-pointer flex-1"
                        >
                          {account.name}
                        </label>
                        <span className="text-xs text-gray-500">
                          ID: {account.id}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {appliedAccounts.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Currently viewing campaigns from {appliedAccounts.length} active account(s): {
                        appliedAccounts.map(id => 
                          accountsData?.accounts?.find((a: any) => a.id === id)?.name
                        ).join(', ')
                      }
                    </p>
                  )}
                  
                  {appliedAccounts.length === 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      No accounts active - showing campaigns from all accounts
                    </p>
                  )}
                  
                  {hasChanges && (
                    <p className="text-xs text-orange-600 mt-2 font-medium">
                      Changes pending - click Update to apply
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
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="frequency" 
                      value="daily"
                      checked={frequency === 'daily'}
                      onChange={(e) => setFrequency(e.target.value)}
                      className="text-primary" 
                    />
                    <span className="text-sm">Daily (Recommended)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="frequency" 
                      value="weekly"
                      checked={frequency === 'weekly'}
                      onChange={(e) => setFrequency(e.target.value)}
                      className="text-primary" 
                    />
                    <span className="text-sm">Weekly</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="frequency" 
                      value="manual"
                      checked={frequency === 'manual'}
                      onChange={(e) => setFrequency(e.target.value)}
                      className="text-primary" 
                    />
                    <span className="text-sm">Manual only</span>
                  </label>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Confidence Threshold</h4>
                <p className="text-sm text-gray-600 mb-3">Minimum confidence level for AI recommendations</p>
                <select 
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(e.target.value)}
                >
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
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Email alerts for high-priority recommendations</span>
                <Checkbox
                  checked={emailAlerts}
                  onCheckedChange={(checked) => setEmailAlerts(checked as boolean)}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded-sm border-2 border-gray-300 w-5 h-5"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Daily performance summaries</span>
                <Checkbox
                  checked={dailySummaries}
                  onCheckedChange={(checked) => setDailySummaries(checked as boolean)}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded-sm border-2 border-gray-300 w-5 h-5"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Budget alerts</span>
                <Checkbox
                  checked={budgetAlerts}
                  onCheckedChange={(checked) => setBudgetAlerts(checked as boolean)}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded-sm border-2 border-gray-300 w-5 h-5"
                />
              </div>
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
            <Button 
              onClick={handleSaveSettings}
              disabled={isSaving}
              data-testid="button-save-changes"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}