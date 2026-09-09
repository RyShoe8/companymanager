import { artifactAcceptanceSchema, artifactBindingSchema, artifactReviewSchema } from '../../ai-contracts/src/review';

/** Pure validation, not authentication. Callers must load records and identity grants server-side
 * and consume acceptance atomically with the result mutation; never pass model assertions here. */
export function assertArtifactAcceptance(input: {
  currentBinding: unknown; review: unknown; acceptance: unknown;
  authorizedHumanUserId: string; authorizedReviewerIdentityId: string; workerIdentityId: string;
}, now = new Date()) {
  const current = artifactBindingSchema.parse(input.currentBinding);
  const review = artifactReviewSchema.parse(input.review);
  const acceptance = artifactAcceptanceSchema.parse(input.acceptance);
  const sameBinding = (binding: typeof current) => (Object.keys(current) as Array<keyof typeof current>)
    .every(key => binding[key] === current[key]);
  const reviewTime = new Date(review.reviewedAt), acceptanceTime = new Date(acceptance.acceptedAt);
  if (!Number.isFinite(now.getTime()) || reviewTime > now || acceptanceTime > now || acceptanceTime < reviewTime ||
    new Date(review.expiresAt) <= now || review.verdict !== 'passed' || acceptance.consumed ||
    acceptance.reviewId !== review.reviewId || !sameBinding(review.binding) || !sameBinding(acceptance.binding) ||
    acceptance.acceptedByUserId !== input.authorizedHumanUserId ||
    review.reviewerIdentityId !== input.authorizedReviewerIdentityId || review.workerIdentityId !== input.workerIdentityId) {
    throw new Error('Acceptance requires current, independent review and an authorized human decision for the exact artifact.');
  }
  return { reviewId: review.reviewId, acceptedByUserId: acceptance.acceptedByUserId, binding: current };
}
