import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { corsOptions } from './config/cors.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { auditRouter } from './routes/audit.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { kpisRouter } from './routes/kpis.js';
import { lookupsRouter } from './routes/lookups.js';
import { mdBriefingExportRouter } from './routes/mdBriefingExport.js';
import { momRouter } from './routes/mom.js';
import { projectImportExportRouter } from './routes/projectImportExport.js';
import { preMonsoonRouter } from './routes/preMonsoon.js';
import { projectsRouter } from './routes/projects.js';
import { uploadsRouter } from './routes/uploads.js';
import { usersRouter } from './routes/users.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/lookups', lookupsRouter);
  app.use('/api/kpis', kpisRouter);
  // Import/export endpoints MUST mount BEFORE projectsRouter so their
  // static paths (/template.xlsx, /import, /export) aren't caught by the
  // dynamic `GET /:projectId` route inside projectsRouter.
  app.use('/api/projects', projectImportExportRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/mom', momRouter);
  app.use('/api/pre-monsoon', preMonsoonRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/md-briefing', mdBriefingExportRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
