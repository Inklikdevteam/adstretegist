import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface MetricsCardProps {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative";
  icon: LucideIcon;
  iconBgColor: string;
  iconColor: string;
}

export default function MetricsCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  iconBgColor,
  iconColor,
}: MetricsCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </div>
          <div className={`w-12 h-12 ${iconBgColor} rounded-lg flex items-center justify-center`}>
            <Icon className={`${iconColor} text-lg`} />
          </div>
        </div>
        <div className="mt-4 flex items-center">
          <span className={`text-sm font-medium ${
            changeType === "positive" ? "text-green-600" : "text-red-600"
          }`}>
            {change}
          </span>
          <span className="text-gray-500 text-sm ml-2">vs last week</span>
        </div>
      </CardContent>
    </Card>
  );
}
