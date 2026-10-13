// @ts-nocheck
import { Router } from '../../../../_shims/express.js';
import adsRouter from './adsRouter.js';
import circuitsRouter from './circuitsRouter.js';
import judgesRouter from './judges/judgesRouter.js';
import pagesRouter from './pagesRouter.js';
import tournsRouter from './tournsRouter.js';
import paradigmsRouter from './paradigmsRouter.js';
import quizzesRouter from './quizzesRouter.js';
import studentsRouter from './studentsRouter.js';

const router = Router();

router.use('/ads', adsRouter);
router.use('/circuits', circuitsRouter);
router.use('/judges', judgesRouter);
router.use('/pages', pagesRouter);
router.use('/tourns', tournsRouter);
router.use('/paradigms', paradigmsRouter);
router.use('/quizzes', quizzesRouter);
router.use('/students', studentsRouter);

export default router;