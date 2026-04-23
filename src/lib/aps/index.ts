// APS (Autodesk Platform Services) module
// Re-exports auth, publish, model derivative, and insights functions

export {
  APS_BASE_URL,
  normalizeProjectId,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
} from './auth';
export type { TokenResponse } from './auth';

export { publishModel } from './publish';

export {
  getModelMetadata,
  getObjectTree,
  getProperties,
  getVersionDetails,
  encodeUrn,
} from './model-derivative';

export { extractInsights } from './insights-extractor';
export type { ModelInsightsData } from './insights-extractor';
