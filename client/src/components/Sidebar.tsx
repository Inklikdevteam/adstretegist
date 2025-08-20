import { useAuth } from "@/hooks/useAuth";
import { Brain, BarChart3, Target, Settings, TrendingUp, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Sidebar() {
  const { user } = useAuth() as { user: any };

  const navigationItems = [
    { icon: BarChart3, label: "Dashboard", href: "#", active: true },
    { icon: Target, label: "Campaigns", href: "#", active: false },
    { icon: Brain, label: "AI Recommendations", href: "#", active: false },
    { icon: TrendingUp, label: "Performance", href: "#", active: false },
    { icon: Settings, label: "Settings", href: "#", active: false },
  ];

  return (
    <aside className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Brain className="text-white text-lg" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">AI Ads Expert</h1>
            <p className="text-sm text-gray-500">Smart Campaign Manager</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.label}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                item.active
                  ? "text-primary bg-blue-50"
                  : "text-gray-600 hover:text-primary hover:bg-gray-50"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3 px-4 py-3 mb-2">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            {user?.profileImageUrl ? (
              <img 
                src={user.profileImageUrl} 
                alt="Profile" 
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}`
                : user?.email || "User"
              }
            </p>
            <p className="text-xs text-gray-500">Admin</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-gray-600 hover:text-gray-900"
          onClick={() => window.location.href = '/api/logout'}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
