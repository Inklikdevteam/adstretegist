import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings as SettingsIcon, User, Bell, Shield, HelpCircle, ExternalLink, Edit, Save, X, AlertTriangle, Unplug, RefreshCw, Database } from "lucide-react";
import UserManagement from "@/components/UserManagement";

export default function Settings() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [appliedAccounts, setAppliedAccounts] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // AI Preferences state
  const [frequency, setFrequency] = useState('daily');
  const [confidenceThreshold, setConfidenceThreshold] = useState('70');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [dailySummaries, setDailySummaries] = useState(false);
  const [budgetAlerts, setBudgetAlerts] = useState(true);

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    profileImageUrl: ''
  });

  // Get available Google Ads accounts
  const { data: accountsData, isLoading: accountsLoading } = useQuery<any>({
    queryKey: ["/api/google-ads/available-accounts"],
    enabled: isAuthenticated,
  });

  // Fetch user settings from database
  const { data: userSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['/api/user/settings'],
    enabled: isAuthenticated,
  });

  // Update form fields when settings data changes (TanStack Query v5 compatible)
  useEffect(() => {
    if (userSettings) {
      setSelectedAccounts(userSettings.selectedGoogleAdsAccounts || []);
      setAppliedAccounts(userSettings.selectedGoogleAdsAccounts || []);
      setFrequency(userSettings.aiFrequency || 'daily');
      setConfidenceThreshold(userSettings.confidenceThreshold?.toString() || '70');
      setEmailAlerts(userSettings.emailAlerts !== false);
      setDailySummaries(userSettings.dailySummaries === true);
      setBudgetAlerts(userSettings.budgetAlerts !== false);
    }
  }, [userSettings]);

  // Update profile data when user data changes
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        profileImageUrl: user.profileImageUrl || ''
      });
    }
  }, [user]);
  
  // Update user settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (settings: any) => apiRequest('PATCH', '/api/user/settings', settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
    }
  });

  // Disconnect Google Ads mutation
  const disconnectGoogleAdsMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/google-ads/disconnect-all'),
    onSuccess: () => {
      toast({
        title: "Google Ads Disconnected",
        description: "Successfully disconnected from Google Ads. All campaign data has been cleared.",
      });
      // Refresh queries to update UI
      queryClient.invalidateQueries({ queryKey: ['/api/google-ads/available-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/summary'] });
      setShowDisconnectDialog(false);
      setIsDisconnecting(false);
    },
    onError: (error: any) => {
      toast({
        title: "Disconnection Failed",
        description: error.message || "Failed to disconnect Google Ads integration. Please try again.",
        variant: "destructive",
      });
      setIsDisconnecting(false);
    }
  });

  // Update user profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (profile: any) => apiRequest('PATCH', '/api/auth/user/profile', profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setIsEditingProfile(false);
      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
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
      
      // Save to database with both selectedGoogleAdsAccounts (Settings config) and reset currentViewAccounts
      await updateSettingsMutation.mutateAsync({
        selectedGoogleAdsAccounts: selectedAccounts,
        currentViewAccounts: [] // Reset view filter to force using the new Settings config
      });
      
      // Fallback to localStorage for immediate use
      localStorage.setItem('selectedGoogleAdsAccounts', JSON.stringify(selectedAccounts));
      setAppliedAccounts(selectedAccounts);
      
      toast({
        title: "Active Accounts Updated",
        description: `${selectedAccounts.length === 0 ? 'All accounts' : selectedAccounts.length + ' account(s)'} marked as active. All pages will now show data from these accounts only.`,
      });
      
      // Invalidate all relevant queries to trigger refresh
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      await queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
      
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

  const handleDisconnectGoogleAds = () => {
    setIsDisconnecting(true);
    disconnectGoogleAdsMutation.mutate();
  };

  // Handle manual data sync
  const handleDataSync = async () => {
    setIsSyncing(true);
    try {
      console.log('🔄 Starting data sync...');
      const result = await apiRequest('POST', '/api/sync/initial');
      console.log('✅ Sync result:', result);
      
      // apiRequest returns parsed JSON directly, not Response object
      if (result.success === true) {
        toast({
          title: "Data Sync Completed", 
          description: result.syncedCampaigns && result.syncedAccounts 
            ? `Successfully synced ${result.syncedCampaigns} campaigns from ${result.syncedAccounts} Google Ads accounts. Campaign data is now up to date.`
            : `Successfully synced campaign data. Campaign data is now up to date.`,
        });
        
        // Invalidate relevant queries to refresh data
        try {
          await queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
          console.log('🔄 Query invalidation completed');
        } catch (invalidateError) {
          console.error('⚠️ Error invalidating queries:', invalidateError);
          // Don't fail the whole sync for query invalidation errors
        }
      } else {
        // Server returned success=false
        throw new Error(result.message || 'Sync failed on server');
      }
    } catch (error: any) {
      console.error('❌ Error syncing data:', error);
      toast({
        title: "Data Sync Failed",
        description: error.message || "Failed to sync campaign data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
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
        budgetAlerts
        // Don't update selectedGoogleAdsAccounts here - it should only be changed via "Update Accounts"
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

  const handleProfileUpdate = () => {
    if (!profileData.firstName.trim() && !profileData.lastName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter at least your first name or last name.",
        variant: "destructive",
      });
      return;
    }

    updateProfileMutation.mutate(profileData);
  };

  const handleCancelEdit = () => {
    // Reset to original user data
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        profileImageUrl: user.profileImageUrl || ''
      });
    }
    setIsEditingProfile(false);
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
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>Profile Information</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => isEditingProfile ? handleCancelEdit() : setIsEditingProfile(true)}
                  data-testid="button-edit-profile"
                >
                  {isEditingProfile ? (
                    <>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </>
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingProfile ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={profileData.firstName}
                        onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                        placeholder="Enter your first name"
                        data-testid="input-first-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={profileData.lastName}
                        onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                        placeholder="Enter your last name"
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      placeholder="Enter your email address"
                      data-testid="input-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="profileImageUrl">Profile Image URL (Optional)</Label>
                    <Input
                      id="profileImageUrl"
                      type="url"
                      value={profileData.profileImageUrl}
                      onChange={(e) => setProfileData({ ...profileData, profileImageUrl: e.target.value })}
                      placeholder="Enter profile image URL"
                      data-testid="input-profile-image"
                    />
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <Button 
                      onClick={handleProfileUpdate}
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      {updateProfileMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-1" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">First Name</Label>
                      <p className="text-sm text-gray-900" data-testid="text-first-name">
                        {user?.firstName || 'Not set'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Last Name</Label>
                      <p className="text-sm text-gray-900" data-testid="text-last-name">
                        {user?.lastName || 'Not set'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Email</Label>
                    <p className="text-sm text-gray-900" data-testid="text-email">
                      {user?.email || 'Not set'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Username</Label>
                    <p className="text-sm text-gray-900" data-testid="text-username">
                      {user?.username}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Role</Label>
                    <p className="text-sm text-gray-900" data-testid="text-role">
                      {user?.role === 'admin' ? 'Administrator' : 'Sub Account'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Google Ads Account Selection - Admin Only for Connection, View Only for Sub-Accounts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ExternalLink className="w-5 h-5" />
                <span>Google Ads Account</span>
                {user?.role === 'sub_account' && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full ml-2">
                    View Only
                  </span>
                )}
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
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">Active Accounts</h4>
                    {user?.role === 'admin' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDisconnectDialog(true)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        data-testid="button-disconnect-google-ads"
                      >
                        <Unplug className="w-4 h-4 mr-2" />
                        Disconnect
                      </Button>
                    )}
                  </div>
                  {user?.role === 'admin' ? (
                    <p className="text-sm text-gray-600 mb-3">Choose which Google Ads accounts to display campaigns from</p>
                  ) : (
                    <p className="text-sm text-gray-600 mb-3">View Google Ads accounts connected by admin</p>
                  )}
                  
                  {/* Admin can modify account selection */}
                  {user?.role === 'admin' && (
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
                  )}
                  
                  <div className="space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {accountsData?.accounts?.map((account: any) => (
                      <div key={account.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                        {user?.role === 'admin' ? (
                          <Checkbox
                            id={`account-${account.id}`}
                            checked={selectedAccounts.includes(account.id)}
                            onCheckedChange={(checked) => handleAccountToggle(account.id, checked as boolean)}
                            data-testid={`checkbox-account-${account.id}`}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded-sm border-2 border-gray-300 w-5 h-5"
                          />
                        ) : (
                          <div className="w-5 h-5 flex items-center justify-center">
                            {selectedAccounts.includes(account.id) ? (
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            ) : (
                              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                            )}
                          </div>
                        )}
                        <label 
                          htmlFor={user?.role === 'admin' ? `account-${account.id}` : undefined} 
                          className={`text-sm font-medium text-gray-900 flex-1 ${user?.role === 'admin' ? 'cursor-pointer' : ''}`}
                        >
                          {account.name}
                        </label>
                        <span className="text-xs text-gray-500">
                          ID: {account.id}
                        </span>
                        {user?.role === 'sub_account' && selectedAccounts.includes(account.id) && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            Active
                          </span>
                        )}
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
                  
                  {hasChanges && user?.role === 'admin' && (
                    <p className="text-xs text-orange-600 mt-2 font-medium">
                      Changes pending - click Update to apply
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  {user?.role === 'admin' ? (
                    <>
                      <h4 className="font-medium text-gray-900 mb-2">No Google Ads Connection</h4>
                      <p className="text-sm text-gray-600 mb-3">Connect your Google Ads account to manage campaigns</p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          // Generate a state parameter to identify the user during OAuth callback
                          const state = user?.id || 'unknown';
                          console.log('Connecting Google Ads with user ID:', state, 'Full user:', user);
                          // Redirect to Google Ads OAuth flow
                          window.location.href = `/api/auth/google-ads-connect?state=${state}`;
                        }}
                        data-testid="button-connect-google-ads"
                      >
                        Connect Google Ads
                      </Button>
                    </>
                  ) : (
                    <>
                      <h4 className="font-medium text-gray-900 mb-2">No Google Ads Connection</h4>
                      <p className="text-sm text-gray-600 mb-3">Contact your admin to connect Google Ads accounts</p>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <ExternalLink className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">Access Restricted</span>
                        </div>
                        <p className="text-sm text-blue-700 mt-1">
                          Only administrators can connect and manage Google Ads accounts. 
                          You can view campaign data once the admin connects an account.
                        </p>
                      </div>
                    </>
                  )}
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

          {/* Data Sync - Admin Only */}
          {user?.role === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="w-5 h-5" />
                  <span>Data Synchronization</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Manual Data Sync</h4>
                    <p className="text-sm text-gray-600">Pull latest campaign data from Google Ads API into database</p>
                  </div>
                  <Button 
                    onClick={handleDataSync}
                    disabled={isSyncing}
                    variant="outline"
                    data-testid="button-sync-data"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync Now
                      </>
                    )}
                  </Button>
                </div>
                <div className="text-xs text-gray-500">
                  Automatic sync runs daily at 1:00 AM. Use this button for immediate data refresh.
                </div>
              </CardContent>
            </Card>
          )}

          {/* User Management - Admin Only */}
          {user?.role === 'admin' && (
            <UserManagement />
          )}

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

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>Disconnect Google Ads Integration</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will permanently disconnect your Google Ads integration and:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
                <li>Remove all connected Google Ads accounts</li>
                <li>Delete all campaign data and performance metrics</li>
                <li>Clear all AI recommendations and audit logs</li>
                <li>Reset account selection settings</li>
                <li>Revoke API access tokens with Google</li>
              </ul>
              <p className="text-red-600 font-medium">
                This action cannot be undone. You'll need to reconnect and re-import your campaigns if you want to use Google Ads features again.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnectGoogleAds}
              disabled={isDisconnecting}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-disconnect"
            >
              {isDisconnecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Disconnecting...
                </>
              ) : (
                <>
                  <Unplug className="w-4 h-4 mr-2" />
                  Disconnect Google Ads
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}