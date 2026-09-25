export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 5;
export const GIB = 1024 ** 3;

export type PlanKey = 'prueba' | 'inicial' | 'estudio' | 'equipo';
export type BillingState =
  | 'trialing'
  | 'pending'
  | 'active'
  | 'past_due'
  | 'grace_period'
  | 'paused'
  | 'canceling'
  | 'canceled'
  | 'expired';

export type PlanRights = {
  projects: number;
  storageBytes: number;
  professionals: number;
  clients: number | null;
  teamPermissions: boolean;
  advancedAdmin: boolean;
  prioritySupport: boolean;
};

export const PLANS: Record<PlanKey, {
  name: string;
  amountCents: number;
  currency: 'ARS';
  rights: PlanRights;
}> = {
  prueba: {
    name: 'Prueba', amountCents: 0, currency: 'ARS',
    rights: { projects: 1, storageBytes: GIB, professionals: 3, clients: 2,
      teamPermissions: false, advancedAdmin: false, prioritySupport: false },
  },
  inicial: {
    name: 'Inicial', amountCents: 2_990_000, currency: 'ARS',
    rights: { projects: 3, storageBytes: 5 * GIB, professionals: 3, clients: 5,
      teamPermissions: false, advancedAdmin: false, prioritySupport: false },
  },
  estudio: {
    name: 'Estudio', amountCents: 7_490_000, currency: 'ARS',
    rights: { projects: 15, storageBytes: 100 * GIB, professionals: 5, clients: null,
      teamPermissions: true, advancedAdmin: false, prioritySupport: false },
  },
  equipo: {
    name: 'Equipo', amountCents: 14_990_000, currency: 'ARS',
    rights: { projects: 50, storageBytes: 500 * GIB, professionals: 15, clients: null,
      teamPermissions: true, advancedAdmin: true, prioritySupport: true },
  },
};

export function effectiveBillingState(account: {
  state: string;
  trialEnds: number;
  graceEnds: number | null;
  paidThrough: number | null;
  cancelAt: number | null;
}, now = Date.now()): BillingState {
  if (account.state === 'trialing') return now < account.trialEnds ? 'trialing' : 'expired';
  if (account.state === 'past_due' || account.state === 'grace_period')
    return account.graceEnds && now < account.graceEnds ? 'grace_period' : 'expired';
  if (account.state === 'canceling')
    return account.paidThrough && now < account.paidThrough ? 'canceling' : 'canceled';
  if (account.state === 'active' && account.paidThrough && now >= account.paidThrough)
    return 'expired';
  return account.state as BillingState;
}

export function canWrite(state: BillingState) {
  return state === 'trialing' || state === 'active' ||
    state === 'grace_period' || state === 'canceling';
}

export function allowedWithinLimit(used: number, addition: number, limit: number | null) {
  return limit === null || used + addition <= limit;
}
