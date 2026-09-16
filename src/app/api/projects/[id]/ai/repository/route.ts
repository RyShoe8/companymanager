import { NextRequest } from 'next/server';
import { requireAiProject, AiHttpError } from '@/lib/ai/control/access';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import {
  connectionStatus,
  githubAppConfigured,
  projectRepositorySchema,
} from '@/lib/ai/githubPublish';
import { verifyInstallationRepositoryAccess } from '@/lib/ai/githubAppClient';
import { AiProjectRepository } from '@/lib/models/AiProjectRepository';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

let indexes: Promise<unknown> | undefined;

export async function GET(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, false, true);
    const row = await AiProjectRepository.findOne({
      organizationId: access.organizationId,
      projectId: access.project._id,
    })
      .select('host owner repo defaultBranch publishMode installationId updatedAt')
      .maxTimeMS(3000)
      .lean();

    if (!row) {
      return aiResponse({
        repository: null,
        connectionStatus: connectionStatus({ hasBinding: false }),
        githubAppConfigured: githubAppConfigured(),
        canManage: access.canManage,
      });
    }

    return aiResponse({
      repository: {
        host: row.host,
        owner: row.owner,
        repo: row.repo,
        defaultBranch: row.defaultBranch,
        publishMode: row.publishMode,
        installationId: row.installationId ?? null,
        updatedAt: row.updatedAt?.toISOString?.() ?? null,
      },
      connectionStatus: connectionStatus({
        hasBinding: true,
        installationId: row.installationId,
      }),
      githubAppConfigured: githubAppConfigured(),
      canManage: access.canManage,
    });
  } catch (error) {
    return aiError(error);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, true, true);
    const input = projectRepositorySchema.parse(await readAiBody(request));
    indexes ??= AiProjectRepository.createIndexes().catch((error) => {
      indexes = undefined;
      throw error;
    });
    await indexes;

    if (input.installationId) {
      const foreignBinding = await AiProjectRepository.findOne({
        installationId: input.installationId,
        organizationId: { $ne: access.organizationId },
      }).lean();
      if (foreignBinding) {
        throw new AiHttpError(403, 'This GitHub App installation is already associated with another organization.');
      }

      if (githubAppConfigured()) {
        const verify = await verifyInstallationRepositoryAccess(
          input.installationId,
          input.owner,
          input.repo
        );
        if (!verify.ok) {
          throw new AiHttpError(400, verify.reason ?? 'GitHub App installation does not have access to this repository.');
        }
      }
    }

    const row = await AiProjectRepository.findOneAndUpdate(
      { organizationId: access.organizationId, projectId: access.project._id },
      {
        $set: {
          host: input.host,
          owner: input.owner,
          repo: input.repo,
          defaultBranch: input.defaultBranch,
          publishMode: input.publishMode,
          installationId: input.installationId ?? null,
          updatedByUserId: access.userId,
        },
        $setOnInsert: {
          organizationId: access.organizationId,
          projectId: access.project._id,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    if (!row) throw new AiHttpError(503, 'Unable to save repository binding.');

    return aiResponse({
      repository: {
        host: row.host,
        owner: row.owner,
        repo: row.repo,
        defaultBranch: row.defaultBranch,
        publishMode: row.publishMode,
        installationId: row.installationId ?? null,
      },
      connectionStatus: connectionStatus({
        hasBinding: true,
        installationId: row.installationId,
      }),
      githubAppConfigured: githubAppConfigured(),
    });
  } catch (error) {
    return aiError(error);
  }
}
