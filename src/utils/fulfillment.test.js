import { describe, it, expect } from 'vitest';
import {
  normalizeFulfillmentStatus,
  getFulfillmentSteps,
  getFulfillmentProgress,
  bulkFulfillmentTargets,
  chunkIds,
  isMissingFulfillmentColumn
} from './fulfillment';

const keys = (p) => p.steps.map((s) => s.key);
const reached = (p) => p.steps.map((s) => s.reached);

describe('fulfillment', () => {
  it('treats missing or unknown status as pending', () => {
    expect(normalizeFulfillmentStatus(undefined)).toBe('pending');
    expect(normalizeFulfillmentStatus('bogus')).toBe('pending');
    expect(normalizeFulfillmentStatus('shipped')).toBe('shipped');
  });

  it('uses ready for pickup and shipped for shipping orders', () => {
    expect(getFulfillmentSteps({ delivery_method: 'pickup' })).toEqual(['paid', 'in_production', 'ready', 'completed']);
    expect(getFulfillmentSteps({ delivery_method: 'shipping' })).toEqual(['paid', 'in_production', 'shipped', 'completed']);
    expect(getFulfillmentSteps({})).toEqual(['paid', 'in_production', 'ready', 'completed']);
  });

  it('pending payment reaches no step, even if fulfillment was set', () => {
    const p = getFulfillmentProgress({ payment_status: 'pending', fulfillment_status: 'in_production' });
    expect(p.state).toBe('awaiting_payment');
    expect(p.currentIndex).toBe(-1);
    expect(reached(p)).toEqual([false, false, false, false]);
  });

  it('rejected payment is its own state', () => {
    const p = getFulfillmentProgress({ payment_status: 'rejected', fulfillment_status: 'completed' });
    expect(p.state).toBe('rejected');
    expect(p.currentIndex).toBe(-1);
  });

  it('confirmed order without the column (pre-migration) is at paid', () => {
    const p = getFulfillmentProgress({ payment_status: 'confirmed' });
    expect(p.state).toBe('active');
    expect(p.currentIndex).toBe(0);
    expect(p.steps[0]).toEqual({ key: 'paid', reached: true, current: true });
  });

  it('maps statuses to the current step', () => {
    const at = (fulfillment_status, delivery_method = 'pickup') =>
      getFulfillmentProgress({ payment_status: 'confirmed', fulfillment_status, delivery_method }).currentIndex;
    expect(at('pending')).toBe(0);
    expect(at('in_production')).toBe(1);
    expect(at('ready')).toBe(2);
    expect(at('shipped', 'shipping')).toBe(2);
    // a mismatched delivery step still counts as the delivery step
    expect(at('shipped', 'pickup')).toBe(2);
    expect(at('completed')).toBe(3);
    const done = getFulfillmentProgress({ payment_status: 'confirmed', fulfillment_status: 'completed', delivery_method: 'shipping' });
    expect(keys(done)).toEqual(['paid', 'in_production', 'shipped', 'completed']);
    expect(reached(done)).toEqual([true, true, true, true]);
    expect(done.steps.filter((s) => s.current).map((s) => s.key)).toEqual(['completed']);
  });

  it('bulk targets confirmed orders only', () => {
    const orders = [
      { id: 'a', payment_status: 'confirmed' },
      { id: 'b', payment_status: 'pending' },
      { id: 'c', payment_status: 'rejected' },
      { id: 'd', payment_status: 'confirmed' },
      null
    ];
    expect(bulkFulfillmentTargets(orders)).toEqual(['a', 'd']);
    expect(bulkFulfillmentTargets(null)).toEqual([]);
  });

  it('chunks ids', () => {
    const ids = Array.from({ length: 450 }, (_, i) => String(i));
    const chunks = chunkIds(ids, 200);
    expect(chunks.map((c) => c.length)).toEqual([200, 200, 50]);
    expect(chunks.flat()).toEqual(ids);
    expect(chunkIds([])).toEqual([]);
  });

  it('detects a missing 0014 column error', () => {
    expect(isMissingFulfillmentColumn({ message: "Could not find the 'fulfillment_status' column of 'orders' in the schema cache" })).toBe(true);
    expect(isMissingFulfillmentColumn({ message: 'column products.production_note does not exist' })).toBe(true);
    expect(isMissingFulfillmentColumn({ message: 'permission denied' })).toBe(false);
    expect(isMissingFulfillmentColumn(null)).toBe(false);
  });
});
