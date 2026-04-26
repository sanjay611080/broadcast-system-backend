import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import path from 'node:path';
import fs from 'node:fs';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error';
import { env } from './config/env';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1); 
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  if (env.nodeEnv !== 'test') app.use(morgan('dev'));

  // OpenAPI / Swagger UI (best-effort — silent if file missing)
  const openapiPath = path.join(__dirname, '..', 'openapi.json');
  if (fs.existsSync(openapiPath)) {
    const spec = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec));
  }

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
