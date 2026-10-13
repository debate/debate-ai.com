// @ts-nocheck
import { Router } from '../../../../../../_shims/express.js';
import ballotsRouter from './ballotsRouter.js';
import { loadPanelAuthContext } from '../../../../../../middleware/auth/authContext.js';
import { requireJudgeOnPanel } from '../../../../../../policy/judgePolicy.js';

// /v1/rest/judges/:judgeId/panels
const router = Router({ mergeParams: true });

router.param('panelId', loadPanelAuthContext);
router.use('/:panelId', requireJudgeOnPanel);

router.use('/:panelId/ballots', ballotsRouter);

export default router;
