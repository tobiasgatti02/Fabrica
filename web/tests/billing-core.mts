import assert from 'node:assert/strict';
import { canWrite, effectiveBillingState, planMatchesPrice } from '../features/billing/core';

const now = Date.UTC(2026, 8, 25);
const account = { state: 'active', trialEnds: 0, paidThrough: now - 1, graceEnds: now + 1000, cancelAt: null };
assert.equal(effectiveBillingState(account, now), 'grace_period');
assert.equal(canWrite(effectiveBillingState(account, now)), true);
assert.equal(effectiveBillingState(account, now + 1000), 'expired');
assert.equal(canWrite(effectiveBillingState(account, now + 1000)), false);
assert.equal(effectiveBillingState({ ...account, state: 'canceling' }, now), 'canceled');

const provider = { status: 'active', auto_recurring: {
  frequency: 1, frequency_type: 'months', transaction_amount: 29900, currency_id: 'ARS',
} };
assert.equal(planMatchesPrice(provider, 2_990_000, 'ARS'), true);
assert.equal(planMatchesPrice(provider, 7_490_000, 'ARS'), false);
assert.equal(planMatchesPrice({ ...provider, status: 'paused' }, 2_990_000, 'ARS'), false);
assert.equal(planMatchesPrice({ ...provider, auto_recurring: { ...provider.auto_recurring, frequency_type: 'weeks' } }, 2_990_000, 'ARS'), false);

console.log('Billing core checks passed.');
