import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

// Google OAuth strategy for combined authentication + Google Ads access
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Google OAuth Strategy with Google Ads permissions
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    callbackURL: `${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}/api/callback`,
    scope: [
      'openid',
      'email', 
      'profile',
      'https://www.googleapis.com/auth/adwords'  // Google Ads API access
    ],
    accessType: 'offline',
    prompt: 'consent'
  },
  async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      console.log(`Google OAuth callback for user: ${profile.id}`);
      
      // Create user from Google profile
      const userData = {
        id: profile.id,
        email: profile.emails?.[0]?.value || null,
        firstName: profile.name?.givenName || null,
        lastName: profile.name?.familyName || null,
        profileImageUrl: profile.photos?.[0]?.value || null,
      };
      
      // Upsert user
      await storage.upsertUser(userData);
      
      // Get Google Ads customer info if we have tokens
      let customerId = 'no-customer-found';
      let customerName = 'Google Ads Account';
      
      if (refreshToken) {
        try {
          console.log(`Attempting to get Google Ads accounts for user ${profile.id}`);
          const { GoogleAdsApi } = await import('google-ads-api');
          const client = new GoogleAdsApi({
            client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
            client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
            developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
          });

          const customersResponse = await client.listAccessibleCustomers(refreshToken);
          
          if (customersResponse.resource_names && Array.isArray(customersResponse.resource_names)) {
            const foundCustomers = customersResponse.resource_names.map((resourceName: string) => {
              const customerId = resourceName.replace('customers/', '');
              return { id: customerId, descriptive_name: `Google Ads Account ${customerId}` };
            });
            
            if (foundCustomers.length > 0) {
              // Try to find the manager account that has the most campaigns
              const managerAccount = foundCustomers.find(customer => customer.id === '3007228917');
              
              if (managerAccount) {
                customerId = managerAccount.id;
                customerName = 'Manager Account - All Campaigns';
                console.log(`Selected MANAGER customer ID: ${customerId}`);
              } else {
                customerId = foundCustomers[0].id;
                customerName = foundCustomers[0].descriptive_name || 'Google Ads Account';
                console.log(`Selected customer ID: ${customerId}`);
              }
            }
          }
        } catch (adsError) {
          console.warn('Could not get Google Ads info during login:', adsError);
        }
        
        // Store Google Ads connection
        await storage.createGoogleAdsAccount({
          userId: profile.id,
          customerId,
          customerName,
          refreshToken,
          accessToken,
          tokenExpiresAt: null,
          isActive: true,
          isPrimary: true,
        });
      }
      
      // Create session user object
      const user = {
        claims: {
          sub: profile.id,
          email: userData.email,
          first_name: userData.firstName,
          last_name: userData.lastName,
          profile_image_url: userData.profileImageUrl
        },
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      };
      
      return done(null, user);
    } catch (error) {
      console.error('Error in Google OAuth callback:', error);
      return done(error, null);
    }
  }));

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Google OAuth routes
  app.get("/api/login", 
    passport.authenticate('google', { 
      scope: [
        'openid',
        'email', 
        'profile',
        'https://www.googleapis.com/auth/adwords'
      ],
      accessType: 'offline',
      prompt: 'consent'
    })
  );

  app.get("/api/callback", 
    passport.authenticate('google', { 
      successRedirect: '/',
      failureRedirect: '/login-error'
    })
  );

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect('/');
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
