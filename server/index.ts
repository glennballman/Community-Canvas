import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pg from "pg";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startPipelineScheduler } from "./pipelines";
import { tenantContext } from "./middleware/tenantContext";
import { attachTenantDb } from "./db/tenantDb";
import { optionalAuth } from "./middleware/auth";
import { 
  blockServiceKeyOnTenantRoutes, 
  resolveImpersonation, 
  blockPlatformStaffWithoutImpersonation 
} from "./middleware/guards";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const PgSession = pgSession(session);
const sessionPool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// DUAL SESSION ARCHITECTURE:
// 1. Platform staff session (cookie: platform_sid) - stored in cc_platform_sessions
// 2. Tenant session (cookie: tenant_sid) - stored in session table
// This ensures complete session isolation between platform staff and tenant users

// Platform staff session middleware - only used on /api/internal routes
const platformSession = session({
  store: new PgSession({
    pool: sessionPool,
    tableName: 'cc_platform_sessions',
    createTableIfMissing: true
  }),
  name: 'platform_sid',
  secret: (process.env.SESSION_SECRET || 'dev-session-secret') + '-platform',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000, // 8 hours for platform staff
    sameSite: 'strict', // Stricter for internal routes
    path: '/api/internal'
  }
});

// Tenant session middleware - used on all other routes
const tenantSession = session({
  store: new PgSession({
    pool: sessionPool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  name: 'tenant_sid',
  secret: process.env.SESSION_SECRET || 'dev-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
});

// Route-based session middleware
// Platform routes get platform session, all others get tenant session
app.use((req, res, next) => {
  if (req.path.startsWith('/api/internal')) {
    return platformSession(req, res, next);
  }
  return tenantSession(req, res, next);
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Parse JWT from Authorization header (if present) BEFORE tenantContext runs
// This ensures req.user is available for tenantContext to populate req.ctx.individual_id
app.use(optionalAuth as any);

app.use(tenantContext as any);
app.use(attachTenantDb);

// P0 HARDENING: Block service-key on tenant API routes
// Service-key is NOT accepted on /api/* routes (except /api/internal and /api/jobs)
// This prevents service-key from being used to bypass tenant authentication
app.use('/api', (req, res, next) => {
  // Allow /api/internal (uses platform staff session) and /api/jobs (background automation)
  if (req.path.startsWith('/internal') || req.path.startsWith('/jobs')) {
    return next();
  }
  // Block service-key on all other /api/* routes
  return blockServiceKeyOnTenantRoutes(req, res, next);
});

// P0 HARDENING: Enforce impersonation for platform staff on tenant routes
// Platform staff with platform_sid MUST have active impersonation to access tenant endpoints
// This chain: resolves impersonation -> blocks if platform staff without impersonation
app.use('/api', (req, res, next) => {
  // Skip /api/internal (uses its own guards) and /api/jobs (background automation)
  if (req.path.startsWith('/internal') || req.path.startsWith('/jobs')) {
    return next();
  }
  // Also skip foundation auth routes (login/register/me)
  if (req.path.startsWith('/foundation/auth')) {
    return next();
  }
  // Resolve any active impersonation session for platform staff
  resolveImpersonation(req, res, (err?: any) => {
    if (err) return next(err);
    // Block platform staff if no impersonation active
    blockPlatformStaffWithoutImpersonation(req, res, next);
  });
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      
      // Start the real-time data pipeline scheduler
      startPipelineScheduler();
    },
  );
})();
