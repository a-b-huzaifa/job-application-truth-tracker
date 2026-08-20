import express from 'express';
import { auth } from '../middleware/auth.js';
import applicationRepository from '../repositories/applicationRepository.js';
import resumeRepository from '../repositories/resumeRepository.js';
import { analyzeApplicationFit } from '../services/analysisService.js';

const router = express.Router();

// Apply auth middleware to all analysis routes
router.use(auth);

// POST /applications/:id/analyze — Analyze job fit for an application
router.post('/:id/analyze', async (req, res) => {
  try {
    const applicationId = req.params.id;

    // 1. Fetch application owned by the authenticated user
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

    // 2. Fetch linked resume owned by the user
    const resume = await resumeRepository.getResumeById(application.resume_id, req.userId);
    if (!resume) {
      return res.status(404).json({
        error: 'Linked resume not found or does not belong to user',
      });
    }

    // 3. Perform analysis with SHA-256 caching
    const analysis = await analyzeApplicationFit(
      resume.content,
      application.job_description,
      application.id
    );

    return res.status(200).json({
      message: analysis.cached ? 'Analysis retrieved from cache' : 'Analysis generated successfully',
      application_id: application.id,
      fit_score: analysis.fit_score,
      mismatch_reasons: analysis.mismatch_reasons,
      cached: analysis.cached,
    });
  } catch (error) {
    console.error('Analyze application error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error performing fit analysis',
    });
  }
});

export default router;
