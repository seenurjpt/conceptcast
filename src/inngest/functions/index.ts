import { generatePost } from './generate-post';
import { publishScheduled } from './publish-scheduled';
import { fetchMetrics } from './fetch-metrics';
import { refreshToken } from './refresh-token';
import { scanTimelinessFn } from './scan-timeliness';
import { growBacklog } from './grow-backlog';
import { generatePostPipeline } from './generate-post-pipeline';
import { voiceExtract } from './voice-extract';
import { scanNews } from './scan-news';

export const functions = [
  generatePost,
  publishScheduled,
  fetchMetrics,
  refreshToken,
  scanTimelinessFn,
  growBacklog,
  generatePostPipeline,
  voiceExtract,
  scanNews,
];
