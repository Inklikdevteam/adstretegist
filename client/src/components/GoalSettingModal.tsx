import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateCampaignData } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

interface GoalSettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: any;
  onSave: () => void;
}

export default function GoalSettingModal({ 
  isOpen, 
  onClose, 
  campaign, 
  onSave 
}: GoalSettingModalProps) {
  const { toast } = useToast();
  const [primaryGoal, setPrimaryGoal] = useState("Target CPA");
  const [targetCpa, setTargetCpa] = useState(campaign?.targetCpa || "");
  const [targetRoas, setTargetRoas] = useState(campaign?.targetRoas || "");
  const [goalDescription, setGoalDescription] = useState(campaign?.goalDescription || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    try {
      setIsLoading(true);
      
      const goalData = {
        targetCpa: targetCpa ? targetCpa.toString() : null,
        targetRoas: targetRoas ? targetRoas.toString() : null,
        goalDescription: goalDescription || null,
      };

      const response = await apiRequest("PATCH", `/api/campaigns/${campaign.id}/goals`, goalData);
      console.log('Goal setting response:', response);
      
      toast({
        title: "Goals Updated", 
        description: "Campaign goals have been successfully updated.",
      });
      
      // Wait a moment before refreshing to ensure database write is complete
      setTimeout(() => {
        onSave();
        onClose();
      }, 100);
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
      
      // Check if it's a 404 error (campaign not found)
      const errorMessage = (error as any)?.message || '';
      if (errorMessage.includes('404') || errorMessage.includes('Campaign not found') || errorMessage.includes('not found')) {
        toast({
          title: "Data Outdated",
          description: "Campaign data is outdated. Refreshing campaigns...",
          variant: "destructive",
        });
        
        // Invalidate cache and refresh data instead of full page reload
        invalidateCampaignData();
        
        setTimeout(() => {
          onClose(); // Close modal and let parent refresh
        }, 1000);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to update goals. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Set Campaign Goals</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">{campaign?.name} Campaign</h4>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Goal
                </Label>
                <Select value={primaryGoal} onValueChange={setPrimaryGoal}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Maximize Conversions">Maximize Conversions</SelectItem>
                    <SelectItem value="Target CPA">Target CPA</SelectItem>
                    <SelectItem value="Target ROAS">Target ROAS</SelectItem>
                    <SelectItem value="Maximize Clicks">Maximize Clicks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">
                  Target CPA (₹)
                </Label>
                <Input
                  type="number"
                  placeholder="350"
                  value={targetCpa}
                  onChange={(e) => setTargetCpa(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              Target ROAS (optional)
            </Label>
            <Input
              type="number"
              step="0.1"
              placeholder="4.0"
              value={targetRoas}
              onChange={(e) => setTargetRoas(e.target.value)}
            />
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              Natural Language Goal (Optional)
            </Label>
            <Textarea
              rows={3}
              placeholder="e.g., I want to generate more leads at a cost below ₹400 each, even if total volume decreases"
              value={goalDescription}
              onChange={(e) => setGoalDescription(e.target.value)}
            />
          </div>
          
          <div className="flex items-center justify-end space-x-4 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Saving...
                </>
              ) : (
                "Save Goals"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
