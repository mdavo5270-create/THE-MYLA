import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'the-myla-server',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});
