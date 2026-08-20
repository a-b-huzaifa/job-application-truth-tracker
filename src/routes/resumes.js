import express from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import resumeRepository from '../repositories/resumeRepository.js';

const router = express.Router();

// Apply auth middleware to all resume routes
router.use(auth);

const createResumeSchema = z.object({
  name: z.string().min(1, 'Resume name is required'),
  content: z.string().min(1, 'Resume content is required'),
});

const updateResumeSchema = z.object({
  name: z.string().min(1, 'Resume name cannot be empty').optional(),
  content: z.string().min(1, 'Resume content cannot be empty').optional(),
});

// POST /resumes — Create a new resume
router.post('/', async (req, res) => {
  try {
    const parseResult = createResumeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: (parseResult.error.issues || parseResult.error.errors || []).map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    const { name, content } = parseResult.data;
    const resume = await resumeRepository.createResume(req.userId, { name, content });

    return res.status(201).json({
      message: 'Resume created successfully',
      resume,
    });
  } catch (error) {
    console.error('Create resume error:', error);
    return res.status(500).json({
      error: 'Internal server error creating resume',
    });
  }
});

// GET /resumes — List all resumes for authenticated user
router.get('/', async (req, res) => {
  try {
    const resumes = await resumeRepository.getResumesByUserId(req.userId);
    return res.status(200).json({
      resumes,
    });
  } catch (error) {
    console.error('List resumes error:', error);
    return res.status(500).json({
      error: 'Internal server error fetching resumes',
    });
  }
});

// GET /resumes/:id — Get resume details by ID
router.get('/:id', async (req, res) => {
  try {
    const resume = await resumeRepository.getResumeById(req.params.id, req.userId);
    if (!resume) {
      return res.status(404).json({
        error: 'Resume not found',
      });
    }

    return res.status(200).json({
      resume,
    });
  } catch (error) {
    console.error('Get resume error:', error);
    return res.status(500).json({
      error: 'Internal server error fetching resume',
    });
  }
});

// PATCH /resumes/:id — Update resume by ID
router.patch('/:id', async (req, res) => {
  try {
    const parseResult = updateResumeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: (parseResult.error.issues || parseResult.error.errors || []).map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    const updated = await resumeRepository.updateResume(req.params.id, req.userId, parseResult.data);
    if (!updated) {
      return res.status(404).json({
        error: 'Resume not found',
      });
    }

    return res.status(200).json({
      message: 'Resume updated successfully',
      resume: updated,
    });
  } catch (error) {
    console.error('Update resume error:', error);
    return res.status(500).json({
      error: 'Internal server error updating resume',
    });
  }
});

// DELETE /resumes/:id — Delete resume by ID
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await resumeRepository.deleteResume(req.params.id, req.userId);
    if (!deleted) {
      return res.status(404).json({
        error: 'Resume not found',
      });
    }

    return res.status(200).json({
      message: 'Resume deleted successfully',
    });
  } catch (error) {
    console.error('Delete resume error:', error);
    return res.status(500).json({
      error: 'Internal server error deleting resume',
    });
  }
});

export default router;
