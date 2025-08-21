import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function LoginError() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Login Failed</CardTitle>
          <CardDescription>
            We encountered an issue while trying to log you in. This could be due to:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Authentication session expired</li>
            <li>• Google OAuth configuration issue</li>
            <li>• Network connectivity problem</li>
            <li>• Account access restrictions</li>
          </ul>
          
          <div className="space-y-3 pt-4">
            <Button asChild className="w-full">
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Try Again
              </Link>
            </Button>
            
            <p className="text-xs text-center text-muted-foreground">
              If the problem persists, please contact support or try again later.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}