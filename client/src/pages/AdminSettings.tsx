import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Settings, UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function AdminSettings() {
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth() as { user: any };

  // Check current Google Ads configuration status  
  const { data: configStatus, isLoading, error } = useQuery({
    queryKey: ['/api/admin/google-ads/status'],
    refetchInterval: 5000, // Refresh every 5 seconds
    retry: false, // Don't retry if access denied
  });

  // Check if user is admin or if they can become admin
  const isAdmin = user?.role === 'admin';
  const accessDenied = error && error.message?.includes('Admin access required');

  // Set up centralized Google Ads configuration
  const setupMutation = useMutation({
    mutationFn: async (data: { customerId: string; customerName: string; refreshToken: string }) => {
      return await apiRequest('/api/admin/google-ads/setup', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Centralized Google Ads configuration has been set up successfully!",
      });
      // Clear form
      setCustomerId('');
      setCustomerName('');
      setRefreshToken('');
      // Refresh status
      queryClient.invalidateQueries({ queryKey: ['/api/admin/google-ads/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set up Google Ads configuration",
        variant: "destructive",
      });
    },
  });

  // Become admin mutation (for initial setup when no admins exist)
  const becomeAdminMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/make-admin', {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "You are now an admin!",
      });
      // Refresh user data and configuration status
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/google-ads/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Info",
        description: error.message || "Unable to become admin",
        variant: "default",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !customerName || !refreshToken) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    setupMutation.mutate({ customerId, customerName, refreshToken });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading configuration status...</div>
      </div>
    );
  }

  // Show admin access required message for non-admin users
  if (accessDenied && !isAdmin) {
    return (
      <div className="container mx-auto py-8 space-y-6" data-testid="admin-access-denied">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Admin Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Admin Access Required
            </CardTitle>
            <CardDescription>
              Only administrators can configure centralized Google Ads authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This page is restricted to admin users. If no admin exists yet, you can become the first admin.
            </p>
            
            <Button 
              onClick={() => becomeAdminMutation.mutate()}
              disabled={becomeAdminMutation.isPending}
              className="w-full"
              data-testid="button-become-admin"
            >
              <UserCheck className="w-4 h-4 mr-2" />
              {becomeAdminMutation.isPending ? "Checking..." : "Become Admin"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="admin-settings-container">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Admin Settings</h1>
      </div>

      {/* Configuration Status */}
      <Card data-testid="config-status-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {configStatus?.isConfigured ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-orange-500" />
            )}
            Google Ads Configuration Status
          </CardTitle>
          <CardDescription>
            Centralized Google Ads authentication for all team members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span>Status:</span>
              <Badge 
                variant={configStatus?.isConfigured ? "default" : "secondary"}
                data-testid="config-status-badge"
              >
                {configStatus?.isConfigured ? "Configured" : "Not Configured"}
              </Badge>
            </div>
            
            {configStatus?.isConfigured && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Available Google Ads Accounts: {configStatus.availableAccounts}
                </div>
                
                {configStatus.accounts && configStatus.accounts.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Connected Accounts:</h4>
                    <div className="space-y-2">
                      {configStatus.accounts.map((account: any) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid={`account-${account.id}`}
                        >
                          <div>
                            <div className="font-medium">{account.customerName}</div>
                            <div className="text-sm text-muted-foreground">ID: {account.customerId}</div>
                          </div>
                          {account.isPrimary && (
                            <Badge variant="outline">Primary</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup Form */}
      <Card data-testid="setup-form-card">
        <CardHeader>
          <CardTitle>Set Up Centralized Google Ads Authentication</CardTitle>
          <CardDescription>
            Configure server-side Google Ads access for all team members. You'll need Google Ads API credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerId">Google Ads Customer ID *</Label>
              <Input
                id="customerId"
                type="text"
                placeholder="e.g., 1234567890"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                data-testid="input-customer-id"
              />
              <div className="text-xs text-muted-foreground">
                Find this in your Google Ads account under Account Settings
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="customerName">Account Name *</Label>
              <Input
                id="customerName"
                type="text"
                placeholder="e.g., Main Google Ads Account"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                data-testid="input-customer-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="refreshToken">Refresh Token *</Label>
              <Input
                id="refreshToken"
                type="password"
                placeholder="Enter your Google OAuth refresh token"
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                data-testid="input-refresh-token"
              />
              <div className="text-xs text-muted-foreground">
                Obtain this from your Google OAuth 2.0 setup with Google Ads API scope
              </div>
            </div>
            
            <Button 
              type="submit" 
              disabled={setupMutation.isPending}
              className="w-full"
              data-testid="button-setup-config"
            >
              {setupMutation.isPending ? "Setting up..." : "Set Up Configuration"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card data-testid="instructions-card">
        <CardHeader>
          <CardTitle>How to Get Google Ads API Credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-2">
            <p><strong>1. Google Ads API Access:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Apply for Google Ads API access at <code>developers.google.com/google-ads/api</code></li>
              <li>Get your Developer Token approved</li>
            </ul>
            
            <p><strong>2. OAuth 2.0 Setup:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Create a project in Google Cloud Console</li>
              <li>Enable Google Ads API</li>
              <li>Create OAuth 2.0 credentials</li>
              <li>Generate a refresh token with Google Ads API scope</li>
            </ul>
            
            <p><strong>3. Customer ID:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Find your Customer ID in Google Ads account settings</li>
              <li>Remove any dashes (e.g., 123-456-7890 becomes 1234567890)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}