import express from 'express';
import { reply } from './_availability.cjs';
const router = express.Router();
router.all('/{*path}', (req: any, res: any) => reply(res, 'express-router', { method: req.method }));
const app = express();
app.use(router);
export default app;
