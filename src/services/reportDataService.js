import { query } from '../db.js';

/**
 * Builds structured metrics data for job application reporting over a date range.
 *
 * @param {string} userId - User UUID
 * @param {string|Date} periodStart - Start date (YYYY-MM-DD)
 * @param {string|Date} periodEnd - End date (YYYY-MM-DD)
 * @returns {Promise<object>}
 */
export async function buildReportData(userId, periodStart, periodEnd) {
  // Format dates to ISO date string YYYY-MM-DD
  const startDateStr = typeof periodStart === 'string'
    ? periodStart.split('T')[0]
    : new Date(periodStart).toISOString().split('T')[0];
  const endDateStr = typeof periodEnd === 'string'
    ? periodEnd.split('T')[0]
    : new Date(periodEnd).toISOString().split('T')[0];

  // 1. Fetch all applications in the period with linked resume details
  const appsRes = await query(
    `SELECT 
      a.id, a.user_id, a.resume_id, a.company_name, a.role_title,
      a.platform, a.applied_at, a.status,
      r.name as resume_name
    FROM applications a
    LEFT JOIN resumes r ON a.resume_id = r.id
    WHERE a.user_id = $1
      AND a.applied_at >= $2
      AND a.applied_at <= $3
    ORDER BY a.applied_at ASC`,
    [userId, startDateStr, endDateStr]
  );

  const applications = appsRes.rows;
  const totalApplications = applications.length;

  let responsesCount = 0;
  let rejectionsCount = 0;
  let ghostedCount = 0;
  let appliedCount = 0;

  const resumeMap = new Map();
  const platformMap = new Map();

  for (const app of applications) {
    const isResponse = app.status === 'response_received' || app.status === 'interview';
    const isRejected = app.status === 'rejected';
    const isGhosted = app.status === 'ghosted';

    if (isResponse) responsesCount += 1;
    if (isRejected) rejectionsCount += 1;
    if (isGhosted) ghostedCount += 1;
    if (app.status === 'applied') appliedCount += 1;

    // Aggregate by Resume
    const resumeKey = app.resume_id || 'unassigned';
    const resumeName = app.resume_name || 'Unassigned / Direct';
    if (!resumeMap.has(resumeKey)) {
      resumeMap.set(resumeKey, {
        resume_id: app.resume_id,
        name: resumeName,
        total: 0,
        responses: 0,
        rejections: 0,
        ghosted: 0,
      });
    }
    const rData = resumeMap.get(resumeKey);
    rData.total += 1;
    if (isResponse) rData.responses += 1;
    if (isRejected) rData.rejections += 1;
    if (isGhosted) rData.ghosted += 1;

    // Aggregate by Platform
    const platformKey = (app.platform || 'other').toLowerCase();
    if (!platformMap.has(platformKey)) {
      platformMap.set(platformKey, {
        platform: platformKey,
        total: 0,
        responses: 0,
        rejections: 0,
        ghosted: 0,
      });
    }
    const pData = platformMap.get(platformKey);
    pData.total += 1;
    if (isResponse) pData.responses += 1;
    if (isRejected) pData.rejections += 1;
    if (isGhosted) pData.ghosted += 1;
  }

  const overallResponseRate = totalApplications > 0
    ? Number(((responsesCount / totalApplications) * 100).toFixed(1))
    : 0;
  const overallRejectionRate = totalApplications > 0
    ? Number(((rejectionsCount / totalApplications) * 100).toFixed(1))
    : 0;
  const overallGhostedRate = totalApplications > 0
    ? Number(((ghostedCount / totalApplications) * 100).toFixed(1))
    : 0;

  // Process Resumes breakdown
  const resumesBreakdown = Array.from(resumeMap.values()).map(r => {
    const rate = r.total > 0 ? Number(((r.responses / r.total) * 100).toFixed(1)) : 0;
    return {
      resume_id: r.resume_id,
      name: r.name,
      total: r.total,
      responses: r.responses,
      rejections: r.rejections,
      ghosted: r.ghosted,
      response_rate: rate,
      low_sample_size: r.total < 3,
    };
  }).sort((a, b) => b.response_rate - a.response_rate || b.total - a.total);

  // Process Platforms breakdown
  const platformsBreakdown = Array.from(platformMap.values()).map(p => {
    const rate = p.total > 0 ? Number(((p.responses / p.total) * 100).toFixed(1)) : 0;
    return {
      platform: p.platform,
      total: p.total,
      responses: p.responses,
      rejections: p.rejections,
      ghosted: p.ghosted,
      response_rate: rate,
      low_sample_size: p.total < 3,
    };
  }).sort((a, b) => b.response_rate - a.response_rate || b.total - a.total);

  return {
    userId,
    period_start: startDateStr,
    period_end: endDateStr,
    summary: {
      total_applications: totalApplications,
      responses: responsesCount,
      rejections: rejectionsCount,
      ghosted: ghostedCount,
      pending: appliedCount,
      response_rate: overallResponseRate,
      rejection_rate: overallRejectionRate,
      ghosted_rate: overallGhostedRate,
    },
    resumes: resumesBreakdown,
    platforms: platformsBreakdown,
  };
}

export default {
  buildReportData,
};
