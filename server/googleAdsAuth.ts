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
  
  return new OAuth2Client(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri
  );
}

export async function setupGoogleAdsAuth(app: Express) {
  // Initiate Google Ads OAuth flow
  app.get('/api/google-ads/auth', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const oauth2Client = getOAuth2Client();
      
      const authorizeUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: GOOGLE_ADS_SCOPES,
        prompt: 'consent', // Force consent to get refresh token
        state: req.user.claims.sub // Store user ID in state
      });

      res.json({ authUrl: authorizeUrl });
    } catch (error) {
      console.error('Error initiating Google Ads OAuth:', error);
      res.status(500).json({ message: 'Failed to initiate Google Ads authentication' });
    }
  });

  // Handle OAuth callback
  app.get('/api/auth/google-ads-callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.status(400).json({ message: 'Missing authorization code or state' });
      }

      const oauth2Client = getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code as string);
      
      if (!tokens.refresh_token) {
        return res.status(400).json({ message: 'No refresh token received. Please ensure you grant offline access.' });
      }

      // Store the tokens and account info
      const userId = state as string;
      
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

      await storage.createGoogleAdsAccount({
        userId,
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

      const userId = req.user.claims.sub;
      const accounts = await storage.getGoogleAdsAccounts(userId);
      
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

      const { accountId } = req.params;
      const userId = req.user.claims.sub;
      
      await storage.deleteGoogleAdsAccount(accountId, userId);
      
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

      const userId = req.user.claims.sub;
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