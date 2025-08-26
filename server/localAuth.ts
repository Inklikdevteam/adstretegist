import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, loginSchema, createUserSchema } from "@shared/schema";
import connectPg from "connect-pg-simple";

declare global {
  namespace Express {
    interface User extends User {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

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
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
      sameSite: 'lax',
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  
  // Add CORS headers for session cookies
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    next();
  });
  
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Local Strategy for username/password authentication
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !user.isActive) {
          return done(null, false, { message: 'Invalid username or password' });
        }
        
        const isValidPassword = await comparePasswords(password, user.password);
        if (!isValidPassword) {
          return done(null, false, { message: 'Invalid username or password' });
        }

        // Update last login time
        await storage.updateUserLastLogin(user.id);
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user: Express.User, cb) => cb(null, user.id));
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await storage.getUser(id);
      cb(null, user);
    } catch (error) {
      cb(error);
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error.issues });
      }

      passport.authenticate('local', (err: any, user: any, info: any) => {
        if (err) {
          return res.status(500).json({ message: "Authentication error" });
        }
        if (!user) {
          return res.status(401).json({ message: info.message || "Invalid credentials" });
        }

        req.logIn(user, (loginErr) => {
          if (loginErr) {
            return res.status(500).json({ message: "Login error" });
          }
          
          const userResponse = {
            id: user.id,
            username: user.username,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            role: user.role,
            profileImageUrl: user.profileImageUrl || null
          };
          
          return res.json({ message: "Login successful", user: userResponse });
        });
      })(req, res, next);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie('connect.sid');
        res.json({ message: "Logout successful" });
      });
    });
  });

  // Register endpoint (admin only)
  app.post("/api/auth/register", isAuthenticated, async (req, res) => {
    try {
      // Only admins can create new users
      const currentUser = req.user as User;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can create new users" });
      }

      const result = createUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error.issues });
      }

      const { username, password, email, firstName, lastName } = result.data;

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Create new user
      const hashedPassword = await hashPassword(password);
      const userData = {
        username,
        password: hashedPassword,
        email: email || null,
        firstName: firstName || null,
        lastName: lastName || null,
        role: 'sub_account' as const,
        isActive: true,
        createdBy: currentUser.id,
      };

      const newUser = await storage.createUser(userData);
      
      const userResponse = {
        id: newUser.id,
        username: newUser.username,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt
      };

      res.status(201).json({ message: "User created successfully", user: userResponse });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });
}

export const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const user = req.user as User;
  if (!user.isActive) {
    return res.status(401).json({ message: "Account is inactive" });
  }
  
  next();
};

export const isAdmin = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const user = req.user as User;
  if (user.role !== 'admin') {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  next();
};

export { hashPassword, comparePasswords };