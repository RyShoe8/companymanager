import 'server-only';
import { Types } from 'mongoose';
import type { AiAccess } from '@/lib/ai/control/planningQueue';
import { AiHttpError } from '@/lib/ai/control/access';
import {
  evaluatePublishPreconditions,
  githubAppConfigured,
  publishBlockMessages,
} from '@/lib/ai/githubPublish';
import { AiProjectRepository } from '@/lib/models/AiProjectRepository';
import {
  AiArtifact,
  AiArtifactAcceptance,
  AiArtifactReview,
} from '@/lib/models/AiArtifactReview';

export type PublishResult = {
  status: 'opened' | 'blocked';
  reason?: string;
  pullRequestUrl?: string | null;
  repository?: { owner: string; repo: string; defaultBranch: string } | null;
};

/** Fail-closed publish: never invents a PR URL. Live Octokit open comes later. */
export async function publishAcceptedReview(
  access: AiAccess,
  reviewId: string
): Promise<PublishResult> {
  if (!Types.ObjectId.isValid(reviewId)) throw new AiHttpError(404, 'Review not found.');
  const scope = { organizationId: access.organizationId, projectId: access.project._id };
  const review = await AiArtifactReview.findOne({ ...scope, _id: reviewId })
    .select('artifactId')
    .maxTimeMS(3000)
    .lean();
  if (!review) throw new AiHttpError(404, 'Review not found.');

  const acceptance = await AiArtifactAcceptance.findOne({
    ...scope,
    reviewId: review._id,
  })
    .select('_id')
    .maxTimeMS(3000)
    .lean();
  const artifact = await AiArtifact.findOne({ ...scope, _id: review.artifactId })
    .select('executionVerified')
    .maxTimeMS(3000)
    .lean();
  const repository = await AiProjectRepository.findOne(scope)
    .select('owner repo defaultBranch installationId')
    .maxTimeMS(3000)
    .lean();

  const gate = evaluatePublishPreconditions({
    accepted: Boolean(acceptance),
    executionVerified: Boolean(artifact?.executionVerified),
    hasRepository: Boolean(repository),
    githubConfigured: githubAppConfigured(),
    installationConnected: Boolean(repository?.installationId),
  });

  if (!gate.ok) {
    return {
      status: 'blocked',
      reason: publishBlockMessages[gate.reason],
      pullRequestUrl: null,
      repository: repository
        ? { owner: repository.owner, repo: repository.repo, defaultBranch: repository.defaultBranch }
        : null,
    };
  }

  // Credentials + verified artifact present, but Octokit PR creation is not wired this stretch.
  return {
    status: 'blocked',
    reason: publishBlockMessages.publish_unavailable,
    pullRequestUrl: null,
    repository: repository
      ? { owner: repository.owner, repo: repository.repo, defaultBranch: repository.defaultBranch }
      : null,
  };
}
