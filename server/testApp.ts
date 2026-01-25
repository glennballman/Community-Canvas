import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pg from "pg";
import { registerRoutes } from "./routes";
import { tenantContext } from "./middleware/tenantContext";
import { attachTenantDb } from "./db/tenantDb";
import { optionalAuth } from "./middleware/auth";
import { createServer } from "http";

export async function createTestApp() {
  const app = express();
  const httpServer = createServer(app);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: false }));

  const PgSession = pgSession(session);
  const sessionPool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  const tenantSession = session({
    store: new PgSession({
      pool: sessionPool,
      tableName: 'session',
      createTableIfMissing: true
    }),
    name: 'tenant_sid',
    secret: process.env.SESSION_SECRET || 'test-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    }
  });

  app.use(tenantSession);
  app.use(optionalAuth as any);
  app.use(tenantContext as any);
  app.use(attachTenantDb);

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ success: false, error: message });
  });

  return { app, httpServer, sessionPool };
}
