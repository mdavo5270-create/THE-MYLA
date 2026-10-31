import { Router } from 'express';
import { env } from '../config/env.js';

export const worldRouter = Router();

/** World parameters. The client generates the same map from this seed. */
worldRouter.get('/', (_req, res) => {
  res.json({
    seed: env.WORLD_SEED,
    width: env.WORLD_SIZE,
    height: env.WORLD_SIZE,
  });
});
