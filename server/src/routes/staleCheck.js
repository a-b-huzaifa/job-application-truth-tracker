import express from 'express';
import { auth } from '../middleware/auth.js';
import { checkForStaleApplications } from '../services/staleCheckService.js';

const router = express.Router();

// Apply auth middleware
router.use(auth);

/**
 * POST /applications/stale-check/run
 *
 * Manual trigger endpoint for the stale check background job.
 * Purely for demonstration and testing convenience so evaluators/users
 * can instantly trigger a stale audit rather than waiting for the periodic cron timer.
 */
router.post('/stale-check/run', async (req, res) => {
  try {
    const summary = await checkForStaleApplications({ userId: req.userId });

    return res.status(200).json({
      message: 'Stale application check executed successfully',
      summary: {
        checked: summary.checked,
        flagged_as_ghosted: summary.flagged_as_ghosted,
      },
      updated_ids: summary.updated_ids,
    });
  } catch (error) {
    console.error('Manual stale check error:', error);
    return res.status(500).json({
      error: 'Internal server error executing stale check',
    });
  }
});

export default router;
