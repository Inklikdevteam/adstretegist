import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Target, TrendingUp, Zap } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center">
              <Brain className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            AI-Powered Google Ads Expert
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Get intelligent campaign recommendations, automated optimizations, and expert insights 
            powered by advanced AI. Let our virtual ads manager handle the complexity while you focus on growth.
          </p>
          <Button size="lg" className="text-lg px-8 py-6" onClick={() => window.location.href = '/api/login'}>
            Start Optimizing Your Campaigns
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Smart Recommendations</h3>
              <p className="text-gray-600">
                Daily AI-powered insights categorized as actionable changes, monitoring alerts, or clarification requests.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Performance Tracking</h3>
              <p className="text-gray-600">
                Monitor CPA, ROAS, conversions, and spend across all campaigns with intelligent goal management.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Automated Optimization</h3>
              <p className="text-gray-600">
                AI analyzes campaign changes, respects burn-in periods, and provides confident optimization decisions.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Google Ads?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of advertisers using AI to optimize their campaigns and maximize ROI.
          </p>
          <Button 
            size="lg" 
            variant="secondary" 
            className="text-lg px-8 py-6" 
            onClick={() => window.location.href = '/api/login'}
          >
            Get Started Now
          </Button>
        </div>
      </div>
    </div>
  );
}
