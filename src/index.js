import express from 'express';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import authRoutes from './routes/auth.js';
import resumeRoutes from './routes/resumes.js';
import applicationRoutes from './routes/applications.js';
import analyzeRoutes from './routes/analyze.js';
import staleCheckRoutes from './routes/staleCheck.js';
import reportRoutes from './routes/reports.js';
import { startStaleCheckJob } from './jobs/staleCheckJob.js';
import { auth } from './middleware/auth.js';

const app = express();

app.use(express.json());

// Mount API routes
app.use('/auth', authRoutes);
app.use('/resumes', resumeRoutes);
app.use('/applications', applicationRoutes);
app.use('/applications', analyzeRoutes);
app.use('/applications', staleCheckRoutes);
app.use('/reports', reportRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected verification endpoint
app.get('/protected', auth, (req, res) => {
  res.status(200).json({
    message: 'Access granted to protected resource',
    userId: req.userId,
  });
});

const PORT = process.env.PORT || 3000;
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule || (process.env.NODE_ENV !== 'test' && !process.env.npm_lifecycle_event?.includes('test'))) {
  app.listen(PORT, () => {
    console.log(`Job Application Truth Tracker server running on port ${PORT}`);
    startStaleCheckJob();
  });
}

export default app;
