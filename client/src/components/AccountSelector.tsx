import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Check, ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

interface AccountSelectorProps {
  selectedAccounts: string[];
  onAccountsChange: (accounts: string[]) => void;
  className?: string;
}

export default function AccountSelector({ selectedAccounts, onAccountsChange, className = "" }: AccountSelectorProps) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  // Get available Google Ads accounts
  const { data: accountsData, isLoading: accountsLoading } = useQuery<any>({
    queryKey: ["/api/google-ads/available-accounts"],
    enabled: isAuthenticated,
  });

  // Get current user info to check role
  const { data: userInfo } = useQuery({
    queryKey: ['/api/auth/user'],
    enabled: isAuthenticated,
  });

  // Get user settings to filter by active accounts
  const { data: userSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['/api/user/settings'],
    enabled: isAuthenticated,
  });

  // Get admin settings if current user is a sub-account
  const { data: adminSettings, isLoading: isLoadingAdminSettings } = useQuery({
    queryKey: ['/api/admin/settings'],
    enabled: isAuthenticated && userInfo?.role === 'sub_account',
  });

  // Filter accounts to only show those marked as active in Settings
  const allAccounts = accountsData?.accounts || [];
  
  // For sub-accounts, use admin's selected accounts; for admins, use their own
  const activeAccountIds = userInfo?.role === 'sub_account' 
    ? (adminSettings?.selectedGoogleAdsAccounts || [])
    : (userSettings?.selectedGoogleAdsAccounts || []);
  
  // If no accounts are marked as active in Settings, show all accounts as fallback
  // Otherwise, only show the accounts marked as active
  const accounts = activeAccountIds.length > 0 
    ? allAccounts.filter((account: any) => activeAccountIds.includes(account.id))
    : allAccounts;

  const handleAccountToggle = (accountId: string) => {
    const newSelectedAccounts = selectedAccounts.includes(accountId)
      ? selectedAccounts.filter(id => id !== accountId)
      : [...selectedAccounts, accountId];
    
    onAccountsChange(newSelectedAccounts);
  };

  const handleSelectAll = () => {
    const allAccountIds = accounts.map((account: any) => account.id);
    onAccountsChange(allAccountIds);
  };

  const handleClearAll = () => {
    onAccountsChange([]);
  };

  const getSelectedAccountNames = () => {
    return selectedAccounts
      .map(id => accounts.find((acc: any) => acc.id === id)?.name || id)
      .filter(Boolean);
  };

  const selectedAccountNames = getSelectedAccountNames();

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Building2 className="h-4 w-4" />
        <span>Accounts:</span>
      </div>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="min-w-[200px] justify-between"
            data-testid="button-account-selector"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {selectedAccounts.length === 0 ? (
                <span className="text-gray-500">Select accounts...</span>
              ) : selectedAccounts.length === 1 ? (
                <span className="truncate">{selectedAccountNames[0]}</span>
              ) : (
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {selectedAccounts.length}
                  </Badge>
                  <span className="text-sm">accounts selected</span>
                </div>
              )}
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search accounts..." />
            <CommandEmpty>No accounts found.</CommandEmpty>
            <CommandGroup>
              <div className="flex items-center justify-between p-2 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs"
                  data-testid="button-select-all-accounts"
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-xs"
                  data-testid="button-clear-all-accounts"
                >
                  Clear All
                </Button>
              </div>
              {(accountsLoading || isLoadingSettings || isLoadingAdminSettings) ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  Loading accounts...
                </div>
              ) : accounts.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  {activeAccountIds.length > 0 ? 'No active accounts set in Settings' : 'No accounts available'}
                </div>
              ) : (
                accounts.map((account: any) => (
                  <CommandItem
                    key={account.id}
                    onSelect={() => handleAccountToggle(account.id)}
                    className="cursor-pointer"
                    data-testid={`item-account-${account.id}`}
                  >
                    <div className="flex items-center space-x-2 w-full">
                      <div className="flex items-center justify-center w-4 h-4 border border-gray-300 rounded">
                        {selectedAccounts.includes(account.id) && (
                          <Check className="h-3 w-3 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {account.name || `Account ${account.id}`}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          ID: {account.id}
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedAccounts.length > 1 && (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {selectedAccountNames.slice(0, 2).map((name, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {name.length > 15 ? `${name.substring(0, 15)}...` : name}
            </Badge>
          ))}
          {selectedAccountNames.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{selectedAccountNames.length - 2} more
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}