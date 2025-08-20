import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShoppingCart, Megaphone, RotateCcw, Calendar, TrendingUp } from "lucide-react";
import GoalSettingModal from "./GoalSettingModal";
import { useState } from "react";

interface CampaignCardProps {
  campaign: any;
  onUpdate: () => void;
}

export default function CampaignCard({ campaign, onUpdate }: CampaignCardProps) {
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const getCampaignIcon = (type: string) => {
    switch (type) {
      case 'search': return ShoppingCart;
      case 'display': return RotateCcw;
      case 'shopping': return ShoppingCart;
      default: return Megaphone;
    }
  };

  const getCampaignStatus = (campaign: any) => {
    if (campaign.burnInUntil && new Date(campaign.burnInUntil) > new Date()) {
      return { text: "Monitoring", color: "bg-yellow-100 text-yellow-700" };
    }
    if (!campaign.targetCpa && !campaign.targetRoas) {
      return { text: "Unclear Goals", color: "bg-gray-100 text-gray-700" };
    }
    
    const cpaTarget = parseFloat(campaign.targetCpa || '0');
    const actualCpa = parseFloat(campaign.actualCpa || '0');
    const roasTarget = parseFloat(campaign.targetRoas || '0');
    const actualRoas = parseFloat(campaign.actualRoas || '0');
    
    if ((cpaTarget > 0 && actualCpa <= cpaTarget) || (roasTarget > 0 && actualRoas >= roasTarget)) {
      return { text: "Healthy", color: "bg-green-100 text-green-700" };
    }
    
    return { text: "Needs Attention", color: "bg-red-100 text-red-700" };
  };

  const Icon = getCampaignIcon(campaign.type);
  const status = getCampaignStatus(campaign);
  const hasGoals = campaign.targetCpa || campaign.targetRoas;

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon className="text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{campaign.name}</h4>
                <p className="text-sm text-gray-500 capitalize">{campaign.type} • {campaign.status}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <Badge className={status.color}>
                {status.text}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Daily Budget</p>
              <p className="font-semibold text-gray-900">₹{parseFloat(campaign.dailyBudget).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Spend (7d)</p>
              <p className="font-semibold text-gray-900">₹{parseFloat(campaign.spend7d || '0').toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CPA</p>
              <p className={`font-semibold ${hasGoals ? 'text-green-600' : 'text-gray-700'}`}>
                {campaign.actualCpa ? `₹${parseFloat(campaign.actualCpa).toLocaleString()}` : 'No data'}
              </p>
              {campaign.targetCpa && (
                <p className="text-xs text-gray-500">Target: ₹{parseFloat(campaign.targetCpa).toLocaleString()}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">ROAS</p>
              <p className={`font-semibold ${hasGoals ? 'text-green-600' : 'text-gray-700'}`}>
                {campaign.actualRoas ? `${parseFloat(campaign.actualRoas).toFixed(1)}x` : 'No data'}
              </p>
              {campaign.targetRoas && (
                <p className="text-xs text-gray-500">Target: {parseFloat(campaign.targetRoas).toFixed(1)}x</p>
              )}
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {campaign.burnInUntil && new Date(campaign.burnInUntil) > new Date()
                  ? `Modified ${Math.floor((Date.now() - new Date(campaign.lastModified).getTime()) / (1000 * 60 * 60 * 24))} days ago • Burn-in period active`
                  : hasGoals 
                    ? "AI Confidence: High Performance"
                    : "Goals needed for AI optimization"
                }
              </span>
              {!hasGoals ? (
                <Button 
                  size="sm"
                  onClick={() => setIsGoalModalOpen(true)}
                >
                  Set Goals
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setShowDetails(true)}>
                  View Details →
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <GoalSettingModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        campaign={campaign}
        onSave={onUpdate}
      />
      
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon className="text-primary" />
              </div>
              <span>{campaign.name}</span>
            </DialogTitle>
            <DialogDescription>
              Detailed campaign performance metrics, goals, and optimization insights.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Campaign Overview</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="capitalize font-medium">{campaign.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Badge className={status.color}>{status.text}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Daily Budget:</span>
                    <span className="font-medium">₹{parseFloat(campaign.dailyBudget).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Performance (7 days)</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Spend:</span>
                    <span className="font-medium">₹{parseFloat(campaign.spend7d || '0').toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Conversions:</span>
                    <span className="font-medium">{campaign.conversions7d || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CPA:</span>
                    <span className="font-medium">{campaign.actualCpa ? `₹${parseFloat(campaign.actualCpa).toLocaleString()}` : 'No data'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ROAS:</span>
                    <span className="font-medium">{campaign.actualRoas ? `${parseFloat(campaign.actualRoas).toFixed(1)}x` : 'No data'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {(campaign.targetCpa || campaign.targetRoas) && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Goals & Targets</h4>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    {campaign.targetCpa && (
                      <div>
                        <span className="text-gray-600">Target CPA:</span>
                        <p className="font-medium text-blue-700">₹{parseFloat(campaign.targetCpa).toLocaleString()}</p>
                      </div>
                    )}
                    {campaign.targetRoas && (
                      <div>
                        <span className="text-gray-600">Target ROAS:</span>
                        <p className="font-medium text-blue-700">{parseFloat(campaign.targetRoas).toFixed(1)}x</p>
                      </div>
                    )}
                  </div>
                  {campaign.goalDescription && (
                    <div className="mt-3">
                      <span className="text-gray-600">Goal Description:</span>
                      <p className="text-gray-800 mt-1">{campaign.goalDescription}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Timeline</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>Created: {new Date(campaign.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <TrendingUp className="w-4 h-4" />
                  <span>Last Modified: {new Date(campaign.lastModified || campaign.updatedAt).toLocaleDateString()}</span>
                </div>
                {campaign.burnInUntil && new Date(campaign.burnInUntil) > new Date() && (
                  <div className="flex items-center space-x-2 text-sm text-amber-600">
                    <span>⌛</span>
                    <span>Burn-in period until: {new Date(campaign.burnInUntil).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowDetails(false)}>Close</Button>
              {!hasGoals && (
                <Button onClick={() => { setShowDetails(false); setIsGoalModalOpen(true); }}>Set Goals</Button>
              )}
              {hasGoals && (
                <Button onClick={() => { setShowDetails(false); setIsGoalModalOpen(true); }}>Edit Goals</Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
