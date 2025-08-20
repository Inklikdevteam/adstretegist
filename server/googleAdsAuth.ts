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
        const customers = await client.listAccessibleCustomers(tokens.refresh_token!);
        
        if (customers.length > 0) {
          // Use the first accessible customer
          customerId = customers[0].id.replace(/\D/g, ''); // Remove non-digits
          customerName = customers[0].descriptive_name || 'Google Ads Account';
          console.log('Found Google Ads customer:', customerId, customerName);
        } else {
          console.warn('No accessible Google Ads customers found');
        }
      } catch (apiError) {
        console.error('Error fetching Google Ads customer info:', apiError);
        // Continue with placeholder - better than failing the auth
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