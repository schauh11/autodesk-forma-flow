import { APS_BASE_URL } from './auth';
import logger from '@/lib/logger';

/**
 * Get metadata (list of viewable GUIDs) for a model derivative.
 * The URN is the base64-encoded version ID from ACC.
 */
export async function getModelMetadata(
  accessToken: string,
  urn: string
): Promise<{ guid: string; name: string; role: string }[]> {
  const response = await fetch(
    `${APS_BASE_URL}/modelderivative/v2/designdata/${urn}/metadata`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    logger.error(
      { urn, status: response.status },
      'Failed to get model metadata'
    );
    throw new Error(`Model metadata failed: ${response.status}`);
  }

  const data = (await response.json()) as { data?: { metadata?: { guid: string; name: string; role: string }[] } };
  return data.data?.metadata ?? [];
}

/**
 * Get the object tree (hierarchy) for a specific viewable.
 */
export async function getObjectTree(
  accessToken: string,
  urn: string,
  guid: string
): Promise<unknown> {
  const response = await fetch(
    `${APS_BASE_URL}/modelderivative/v2/designdata/${urn}/metadata/${guid}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    logger.error(
      { urn, guid, status: response.status },
      'Failed to get object tree'
    );
    throw new Error(`Object tree failed: ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

/**
 * Get all properties for objects in a viewable.
 * This is the main data source for element counts, families, links, etc.
 */
export async function getProperties(
  accessToken: string,
  urn: string,
  guid: string
): Promise<
  {
    objectid: number;
    name: string;
    properties: Record<string, Record<string, string | number>>;
  }[]
> {
  const response = await fetch(
    `${APS_BASE_URL}/modelderivative/v2/designdata/${urn}/metadata/${guid}/properties?forceget=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    logger.error(
      { urn, guid, status: response.status },
      'Failed to get properties'
    );
    throw new Error(`Properties failed: ${response.status}`);
  }

  type PropItem = { objectid: number; name: string; properties: Record<string, Record<string, string | number>> };
  const data = (await response.json()) as {
    data?: { collection?: PropItem[] };
  };
  return data.data?.collection ?? [];
}

interface VersionAttribute {
  storageSize?: number;
  lastModifiedUserName?: string;
  lastModifiedTime?: string;
  createTime?: string;
}

interface VersionItem {
  id?: string;
  attributes?: VersionAttribute;
}

interface VersionResponse {
  data?: VersionItem[];
}

/**
 * Get version details from Data Management API (file size, version number, who uploaded).
 */
export async function getVersionDetails(
  accessToken: string,
  projectId: string,
  itemId: string
): Promise<
  {
    versionNumber: number;
    fileSize: number;
    lastModifiedBy: string;
    lastModifiedAt: string;
    storageUrn: string;
  }[]
> {
  const normalizedProject = projectId.startsWith('b.')
    ? projectId
    : `b.${projectId}`;
  const response = await fetch(
    `${APS_BASE_URL}/data/v1/projects/${normalizedProject}/items/${itemId}/versions`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    logger.error(
      { projectId: normalizedProject, itemId, status: response.status },
      'Failed to get version details'
    );
    throw new Error(`Version details failed: ${response.status}`);
  }

  const data = (await response.json()) as VersionResponse;
  const versions = data.data ?? [];

  return versions.map((v: VersionItem, i: number) => ({
    versionNumber: versions.length - i,
    fileSize: v.attributes?.storageSize ?? 0,
    lastModifiedBy: v.attributes?.lastModifiedUserName ?? 'Unknown',
    lastModifiedAt:
      v.attributes?.lastModifiedTime ?? v.attributes?.createTime ?? '',
    storageUrn: v.id ?? '',
  }));
}

/**
 * Encode an item version ID to a URN for Model Derivative API.
 * ACC version IDs look like: urn:adsk.wipprod:fs.file:vf.XXXXX?version=N
 * Must be base64url encoded.
 */
export function encodeUrn(versionId: string): string {
  return Buffer.from(versionId).toString('base64url');
}

/**
 * Get linked files for a Revit Cloud Model using the RCM Linked Files API.
 * Available for models published after Feb 7, 2025.
 */
export async function getLinkedFiles(
  accessToken: string,
  projectId: string,
  versionId: string
): Promise<{ name: string; size: number; status: string }[]> {
  // Strip "b." prefix for this endpoint
  const cleanProjectId = projectId.startsWith('b.') ? projectId.slice(2) : projectId;
  const url = `https://developer.api.autodesk.com/construction/rcm/v1/projects/${cleanProjectId}/published-versions/${encodeURIComponent(versionId)}/linked-files`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      logger.warn({ status: response.status, projectId }, 'Linked Files API failed, model may not be RCM');
      return [];
    }

    const data = await response.json() as {
      linkedFiles?: { results?: { modelName?: string; size?: number; publishStatus?: string }[] };
    };

    return (data.linkedFiles?.results || []).map(f => ({
      name: f.modelName || 'Unknown',
      size: f.size || 0,
      status: f.publishStatus || 'Unknown',
    }));
  } catch {
    return [];
  }
}

const RETRY_INTERVAL_MS = 5000;
const MAX_RETRIES = 12; // 60 seconds total

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get properties with retry. Model Derivative sometimes returns empty
 * collection while derivatives are still processing. Retries every 5s
 * for up to 60 seconds.
 */
export async function getPropertiesWithRetry(
  accessToken: string,
  urn: string,
  guid: string
): Promise<ReturnType<typeof getProperties>> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await getProperties(accessToken, urn, guid);
    if (result.length > 0) return result;
    if (attempt < MAX_RETRIES) {
      logger.info({ urn, attempt: attempt + 1, maxRetries: MAX_RETRIES }, 'Properties empty, retrying...');
      await sleep(RETRY_INTERVAL_MS);
    }
  }
  logger.warn({ urn }, 'Properties still empty after max retries');
  return [];
}

/**
 * Get metadata with retry. Same polling pattern.
 */
export async function getModelMetadataWithRetry(
  accessToken: string,
  urn: string
): Promise<ReturnType<typeof getModelMetadata>> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await getModelMetadata(accessToken, urn);
    if (result.length > 0) return result;
    if (attempt < MAX_RETRIES) {
      logger.info({ urn, attempt: attempt + 1 }, 'Metadata empty, retrying...');
      await sleep(RETRY_INTERVAL_MS);
    }
  }
  logger.warn({ urn }, 'Metadata still empty after max retries');
  return [];
}
