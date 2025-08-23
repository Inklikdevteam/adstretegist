import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Zap, TrendingUp, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { formatChatMessage } from "@/utils/aiFormatting";

interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  provider?: string;
  confidence?: number;
  context?: any;
}

interface ChatInterfaceProps {
  campaigns: any[];
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatInterface({ campaigns = [], isOpen, onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
      content: 'Welcome to your AI Campaign Assistant! Ask me anything about your campaigns, performance, or optimization strategies. I can analyze your data and provide personalized recommendations.',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('OpenAI');
  const [availableProviders, setAvailableProviders] = useState<string[]>(['OpenAI']);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Fetch available AI providers
    const fetchProviders = async () => {
      try {
        const response = await apiRequest("GET", "/api/ai/providers");
        setAvailableProviders(response.available);
      } catch (error) {
        console.error('Error fetching AI providers:', error);
      }
    };

    if (isOpen) {
      fetchProviders();
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Enhanced campaign detection with better pattern matching
      let targetCampaign = null;
      
      // Look for campaign names mentioned in the input
      if (campaigns && campaigns.length > 0) {
        // First try to find exact campaign name matches
        targetCampaign = campaigns.find(c => {
          const campaignName = c.name.toLowerCase();
          const inputLower = input.toLowerCase();
          // Check for exact name mentions or partial matches
          return inputLower.includes(campaignName) || 
                 campaignName.includes(inputLower.replace(/[^a-z0-9\s]/g, '').trim());
        });

        // If no exact match, try finding by keywords (incrediblegifts, pmax, etc.)
        if (!targetCampaign) {
          const keywords = input.toLowerCase().match(/\b(?:incrediblegifts|pmax|sleep\s*spa|inklik|sanfort|ingrid|teenager|bina|frons|gsl)\b/g);
          if (keywords && keywords.length > 0) {
            targetCampaign = campaigns.find(c => {
              const campaignName = c.name.toLowerCase();
              return keywords.some(keyword => campaignName.includes(keyword.replace(/\s+/g, '')));
            });
          }
        }
      }

      // Generate AI response using new general chat endpoint
      let response;
      if (input.toLowerCase().includes('consensus') || input.toLowerCase().includes('compare')) {
        // Use consensus generation for comparison queries
        response = await apiRequest("POST", "/api/chat/consensus", {
          query: input,
          campaignId: targetCampaign?.id,
          provider: selectedProvider,
          campaigns: campaigns.slice(0, 5) // Send top 5 campaigns for context
        });
        
        const aiMessage: ChatMessage = {
          id: Date.now().toString() + '_ai',
          type: 'ai',
          content: response.response || response.consensus?.finalRecommendation || 'No recommendation received',
          timestamp: new Date(),
          provider: response.consensus?.models?.join(', ') || 'Consensus',
          confidence: response.consensus?.confidence || response.confidence || 0,
          context: {
            agreementLevel: response.consensus?.agreementLevel || 0,
            modelsUsed: response.consensus?.models?.length || 0
          }
        };
        
        setMessages(prev => [...prev, aiMessage]);
      } else {
        // Use general chat endpoint for all queries
        response = await apiRequest("POST", "/api/chat/query", {
          query: input,
          campaignId: targetCampaign?.id,
          provider: selectedProvider,
          campaigns: campaigns.slice(0, 10) // Send campaign context
        });
        
        const aiMessage: ChatMessage = {
          id: Date.now().toString() + '_ai',
          type: 'ai',
          content: response?.response || response?.content || 'No response received',
          timestamp: new Date(),
          provider: response?.provider || selectedProvider,
          confidence: response?.confidence || 0,
          context: {
            model: response?.model || 'Unknown',
            reasoning: response?.reasoning || 'No reasoning provided'
          }
        };
        
        setMessages(prev => [...prev, aiMessage]);
      }

      // Update available providers after each interaction
      try {
        const providersResponse = await apiRequest("GET", "/api/ai/providers");
        setAvailableProviders(providersResponse.available || ['OpenAI']);
      } catch (providerError) {
        console.error('Error fetching providers:', providerError);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + '_error',
        type: 'system',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestedQueries = [
    "How are my campaigns performing this week?",
    "Which campaign needs the most attention?",
    "Generate consensus recommendations for optimization",
    "What's the best strategy to improve my ROAS?",
    "Compare performance across all my campaigns",
    "Should I increase or decrease my budgets?"
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">AI Campaign Assistant</h3>
              <p className="text-sm text-gray-500">Natural language campaign analysis</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <select 
              value={selectedProvider} 
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="text-xs border rounded px-2 py-1"
            >
              {(availableProviders || ['OpenAI']).map(provider => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        </div>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {(messages || []).map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${
                message.type === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : message.type === 'system'
                  ? 'bg-gray-100 text-gray-700'
                  : 'bg-white border'
              } rounded-lg p-3`}>
                <div className="flex items-start space-x-2">
                  {message.type === 'user' ? (
                    <User className="w-4 h-4 mt-1 flex-shrink-0" />
                  ) : message.type === 'ai' ? (
                    <Sparkles className="w-4 h-4 mt-1 flex-shrink-0 text-primary" />
                  ) : (
                    <Zap className="w-4 h-4 mt-1 flex-shrink-0 text-gray-500" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                      {formatChatMessage(message.content)}
                    </div>
                    
                    {message.provider && (
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {message.provider}
                        </Badge>
                        {message.confidence && (
                          <Badge variant={message.confidence > 80 ? "default" : "secondary"} className="text-xs">
                            {message.confidence}% confidence
                          </Badge>
                        )}
                        {message.context?.agreementLevel && (
                          <Badge variant="outline" className="text-xs">
                            {message.context.agreementLevel}% agreement
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border rounded-lg p-3 max-w-[80%]">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-sm text-gray-500">AI is analyzing...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Suggested queries */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-gray-500 mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {(suggestedQueries || []).map((query, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-1 px-2"
                  onClick={() => setInput(query)}
                >
                  {query}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border-t">
          <div className="flex space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your campaigns..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              size="sm"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Press Enter to send • Current campaigns: {campaigns?.length || 0}
          </p>
        </div>
      </Card>
    </div>
  );
}