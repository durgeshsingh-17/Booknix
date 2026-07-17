import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import routes from './routes';
import { notFoundHandler, errorHandler } from './middleware/error.middleware';
import { generalLimiter } from './middleware/rateLimit.middleware';
import { UPLOADS_DIR } from './middleware/upload.middleware';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // This API and its uploaded images are meant to be loaded from a
      // different origin (the Angular app on another port in dev, and
      // potentially another subdomain in prod) — helmet's default
      // same-origin policy would otherwise have the browser silently
      // refuse to render gallery/logo images even when the URL is correct.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser tools (curl/Postman send no Origin header) and configured origins.
        if (!origin || env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')) {
          return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );
  // Webhook signature verification needs the exact raw bytes, so these two
  // paths get a raw parser ahead of the general JSON parser below (body-parser
  // skips re-parsing a body it's already consumed, so this is safe to layer).
  app.use('/api/v1/payments/webhook/razorpay', express.raw({ type: 'application/json' }));
  app.use('/api/v1/payments/webhook/stripe', express.raw({ type: 'application/json' }));

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(generalLimiter);
  app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
