import express from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import resumeRepository from '../repositories/resumeRepository.js';
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const router = express.Router();

// Apply auth middleware to all resume routes
router.use(auth);

const upload = multer({ storage: multer.memoryStorage() });

const createResumeSchema = z.object({
  name: z.string().min(1, 'Resume name is required'),
  content: z.string().min(1, 'Resume content is required'),
});

const updateResumeSchema = z.object({
  name: z.string().min(1, 'Resume name cannot be empty').optional(),
  content: z.string().min(1, 'Resume content cannot be empty').optional(),
});

// POST /resumes/upload — Upload a PDF or DOCX and extract text
router.post('/upload', upload.single('resume_file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, buffer, mimetype } = req.file;
    let extractedText = '';

    if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
      const data = await pdfParse(buffer);
      extractedText = data.text;
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      originalname.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Only PDF and DOCX are allowed.' });
    }

    if (!extractedText || extractedText.trim() === '') {
      return res.status(400).json({ error: 'Failed to extract text from the document, or it is empty.' });
    }

    const resumeName = req.body.name || originalname;
    const resume = await resumeRepository.createResume(req.userId, { 
      name: resumeName, 
      content: extractedText.trim() 
    });

    return res.status(201).json({
      message: 'Resume uploaded and parsed successfully',
      resume,
    });
  } catch (error) {
    console.error('Upload resume error:', error);
    return res.status(500).json({ error: 'Internal server error uploading resume' });
  }
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

import { tailorResume } from '../services/agentic/tailorService.js';

// POST /resumes/:id/tailor — Tailor an existing resume for a specific role
router.post('/:id/tailor', async (req, res) => {
  try {
    const { job_description, role_title, company_name } = req.body;
    
    if (!job_description || !role_title || !company_name) {
      return res.status(400).json({ error: 'job_description, role_title, and company_name are required' });
    }

    const baseResume = await resumeRepository.getResumeById(req.params.id, req.userId);
    if (!baseResume) {
      return res.status(404).json({ error: 'Base resume not found' });
    }

    const tailoredContent = await tailorResume(baseResume.content, job_description, role_title, company_name);
    
    const newResumeName = `Tailored: ${role_title} @ ${company_name}`;
    const newResume = await resumeRepository.createResume(req.userId, {
      name: newResumeName,
      content: tailoredContent
    });

    return res.status(201).json({
      message: 'Resume tailored successfully',
      resume: newResume,
    });
  } catch (error) {
    console.error('Tailor resume error:', error);
    return res.status(500).json({ error: 'Internal server error tailoring resume' });
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

import { getResumePatternWarnings } from '../services/agentic/memoryService.js';

// GET /resumes/:id/insights — Expose historical verifier flag patterns and warnings
router.get('/:id/insights', async (req, res) => {
  try {
    const resume = await resumeRepository.getResumeById(req.params.id, req.userId);
    if (!resume) {
      return res.status(404).json({
        error: 'Resume not found',
      });
    }

    const insights = await getResumePatternWarnings(resume.id);

    return res.status(200).json({
      resume_id: resume.id,
      resume_name: resume.name,
      ...insights,
    });
  } catch (error) {
    console.error('Get resume insights error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error fetching resume insights',
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
