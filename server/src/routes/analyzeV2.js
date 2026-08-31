import express from 'express';
import { auth } from '../middleware/auth.js';
import applicationRepository from '../repositories/applicationRepository.js';
import resumeRepository from '../repositories/resumeRepository.js';
import { analyzeApplicationFit } from '../services/analysisService.js';
import { runAgenticAnalysis } from '../services/agentic/orchestratorService.js';
import { getResumePatternWarnings } from '../services/agentic/memoryService.js';
import strategistActionRepository from '../repositories/strategistActionRepository.js';

const router = express.Router();

// Apply auth middleware to all analysis routes
router.use(auth);

/**
 * POST /applications/:id/analyze-v2
 *
 * Executes both the single-prompt baseline (analysisService) and the
 * multi-agent pipeline (orchestratorService: Extractor -> Matcher -> Verifier -> Strategist)
 * on the same application, presenting the results side-by-side.
 */
router.post('/:id/analyze-v2', async (req, res) => {
  try {
    const applicationId = req.params.id;

    // 1. Fetch application owned by authenticated user
    const application = await applicationRepository.getApplicationById(applicationId, req.userId);
    if (!application) {
      return res.status(404).json({
        error: 'Application not found',
      });
    }

    if (!application.resume_id) {
      return res.status(400).json({
        error: 'Application has no linked resume. Please link a resume before analyzing.',
      });
    }

    // 2. Fetch linked resume owned by user
    const resume = await resumeRepository.getResumeById(application.resume_id, req.userId);
    if (!resume) {
      return res.status(404).json({
        error: 'Linked resume not found or does not belong to user',
      });
    }

    // 3. Run single-call baseline analysis
    const baselineAnalysis = await analyzeApplicationFit(
      resume.content,
      application.job_description,
      application.id
    );

    // 4. Run 4-stage agentic analysis with persistent resumeId tracking
    const agenticResult = await runAgenticAnalysis({
      resumeContent: resume.content,
      jobDescription: application.job_description,
      resumeId: resume.id,
    });

    // 5. Persist generated strategist actions as pending decision records
    const persistedActions = [];
    for (const action of (agenticResult.strategist_actions || [])) {
      const persisted = await strategistActionRepository.createStrategistAction({
        userId: req.userId,
        applicationId: application.id,
        actionType: action.action,
        payload: {
          claim: action.claim,
          reasoning: action.reasoning,
          suggested_rewrite: action.suggested_rewrite || null,
          caveat_note: action.caveat_note || null,
          requires_human_approval: action.requires_human_approval,
        },
        status: 'pending',
        applied: false,
      });
      persistedActions.push({
        id: persisted.id,
        ...action,
        status: persisted.status,
        applied: persisted.applied,
      });
    }

    // 6. Fetch historical pattern warnings for this resume variant
    const memoryData = await getResumePatternWarnings(resume.id);

    return res.status(200).json({
      message: 'Analysis v2 generated successfully',
      application_id: application.id,
      company_name: application.company_name,
      role_title: application.role_title,
      baseline: {
        fit_score: baselineAnalysis.fit_score,
        mismatch_reasons: baselineAnalysis.mismatch_reasons,
        cached: baselineAnalysis.cached,
      },
      agentic_v2: {
        baseline_score: agenticResult.baseline_score,
        verified_score: agenticResult.verified_score,
        mismatch_reasons: agenticResult.mismatch_reasons,
        verifications: agenticResult.verifications,
        strategist_actions: persistedActions.length > 0 ? persistedActions : agenticResult.strategist_actions,
        overall_strategy: agenticResult.overall_strategy,
        pattern_warnings: memoryData.pattern_warnings,
        trajectory: agenticResult.trajectory,
      },
    });
  } catch (error) {
    console.error('Analyze v2 application error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error performing agentic fit analysis',
    });
  }
});

export default router;
