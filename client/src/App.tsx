import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/LoginPage";
import LoginError from "@/pages/LoginError";
import Dashboard from "@/pages/Dashboard";
import Campaigns from "@/pages/Campaigns";
import Recommendations from "@/pages/Recommendations";
import Performance from "@/pages/Performance";
import Settings from "@/pages/Settings";
import FloatingChatButton from "@/components/FloatingChatButton";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  console.log('Router:', { isAuthenticated, isLoading });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={LoginPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/login-error" component={LoginError} />
        <Route>
          <LoginPage />
        </Route>
      </Switch>
    );
  }

  
  return (
    <>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/campaigns" component={Campaigns} />
        <Route path="/recommendations" component={Recommendations} />
        <Route path="/performance" component={Performance} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
      <FloatingChatButton />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
