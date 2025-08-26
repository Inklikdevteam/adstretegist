import { useAuth } from "@/hooks/useAuth";
import { Brain, BarChart3, Target, Settings, TrendingUp, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";

export default function Sidebar() {
  const { user } = useAuth() as { user: any };
  const [location] = useLocation();

  const navigationItems = [
    { icon: BarChart3, label: "Dashboard", href: "/", active: location === "/" },
    { icon: Target, label: "Campaigns", href: "/campaigns", active: location === "/campaigns" },
    { icon: Brain, label: "AI Recommendations", href: "/recommendations", active: location === "/recommendations" },
    { icon: TrendingUp, label: "Performance", href: "/performance", active: location === "/performance" },
    { icon: Settings, label: "Settings", href: "/settings", active: location === "/settings" },
    // Only show Admin for admin users or show for all users (they'll see appropriate access control)
    { icon: Settings, label: "Admin", href: "/admin", active: location === "/admin" },
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
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 hover:shadow-md ${
                item.active
                  ? "text-primary bg-blue-50 shadow-sm scale-105"
                  : "text-gray-600 hover:text-primary hover:bg-gray-50"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
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
            <p className="text-xs text-gray-500">{user?.role === 'admin' ? 'Admin' : 'User'}</p>
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
