/**
 * Staleness Configuration for Job Application Truth Tracker.
 *
 * STALE_THRESHOLD_DAYS:
 * Default is set to 21 days (3 weeks).
 *
 * Rationale:
 * Most modern tech hiring pipelines acknowledge applications within 1-2 weeks.
 * If an application has sat in the 'applied' state with zero status changes for 21+ days,
 * the empirical likelihood of a positive response drops dramatically, justifying
 * transitioning the status to 'ghosted' for funnel accuracy.
 */
export const STALE_THRESHOLD_DAYS = 21;

// Default background job run interval (1 hour for demo/runtime, easily tuned)
export const STALE_JOB_INTERVAL_MS = 60 * 60 * 1000;

export default {
  STALE_THRESHOLD_DAYS,
  STALE_JOB_INTERVAL_MS,
};
