import express from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import applicationRepository from '../repositories/applicationRepository.js';
import resumeRepository from '../repositories/resumeRepository.js';

const router = express.Router();

// Apply auth middleware to all application routes
router.use(auth);

const statusEnum = z.enum([
  'applied',
  'response_received',
  'rejected',
  'ghosted',
  'interview',
]);

const createApplicationSchema = z.object({
  resume_id: z.string().uuid('Invalid resume UUID format').nullable().optional(),
  company_name: z.string().min(1, 'Company name is required'),
  role_title: z.string().min(1, 'Role title is required'),
  job_description: z.string().min(1, 'Job description is required'),
  job_url: z.string().url('Invalid URL').nullable().optional(),
  platform: z.string().min(1, 'Platform is required'),
  applied_at: z.string().min(1, 'Applied date is required'),
  status: statusEnum.optional().default('applied'),
});

const updateApplicationSchema = z.object({
  resume_id: z.string().uuid('Invalid resume UUID format').nullable().optional(),
  company_name: z.string().min(1, 'Company name cannot be empty').optional(),
  role_title: z.string().min(1, 'Role title cannot be empty').optional(),
  job_description: z.string().min(1, 'Job description cannot be empty').optional(),
  job_url: z.string().url('Invalid URL').nullable().optional(),
  platform: z.string().min(1, 'Platform cannot be empty').optional(),
  applied_at: z.string().min(1, 'Applied date cannot be empty').optional(),
  status: statusEnum.optional(),
});

// POST /applications — Create a new application
router.post('/', async (req, res) => {
  try {
    const parseResult = createApplicationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: (parseResult.error.issues || parseResult.error.errors || []).map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    const {
      resume_id,
      company_name,
      role_title,
      job_description,
      job_url,
      platform,
      applied_at,
      status,
    } = parseResult.data;

    // Verify resume ownership if resume_id is provided
    if (resume_id) {
      const ownedResume = await resumeRepository.getResumeById(resume_id, req.userId);
      if (!ownedResume) {
        return res.status(400).json({
          error: 'Invalid resume_id: Resume does not exist or does not belong to the user',
        });
      }
    }

    const newApp = await applicationRepository.createApplication(req.userId, {
      resume_id: resume_id || null,
      company_name,
      role_title,
      job_description,
      job_url: job_url || null,
      platform,
      applied_at,
      status: status || 'applied',
    });

    return res.status(201).json({
      message: 'Application created successfully',
      application: newApp,
    });
  } catch (error) {
    console.error('Create application error:', error);
    return res.status(500).json({
      error: 'Internal server error creating application',
    });
  }
});

// GET /applications — List applications with optional filtering & pagination
router.get('/', async (req, res) => {
  try {
    const { status, platform, resume_id, limit, offset } = req.query;

    const result = await applicationRepository.getApplicationsByUserId(req.userId, {
      status,
      platform,
      resumeId: resume_id,
      limit,
      offset,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('List applications error:', error);
    return res.status(500).json({
      error: 'Internal server error fetching applications',
    });
  }
});

// GET /applications/:id — Get application details by ID
router.get('/:id', async (req, res) => {
  try {
    const application = await applicationRepository.getApplicationById(req.params.id, req.userId);
    if (!application) {
      return res.status(404).json({
        error: 'Application not found',
      });
    }

    return res.status(200).json({
      application,
    });
  } catch (error) {
    console.error('Get application error:', error);
    return res.status(500).json({
      error: 'Internal server error fetching application',
    });
  }
});

// GET /applications/:id/analysis-history — Get saved LLM analysis history
router.get('/:id/analysis-history', async (req, res) => {
  try {
    const application = await applicationRepository.getApplicationById(req.params.id, req.userId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const { default: analysisRepository } = await import('../repositories/analysisRepository.js');
    const analysis = await analysisRepository.getAnalysisByApplicationId(application.id);

    if (!analysis) {
      return res.status(200).json({ analysis: null });
    }

    return res.status(200).json({
      analysis: {
        baseline: {
          fit_score: analysis.fit_score,
          mismatch_reasons: analysis.mismatch_reasons,
          cached: true,
        },
        agentic_v2: analysis.agentic_analysis || null,
      }
    });
  } catch (error) {
    console.error('Get analysis history error:', error);
    return res.status(500).json({
      error: 'Internal server error fetching analysis history',
    });
  }
});

// PATCH /applications/:id — Update application details or status
router.patch('/:id', async (req, res) => {
  try {
    const parseResult = updateApplicationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: (parseResult.error.issues || parseResult.error.errors || []).map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    const updates = parseResult.data;

    // Check ownership of updated resume_id if provided
    if (updates.resume_id) {
      const ownedResume = await resumeRepository.getResumeById(updates.resume_id, req.userId);
      if (!ownedResume) {
        return res.status(400).json({
          error: 'Invalid resume_id: Resume does not exist or does not belong to the user',
        });
      }
    }

    const updated = await applicationRepository.updateApplication(
      req.params.id,
      req.userId,
      updates
    );

    if (!updated) {
      return res.status(404).json({
        error: 'Application not found',
      });
    }

    return res.status(200).json({
      message: 'Application updated successfully',
      application: updated,
    });
  } catch (error) {
    console.error('Update application error:', error);
    return res.status(500).json({
      error: 'Internal server error updating application',
    });
  }
});

// DELETE /applications/:id — Delete application
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await applicationRepository.deleteApplication(req.params.id, req.userId);
    if (!deleted) {
      return res.status(404).json({
        error: 'Application not found',
      });
    }

    return res.status(200).json({
      message: 'Application deleted successfully',
    });
  } catch (error) {
    console.error('Delete application error:', error);
    return res.status(500).json({
      error: 'Internal server error deleting application',
    });
  }
});

export default router;
