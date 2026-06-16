import {
  getPublicPricingPlans,
  maxTrialDaysFromPlans,
  trialAfterEndFaqAnswer,
  trialCtaButtonLabel,
  trialFeatureCtaSubtext,
  trialHeroBadge,
  trialPricingFaqAnswer,
} from 'billing-engine';

export async function getMarketingTrialCopy() {
  const plans = await getPublicPricingPlans();
  const maxTrialDays = maxTrialDaysFromPlans(plans);
  return {
    maxTrialDays,
    heroBadge: trialHeroBadge(maxTrialDays),
    ctaButtonLabel: trialCtaButtonLabel(maxTrialDays),
    featureCtaSubtext: trialFeatureCtaSubtext(maxTrialDays),
    pricingFaqTrialAnswer: trialPricingFaqAnswer(maxTrialDays),
    pricingFaqAfterTrialAnswer: trialAfterEndFaqAnswer(maxTrialDays),
    metadataTrialSuffix: maxTrialDays > 0 ? ` Start your ${maxTrialDays}-day free trial.` : '',
  };
}
