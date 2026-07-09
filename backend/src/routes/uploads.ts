import { Router } from 'express';
import { createRouteHandler } from 'uploadthing/express';
import { env, isProduction } from '../env.js';
import { uploadFileRouter } from '../lib/uploadRouter.js';
import { requireAuth } from '../middleware/auth.js';

export const uploadsRouter = Router();

if (env.UPLOADTHING_TOKEN) {
  // Ensure req.user is populated before the UploadThing handler runs so
  // .middleware() inside the file router can rely on it.
  uploadsRouter.use(requireAuth);
  uploadsRouter.use(
    createRouteHandler({
      router: uploadFileRouter,
      config: {
        token: env.UPLOADTHING_TOKEN,
        isDev: !isProduction,
      },
    }),
  );
} else {
  const message = 'UploadThing is not configured (UPLOADTHING_TOKEN missing)';
  process.stderr.write(`warn: ${message} — /api/uploads/* will return 503\n`);
  uploadsRouter.all('*', (_req, res) => {
    res.status(503).json({ error: { code: 'UPLOADS_DISABLED', message } });
  });
}
