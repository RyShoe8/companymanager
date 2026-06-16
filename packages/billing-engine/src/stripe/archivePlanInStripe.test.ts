import { beforeEach, describe, expect, it, vi } from 'vitest';
import { archivePlanInStripe, type PlanStripeArchiveInput } from './archivePlanInStripe';

const pricesUpdate = vi.fn();
const productsUpdate = vi.fn();

vi.mock('./client', () => ({
  getStripe: () => ({
    prices: { update: pricesUpdate },
    products: { update: productsUpdate },
  }),
}));

const fullPlan: PlanStripeArchiveInput = {
  stripeProductId: 'prod_123',
  stripeBasePriceId: 'price_base',
  stripeSeatPriceId: 'price_seat',
  yearlyOffer: {
    enabled: true,
    basePriceCents: 9900,
    additionalUserPriceCents: 1200,
    stripeBasePriceId: 'price_year_base',
    stripeSeatPriceId: 'price_year_seat',
  },
};

describe('archivePlanInStripe', () => {
  beforeEach(() => {
    pricesUpdate.mockReset();
    productsUpdate.mockReset();
    pricesUpdate.mockResolvedValue({});
    productsUpdate.mockResolvedValue({});
  });

  it('archives all price IDs and the product', async () => {
    const result = await archivePlanInStripe(fullPlan);
    expect(result).toEqual({ ok: true });
    expect(pricesUpdate).toHaveBeenCalledTimes(4);
    expect(pricesUpdate).toHaveBeenCalledWith('price_base', { active: false });
    expect(pricesUpdate).toHaveBeenCalledWith('price_seat', { active: false });
    expect(pricesUpdate).toHaveBeenCalledWith('price_year_base', { active: false });
    expect(pricesUpdate).toHaveBeenCalledWith('price_year_seat', { active: false });
    expect(productsUpdate).toHaveBeenCalledWith('prod_123', { active: false });
  });

  it('skips empty price IDs', async () => {
    const result = await archivePlanInStripe({
      stripeProductId: 'prod_123',
      stripeBasePriceId: 'price_base',
      stripeSeatPriceId: '',
      yearlyOffer: {
        enabled: false,
        basePriceCents: 0,
        additionalUserPriceCents: 0,
        stripeBasePriceId: '',
        stripeSeatPriceId: '',
      },
    });
    expect(result).toEqual({ ok: true });
    expect(pricesUpdate).toHaveBeenCalledTimes(1);
    expect(pricesUpdate).toHaveBeenCalledWith('price_base', { active: false });
  });

  it('returns ok when no stripe product id', async () => {
    const result = await archivePlanInStripe({
      stripeProductId: '',
      stripeBasePriceId: 'price_base',
      stripeSeatPriceId: '',
      yearlyOffer: undefined,
    });
    expect(result).toEqual({ ok: true });
    expect(pricesUpdate).not.toHaveBeenCalled();
    expect(productsUpdate).not.toHaveBeenCalled();
  });

  it('ignores resource_missing on prices', async () => {
    pricesUpdate.mockRejectedValueOnce({ code: 'resource_missing', statusCode: 404 });
    const result = await archivePlanInStripe({
      stripeProductId: 'prod_123',
      stripeBasePriceId: 'price_missing',
      stripeSeatPriceId: '',
      yearlyOffer: undefined,
    });
    expect(result).toEqual({ ok: true });
    expect(productsUpdate).toHaveBeenCalledWith('prod_123', { active: false });
  });

  it('fails when a price archive errors', async () => {
    pricesUpdate.mockRejectedValueOnce(new Error('rate limit'));
    const result = await archivePlanInStripe({
      stripeProductId: 'prod_123',
      stripeBasePriceId: 'price_base',
      stripeSeatPriceId: '',
      yearlyOffer: undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Failed to archive Stripe prices');
      expect(result.error).toContain('price_base');
    }
    expect(productsUpdate).not.toHaveBeenCalled();
  });

  it('fails when product archive errors', async () => {
    productsUpdate.mockRejectedValueOnce(new Error('product locked'));
    const result = await archivePlanInStripe({
      stripeProductId: 'prod_123',
      stripeBasePriceId: '',
      stripeSeatPriceId: '',
      yearlyOffer: undefined,
    });
    expect(result).toEqual({
      ok: false,
      error: 'Failed to archive Stripe product: product locked',
    });
  });

  it('succeeds when product is already missing in Stripe', async () => {
    productsUpdate.mockRejectedValueOnce({ code: 'resource_missing', statusCode: 404 });
    const result = await archivePlanInStripe({
      stripeProductId: 'prod_gone',
      stripeBasePriceId: '',
      stripeSeatPriceId: '',
      yearlyOffer: undefined,
    });
    expect(result).toEqual({ ok: true });
  });
});
