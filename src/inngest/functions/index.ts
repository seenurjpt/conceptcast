import { generatePost } from './generate-post';
import { publishScheduled } from './publish-scheduled';
import { fetchMetrics } from './fetch-metrics';
import { refreshToken } from './refresh-token';
import { scanTimelinessFn } from './scan-timeliness';
import { growBacklog } from './grow-backlog';

export const functions = [
  generatePost,
  publishScheduled,
  fetchMetrics,
  refreshToken,
  scanTimelinessFn,
  growBacklog,
];
