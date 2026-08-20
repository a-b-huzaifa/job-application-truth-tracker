import { query } from '../db.js';

export async function getUserById(id) {
  const result = await query(
    `SELECT id, email, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getUserByEmail(email) {
  const result = await query(
    `SELECT id, email, password_hash, created_at
     FROM users
     WHERE email = $1`,
    [email]
  );
  return result.rows[0] || null;
}

export async function createUser(email, passwordHash) {
  const result = await query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, created_at`,
    [email, passwordHash]
  );
  return result.rows[0];
}

export default {
  getUserById,
  getUserByEmail,
  createUser,
};
