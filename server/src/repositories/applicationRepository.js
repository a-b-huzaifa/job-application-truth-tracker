import { query } from '../db.js';

export async function createApplication(userId, {
  resume_id = null,
  company_name,
  role_title,
  job_description,
  job_url = null,
  platform,
  applied_at,
  status = 'applied',
  last_status_check = new Date().toISOString(),
}) {
  const result = await query(
    `INSERT INTO applications (
      user_id, resume_id, company_name, role_title, job_description,
      job_url, platform, applied_at, status, last_status_check
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id, user_id, resume_id, company_name, role_title, job_description,
              job_url, platform, applied_at, status, last_status_check, created_at`,
    [
      userId,
      resume_id,
      company_name,
      role_title,
      job_description,
      job_url,
      platform,
      applied_at,
      status,
      last_status_check,
    ]
  );
  return result.rows[0];
}

export async function getApplicationsByUserId(userId, {
  status,
  platform,
  resumeId,
  limit = 50,
  offset = 0,
} = {}) {
  const conditions = ['a.user_id = $1'];
  const values = [userId];
  let index = 2;

  if (status) {
    conditions.push(`a.status = $${index++}`);
    values.push(status);
  }

  if (platform) {
    conditions.push(`a.platform = $${index++}`);
    values.push(platform);
  }

  if (resumeId) {
    conditions.push(`a.resume_id = $${index++}`);
    values.push(resumeId);
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

  values.push(parsedLimit);
  const limitIndex = index++;
  values.push(parsedOffset);
  const offsetIndex = index++;

  const sql = `
    SELECT 
      a.id, a.user_id, a.resume_id, a.company_name, a.role_title, 
      a.job_description, a.job_url, a.platform, a.applied_at, a.status, 
      a.last_status_check, a.created_at,
      r.name as resume_name
    FROM applications a
    LEFT JOIN resumes r ON a.resume_id = r.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.applied_at DESC, a.created_at DESC
    LIMIT $${limitIndex} OFFSET $${offsetIndex}
  `;

  const countSql = `
    SELECT count(*)::int as total
    FROM applications a
    WHERE ${conditions.join(' AND ')}
  `;

  const [res, countRes] = await Promise.all([
    query(sql, values),
    query(countSql, values.slice(0, index - 3)),
  ]);

  return {
    applications: res.rows,
    total: countRes.rows[0]?.total || 0,
    limit: parsedLimit,
    offset: parsedOffset,
  };
}

export async function getApplicationById(id, userId) {
  const result = await query(
    `SELECT 
      a.id, a.user_id, a.resume_id, a.company_name, a.role_title, 
      a.job_description, a.job_url, a.platform, a.applied_at, a.status, 
      a.last_status_check, a.created_at,
      r.name as resume_name
    FROM applications a
    LEFT JOIN resumes r ON a.resume_id = r.id
    WHERE a.id = $1 AND a.user_id = $2`,
    [id, userId]
  );
  return result.rows[0] || null;
}

export async function updateApplication(id, userId, updates = {}) {
  const allowedFields = [
    'resume_id',
    'company_name',
    'role_title',
    'job_description',
    'job_url',
    'platform',
    'applied_at',
    'status',
    'last_status_check',
  ];

  const fields = [];
  const values = [];
  let index = 1;

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = $${index++}`);
      values.push(updates[field]);
    }
  }

  if (fields.length === 0) {
    return getApplicationById(id, userId);
  }

  values.push(id);
  const idIndex = index++;
  values.push(userId);
  const userIndex = index++;

  const result = await query(
    `UPDATE applications
     SET ${fields.join(', ')}
     WHERE id = $${idIndex} AND user_id = $${userIndex}
     RETURNING id, user_id, resume_id, company_name, role_title, job_description,
               job_url, platform, applied_at, status, last_status_check, created_at`,
    values
  );

  return result.rows[0] || null;
}

export async function deleteApplication(id, userId) {
  const result = await query(
    `DELETE FROM applications
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
}

export default {
  createApplication,
  getApplicationsByUserId,
  getApplicationById,
  updateApplication,
  deleteApplication,
};
