import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";
import { apiRequest } from "@/lib/queryClient";

export default function FloatingChatButton() {
  const { isAuthenticated } = useAuth();
  const [showChatInterface, setShowChatInterface] = useState(false);

  // Get campaigns for chat context
  const { data: campaigns = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns"],
    queryFn: () => apiRequest("GET", "/api/campaigns"),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  return (
    <>
      <Button
        onClick={() => setShowChatInterface(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200 z-40"
        data-testid="floating-chat-button"
      >
        <Bot className="w-6 h-6 text-white" />
      </Button>

      <ChatInterface
        campaigns={campaigns}
        isOpen={showChatInterface}
        onClose={() => setShowChatInterface(false)}
      />
    </>
  );
}