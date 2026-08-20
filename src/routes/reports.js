import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { auth } from '../middleware/auth.js';
import reportRepository from '../repositories/reportRepository.js';
import { buildReportData } from '../services/reportDataService.js';
import { generateReportPDF } from '../services/pdfReportService.js';

const router = express.Router();

// Apply auth middleware to all report endpoints
router.use(auth);

function getDefaultPeriod() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return {
    period_start: start.toISOString().split('T')[0],
    period_end: end.toISOString().split('T')[0],
  };
}

// POST /reports/generate — Generate a new weekly truth report PDF
router.post('/generate', async (req, res) => {
  try {
    let { period_start, period_end } = req.body || {};

    if (!period_start || !period_end) {
      const defaultPeriod = getDefaultPeriod();
      period_start = period_start || defaultPeriod.period_start;
      period_end = period_end || defaultPeriod.period_end;
    }

    // 1. Calculate aggregated funnel and conversion metrics
    const reportData = await buildReportData(req.userId, period_start, period_end);

    // 2. Determine output path
    const outputDir = process.env.OUTPUT_DIR || './outputs';
    const filename = `report_${crypto.randomUUID()}.pdf`;
    const fullPath = path.resolve(outputDir, filename);

    // 3. Generate PDF
    await generateReportPDF(reportData, fullPath);

    // 4. Save metadata to database
    const record = await reportRepository.createReportRecord(
      req.userId,
      period_start,
      period_end,
      fullPath
    );

    return res.status(201).json({
      message: 'Report generated successfully',
      report: {
        id: record.id,
        period_start: record.period_start,
        period_end: record.period_end,
        generated_at: record.generated_at,
        download_url: `/reports/${record.id}/download`,
      },
      summary: reportData.summary,
      resumes_breakdown: reportData.resumes,
      platforms_breakdown: reportData.platforms,
    });
  } catch (error) {
    console.error('Generate report error:', error);
    return res.status(500).json({
      error: 'Internal server error generating report',
      details: error.message,
    });
  }
});

// GET /reports — List generated reports for authenticated user
router.get('/', async (req, res) => {
  try {
    const reports = await reportRepository.getReportsByUserId(req.userId);
    const enriched = reports.map(r => ({
      id: r.id,
      period_start: r.period_start,
      period_end: r.period_end,
      generated_at: r.generated_at,
      download_url: `/reports/${r.id}/download`,
    }));

    return res.status(200).json({
      reports: enriched,
    });
  } catch (error) {
    console.error('List reports error:', error);
    return res.status(500).json({
      error: 'Internal server error fetching reports',
    });
  }
});

// GET /reports/:id/download — Download generated PDF
router.get('/:id/download', async (req, res) => {
  try {
    const report = await reportRepository.getReportById(req.params.id, req.userId);
    if (!report) {
      return res.status(404).json({
        error: 'Report not found',
      });
    }

    if (!fs.existsSync(report.file_path)) {
      return res.status(500).json({
        error: 'Report file is missing on disk. Please regenerate the report.',
      });
    }

    const filename = `truth_report_${report.period_start}_to_${report.period_end}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const fileStream = fs.createReadStream(report.file_path);
    return fileStream.pipe(res);
  } catch (error) {
    console.error('Download report error:', error);
    return res.status(500).json({
      error: 'Internal server error downloading report',
    });
  }
});

export default router;
