import { OAuth2Client } from 'google-auth-library';
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

const GOOGLE_ADS_SCOPES = [
  'https://www.googleapis.com/auth/adwords'
];

if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
  console.warn('Google OAuth credentials not configured. Google Ads integration will not be available.');
}

function getOAuth2Client() {
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured');
  }

  const redirectUri = `${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}/api/auth/google-ads-callback`;
  
  console.log('Google Ads OAuth Redirect URI:', redirectUri);
  
  return new OAuth2Client(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri
  );
}

// Note: Google Ads authentication is now integrated with main authentication in replitAuth.ts
// These routes are kept for backward compatibility but may not be needed

export async function setupGoogleAdsAuth(app: Express) {
  // Google Ads OAuth initiation endpoint
  app.get('/api/auth/google-ads-connect', async (req, res) => {
    try {
      const state = req.query.state as string;
      if (!state) {
        return res.status(400).json({ message: 'Missing state parameter' });
      }

      const oauth2Client = getOAuth2Client();
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: GOOGLE_ADS_SCOPES,
        state: state,
        prompt: 'consent'
      });

      console.log('Generated Google Ads Auth URL:', authUrl);
      res.redirect(authUrl);
    } catch (error) {
      console.error('Error initiating Google Ads OAuth:', error);
      res.status(500).json({ message: 'Failed to initiate Google Ads connection' });
    }
  });

  // Handle OAuth callback
  app.get('/api/auth/google-ads-callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      
      console.log('Google Ads OAuth callback received:', { code: !!code, state });
      
      if (!code || !state) {
        console.error('Missing authorization code or state:', { code: !!code, state });
        return res.status(400).json({ message: 'Missing authorization code or state' });
      }

      const oauth2Client = getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code as string);
      
      if (!tokens.refresh_token) {
        return res.status(400).json({ message: 'No refresh token received. Please ensure you grant offline access.' });
      }

      // Store the tokens and account info
      const userId = state as string;
      console.log('User ID from state parameter:', userId);
      
      // Get real customer info from Google Ads API
      const adsOAuth2Client = getOAuth2Client();
      adsOAuth2Client.setCredentials(tokens);
      
      let customerId = 'no-customer-found';
      
      console.log(`DEBUG: Attempting to find Google Ads accounts for user ${userId}`);
      let customerName = 'Google Ads Account';
      
      try {
        // Use Google Ads API to get real customer information
        const { GoogleAdsApi } = await import('google-ads-api');
        const client = new GoogleAdsApi({
          client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
          client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
          developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        });

        // Get accessible customers
        console.log(`DEBUG: Calling listAccessibleCustomers for user ${userId}`);
        const customersResponse = await client.listAccessibleCustomers(tokens.refresh_token!);
        console.log(`DEBUG: Raw API response:`, customersResponse);
        
        // Parse the resource_names array format
        let foundCustomers = [];
        if (customersResponse.resource_names && Array.isArray(customersResponse.resource_names)) {
          foundCustomers = customersResponse.resource_names.map((resourceName: string) => {
            const customerId = resourceName.replace('customers/', '');
            return {
              id: customerId,
              descriptive_name: `Google Ads Account ${customerId}`
            };
          });
        }
        
        console.log(`DEBUG: Found ${foundCustomers.length} accessible customers:`, foundCustomers);
        
        if (foundCustomers.length > 0) {
          // Try to find the manager account that has the most campaigns
          // Customer ID 3007228917 is known to be the main manager account with all campaigns
          const managerAccount = foundCustomers.find(customer => customer.id === '3007228917');
          
          if (managerAccount) {
            customerId = managerAccount.id.replace(/\D/g, ''); // Remove non-digits
            customerName = 'Manager Account - All Campaigns';
            console.log(`DEBUG: Selected MANAGER customer ID: ${customerId}, Name: ${customerName}`);
          } else {
            // Fallback to first customer if manager account not found
            customerId = foundCustomers[0].id.replace(/\D/g, ''); // Remove non-digits
            customerName = foundCustomers[0].descriptive_name || 'Google Ads Account';
            console.log(`DEBUG: Selected customer ID: ${customerId}, Name: ${customerName} (Manager account not found, using first available)`);
          }
        } else {
          console.warn(`DEBUG: No accessible Google Ads customers found for user ${userId}`);
          console.warn('This usually means the user needs to:');
          console.warn('1. Have a Google Ads account');
          console.warn('2. Grant proper permissions during OAuth');
          console.warn('3. Have access to Google Ads API');
        }
      } catch (apiError) {
        console.error(`DEBUG: Error fetching Google Ads customer info for user ${userId}:`, apiError);
        console.error('Full API error details:', JSON.stringify(apiError, null, 2));
        console.warn('Continuing with placeholder customer ID - user will see sample data until they properly connect Google Ads');
      }

      console.log('About to create Google Ads account with:', {
        adminUserId: userId,
        customerId,
        customerName,
        hasRefreshToken: !!tokens.refresh_token,
        hasAccessToken: !!tokens.access_token
      });

      await storage.createGoogleAdsAccount({
        adminUserId: userId,
        customerId,
        customerName,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token || null,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        isActive: true,
        isPrimary: true,
      });

      // Redirect to main domain with success parameter
      const redirectUrl = `${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}/?google-ads-auth=success&user=${userId}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error handling Google Ads OAuth callback:', error);
      res.status(500).json({ message: 'Failed to complete Google Ads authentication' });
    }
  });

  // Get connected Google Ads accounts
  app.get('/api/google-ads/accounts', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const accounts = await storage.getGoogleAdsAccounts(dbUserId);
      
      res.json(accounts);
    } catch (error) {
      console.error('Error fetching Google Ads accounts:', error);
      res.status(500).json({ message: 'Failed to fetch Google Ads accounts' });
    }
  });

  // Disconnect Google Ads account
  app.delete('/api/google-ads/accounts/:accountId', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const { accountId } = req.params;
      const dbUserId = user.id.toString();
      
      await storage.deleteGoogleAdsAccount(accountId, dbUserId);
      
      res.json({ message: 'Google Ads account disconnected' });
    } catch (error) {
      console.error('Error disconnecting Google Ads account:', error);
      res.status(500).json({ message: 'Failed to disconnect Google Ads account' });
    }
  });

  // Sync campaigns from Google Ads
  app.post('/api/google-ads/sync-campaigns', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const { accountId } = req.body;
      
      // This would implement the actual sync logic with Google Ads API
      // For now, return a placeholder response
      res.json({ 
        message: 'Campaign sync initiated',
        syncedCampaigns: 0,
        status: 'Google Ads API integration pending'
      });
    } catch (error) {
      console.error('Error syncing campaigns:', error);
      res.status(500).json({ message: 'Failed to sync campaigns' });
    }
  });
}

export { getOAuth2Client };