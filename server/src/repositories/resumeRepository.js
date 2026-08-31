import { query } from '../db.js';

export async function createResume(userId, { name, content }) {
  const result = await query(
    `INSERT INTO resumes (user_id, name, content)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, name, content, created_at`,
    [userId, name, content]
  );
  return result.rows[0];
}

export async function getResumesByUserId(userId) {
  const result = await query(
    `SELECT id, user_id, name, content, created_at
     FROM resumes
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function getResumeById(id, userId) {
  const result = await query(
    `SELECT id, user_id, name, content, created_at
     FROM resumes
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rows[0] || null;
}

export async function updateResume(id, userId, { name, content }) {
  const fields = [];
  const values = [];
  let index = 1;

  if (name !== undefined) {
    fields.push(`name = $${index++}`);
    values.push(name);
  }
  if (content !== undefined) {
    fields.push(`content = $${index++}`);
    values.push(content);
  }

  if (fields.length === 0) {
    return getResumeById(id, userId);
  }

  values.push(id);
  const idIndex = index++;
  values.push(userId);
  const userIndex = index++;

  const result = await query(
    `UPDATE resumes
     SET ${fields.join(', ')}
     WHERE id = $${idIndex} AND user_id = $${userIndex}
     RETURNING id, user_id, name, content, created_at`,
    values
  );

  return result.rows[0] || null;
}

export async function deleteResume(id, userId) {
  const result = await query(
    `DELETE FROM resumes
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
}

export default {
  createResume,
  getResumesByUserId,
  getResumeById,
  updateResume,
  deleteResume,
};
