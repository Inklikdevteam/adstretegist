import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "./use-toast";

export function useAuth() {
  const { toast } = useToast();

  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/auth/user"],
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    queryFn: async () => {
      try {
        const res = await fetch("/api/auth/user", {
          credentials: "include",
        });
        
        console.log('Auth Response:', res.status);
        
        if (res.status === 401) {
          return null;
        }
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        
        const data = await res.json();
        console.log('Auth Success:', !!data, { 
          username: data?.username, 
          role: data?.role 
        });
        return data;
      } catch (err) {
        console.error('Auth Error:', err);
        return null;
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout");
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear(); // Clear all cached data
      toast({
        title: "Logout successful",
        description: "You have been logged out successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isAuthenticated = !!user && !error;

  return {
    user,
    isLoading,
    isAuthenticated,
    refetch,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
