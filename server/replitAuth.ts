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
  const callbackURL = `${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}/api/callback`;
  console.log('OAuth Callback URL:', callbackURL);
  
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    callbackURL,
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
      
      // Upsert user first
      const user = await storage.upsertUser(userData);
      console.log(`User upserted successfully: ${user.id}`);
      
      // Handle Google Ads account connection only if we have a refresh token
      if (refreshToken) {
        try {
          console.log(`Processing Google Ads connection for user ${profile.id}`);
          
          // Store or update Google Ads connection
          const existingAccounts = await storage.getGoogleAdsAccounts(profile.id);
          
          if (existingAccounts.length > 0) {
            // Update the first active account with new tokens
            const activeAccount = existingAccounts.find(acc => acc.isActive) || existingAccounts[0];
            await storage.updateGoogleAdsAccount(activeAccount.id, {
              refreshToken,
              accessToken,
              tokenExpiresAt: null,
              isActive: true,
            });
            console.log(`Updated existing Google Ads account: ${activeAccount.customerId}`);
          } else {
            // Create new Google Ads account with default values
            await storage.createGoogleAdsAccount({
              userId: profile.id,
              customerId: 'pending-setup',
              customerName: 'Google Ads Account',
              refreshToken,
              accessToken,
              tokenExpiresAt: null,
              isActive: true,
              isPrimary: true,
            });
            console.log(`Created new Google Ads account connection`);
          }
        } catch (accountError) {
          console.warn('Could not store Google Ads account, continuing with auth:', accountError);
          // Don't fail authentication if Google Ads setup fails
        }
      }
      
      // Create session user object
      const sessionUser = {
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
      
      console.log(`OAuth callback completed successfully for user: ${profile.id}`);
      return done(null, sessionUser);
    } catch (error) {
      console.error('Error in Google OAuth callback:', error);
      // Don't expose internal errors to client
      return done(new Error('Authentication failed'), null);
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
    (req, res, next) => {
      passport.authenticate('google', (err, user, info) => {
        if (err) {
          console.error('OAuth authentication error:', err);
          return res.redirect('/login-error');
        }
        if (!user) {
          console.error('OAuth authentication failed - no user returned');
          return res.redirect('/login-error');
        }
        
        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error('Login session error:', loginErr);
            return res.redirect('/login-error');
          }
          console.log('User successfully logged in:', user.claims?.sub);
          return res.redirect('/');
        });
      })(req, res, next);
    }
  );

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect('/');
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Google OAuth session structure
  if (user.expires_at) {
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
  }

  // For Google OAuth users without expires_at, allow access
  if (user.claims && user.access_token) {
    return next();
  }

  return res.status(401).json({ message: "Unauthorized" });
};
