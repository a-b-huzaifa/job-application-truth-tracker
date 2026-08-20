import { checkForStaleApplications } from '../services/staleCheckService.js';
import { STALE_JOB_INTERVAL_MS } from '../config/staleness.js';

let jobTimer = null;

/**
 * Starts the periodic background worker to audit and flag stale job applications.
 * In production, this can be triggered via node-cron or system cron, but setInterval
 * provides built-in, runtime-independent execution for development and demonstrations.
 *
 * @param {number} [intervalMs=STALE_JOB_INTERVAL_MS] - Interval in milliseconds between runs
 */
export function startStaleCheckJob(intervalMs = STALE_JOB_INTERVAL_MS) {
  if (jobTimer) {
    console.log('[StaleCheckJob] Worker is already running.');
    return;
  }

  console.log(`[StaleCheckJob] Starting background worker (Interval: ${intervalMs}ms)...`);

  // Run initial scan on startup asynchronously
  checkForStaleApplications()
    .then(summary => {
      console.log(`[StaleCheckJob Initial Scan] Checked: ${summary.checked}, Flagged as Ghosted: ${summary.flagged_as_ghosted}`);
    })
    .catch(err => {
      // Ignore errors caused by pool shutdown during fast process exit/teardown
      if (!err.message?.includes('pool after calling end') && !err.message?.includes('closed')) {
        console.error('[StaleCheckJob Initial Scan Error]', err);
      }
    });

  jobTimer = setInterval(async () => {
    try {
      const summary = await checkForStaleApplications();
      if (summary.flagged_as_ghosted > 0) {
        console.log(`[StaleCheckJob Periodic Scan] Flagged ${summary.flagged_as_ghosted} newly ghosted applications.`);
      }
    } catch (error) {
      console.error('[StaleCheckJob Error during periodic run]:', error);
    }
  }, intervalMs);

  // Unref timer so it does not prevent node process from exiting cleanly if needed
  if (jobTimer && typeof jobTimer.unref === 'function') {
    jobTimer.unref();
  }
}

/**
 * Stops the scheduled background worker.
 */
export function stopStaleCheckJob() {
  if (jobTimer) {
    clearInterval(jobTimer);
    jobTimer = null;
    console.log('[StaleCheckJob] Background worker stopped.');
  }
}

export default {
  startStaleCheckJob,
  stopStaleCheckJob,
};
