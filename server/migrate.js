import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('--- Running Database Migrations ---');
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(file => file.endsWith('.sql')).sort();

    if (sqlFiles.length === 0) {
      console.log('No SQL migration files found.');
      return;
    }

    for (const sqlFile of sqlFiles) {
      console.log(`Executing migration: ${sqlFile}`);
      const filePath = path.join(migrationsDir, sqlFile);
      const sql = await fs.readFile(filePath, 'utf8');
      await pool.query(sql);
      console.log(`Successfully executed: ${sqlFile}`);
    }

    // Verify created tables
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('Database tables present:');
    res.rows.forEach(r => console.log(` - ${r.table_name}`));
    console.log('--- Migrations Completed Successfully ---');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigrations();
