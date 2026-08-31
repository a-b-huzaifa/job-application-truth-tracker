import express from 'express';
import { auth } from '../middleware/auth.js';
import applicationRepository from '../repositories/applicationRepository.js';
import strategistActionRepository from '../repositories/strategistActionRepository.js';

const router = express.Router();

// Apply auth middleware to all strategist approval routes
router.use(auth);

/**
 * POST /applications/:id/strategist-actions/:actionId/approve
 *
 * Approves a proposed strategist action (e.g. REWRITE_SUGGESTED or SKIP_ROLE_RECOMMENDED).
 * In the same atomic transaction/operation, sets:
 *   - status = 'approved'
 *   - applied = true
 *   - applied_at = NOW()
 *   - resolved_at = NOW()
 *
 * IMPORTANT: This records that the human candidate reviewed and accepted the strategy decision.
 * It does NOT mutate, edit, or patch any resume records in the database.
 */
router.post('/:id/strategist-actions/:actionId/approve', async (req, res) => {
  try {
    const applicationId = req.params.id;
    const actionId = req.params.actionId;

    // 1. Verify application ownership
    const application = await applicationRepository.getApplicationById(applicationId, req.userId);
    if (!application) {
      return res.status(404).json({
        error: 'Application not found',
      });
    }

    // 2. Fetch existing strategist action record
    const existingAction = await strategistActionRepository.getStrategistActionById(
      actionId,
      req.userId,
      applicationId
    );

    if (!existingAction) {
      return res.status(404).json({
        error: 'Strategist action not found',
      });
    }

    if (existingAction.status !== 'pending') {
      return res.status(400).json({
        error: `Action has already been resolved with status: ${existingAction.status}`,
        action: existingAction,
      });
    }

    // 3. Atomically update action row to approved & applied=true
    const approvedAction = await strategistActionRepository.approveStrategistAction(
      actionId,
      req.userId,
      applicationId
    );

    return res.status(200).json({
      message: 'Strategist action approved successfully',
      action: approvedAction,
    });
  } catch (error) {
    console.error('Approve strategist action error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error approving strategist action',
    });
  }
});

/**
 * POST /applications/:id/strategist-actions/:actionId/reject
 *
 * Rejects a proposed strategist action.
 * Sets:
 *   - status = 'rejected'
 *   - applied = false
 *   - applied_at = NULL
 *   - resolved_at = NOW()
 */
router.post('/:id/strategist-actions/:actionId/reject', async (req, res) => {
  try {
    const applicationId = req.params.id;
    const actionId = req.params.actionId;

    // 1. Verify application ownership
    const application = await applicationRepository.getApplicationById(applicationId, req.userId);
    if (!application) {
      return res.status(404).json({
        error: 'Application not found',
      });
    }

    // 2. Fetch existing strategist action record
    const existingAction = await strategistActionRepository.getStrategistActionById(
      actionId,
      req.userId,
      applicationId
    );

    if (!existingAction) {
      return res.status(404).json({
        error: 'Strategist action not found',
      });
    }

    if (existingAction.status !== 'pending') {
      return res.status(400).json({
        error: `Action has already been resolved with status: ${existingAction.status}`,
        action: existingAction,
      });
    }

    // 3. Atomically update action row to rejected
    const rejectedAction = await strategistActionRepository.rejectStrategistAction(
      actionId,
      req.userId,
      applicationId
    );

    return res.status(200).json({
      message: 'Strategist action rejected successfully',
      action: rejectedAction,
    });
  } catch (error) {
    console.error('Reject strategist action error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error rejecting strategist action',
    });
  }
});

export default router;
