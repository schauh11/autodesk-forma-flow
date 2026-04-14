import { APS_BASE_URL, normalizeProjectId } from './auth';
import logger from '@/lib/logger';

export async function publishModel(
  accessToken: string,
  projectId: string,
  itemId: string
): Promise<string> {
  const normalizedProjectId = normalizeProjectId(projectId);

  const response = await fetch(
    `${APS_BASE_URL}/data/v1/projects/${normalizedProjectId}/commands`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        jsonapi: { version: '1.0' },
        data: {
          type: 'commands',
          attributes: {
            extension: {
              type: 'commands:autodesk.bim360:C4RModelPublish',
              version: '1.0.0',
            },
          },
          relationships: {
            resources: {
              data: [{ type: 'items', id: itemId }],
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    logger.error({ projectId: normalizedProjectId, itemId, status: response.status }, 'Publish model failed');
    throw new Error(`Publish model failed: ${response.status} ${error}`);
  }

  const result = await response.json() as { data: { id: string } };
  logger.info({ projectId: normalizedProjectId, itemId, commandId: result.data.id }, 'Model publish command submitted');
  return result.data.id;
}
