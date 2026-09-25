import { neon } from '@neondatabase/serverless';

export async function getDashboard(databaseUrl: string) {
  const sql = neon(databaseUrl);
  const now = Date.now();
  const since = now - 30 * 86_400_000;
  const inSevenDays = now + 7 * 86_400_000;
  const [summary, accounts, signups, activity, billing, funnel] = await Promise.all([
    sql`select
      (select count(*)::int from studio_users) as users,
      (select count(*)::int from studio_users where created >= ${since}) as new_users,
      (select count(*)::int from billing_accounts where state = 'active') as active_paid,
      (select count(*)::int from billing_accounts where state = 'trialing' and trial_ends > ${now}) as trials,
      (select count(*)::int from billing_accounts where state = 'trialing' and trial_ends <= ${now}) as expired_trials,
      (select count(*)::int from studio_projects where archived is null) as projects,
      (select count(*)::int from studio_versions where published = 1) as published_versions,
      (select count(*)::int from studio_comments) as comments,
      (select coalesce(sum(amount_cents),0)::bigint from billing_charges where provider_status = 'approved') as collected_cents`,
    sql`select u.name, u.email, u.created as user_created, a.state, a.plan, a.trial_ends, a.grace_ends, a.paid_through, a.cancel_at,
      (select count(*)::int from studio_projects p where p.owner = s.owner and p.archived is null) as projects,
      (select max(p.created) from studio_projects p where p.owner = s.owner) as last_project_at,
      (select bs.provider_status from billing_subscriptions bs where bs.account=a.id order by bs.updated desc limit 1) as subscription_status
      from billing_accounts a join billing_studios s on s.id=a.studio
      left join studio_users u on s.owner = 'fabrica:' || u.id
      order by a.created desc limit 100`,
    sql`select to_char(to_timestamp(created / 1000.0), 'YYYY-MM-DD') as day, count(*)::int as count
      from studio_users where created >= ${since} group by 1 order by 1`,
    sql`select kind, label, happened_at from (
      select 'signup' as kind, coalesce(name,email) as label, created as happened_at from studio_users
      union all select 'project', name, created from studio_projects
      union all select 'payment', provider_status || ' · ' || round(amount_cents / 100.0, 2)::text || ' ' || currency, occurred_at from billing_charges
      union all select 'billing', action || ' · ' || coalesce(to_state,''), created from billing_changes
    ) events order by happened_at desc limit 20`,
    sql`select
      (select count(*)::int from billing_accounts where state in ('past_due','grace','suspended')) as payment_risk,
      (select count(*)::int from billing_accounts where state='trialing' and trial_ends between ${now} and ${inSevenDays}) as expiring_soon,
      (select count(*)::int from billing_webhook_events where processed_at is null and received_at < ${now - 300_000}) as stuck_webhooks,
      (select count(*)::int from billing_webhook_events where outcome is not null and outcome not in ('processed','ignored','duplicate') and received_at >= ${since}) as webhook_errors,
      (select count(*)::int from billing_charges where provider_status not in ('approved','authorized') and occurred_at >= ${since}) as failed_charges,
      (select count(*)::int from studio_projects where archived is null and created < ${now - 7 * 86_400_000} and id not in (select project from studio_versions)) as unactivated_projects`,
    sql`select
      (select count(distinct u.id)::int from studio_users u join studio_projects p on p.owner='fabrica:' || u.id) as created_project,
      (select count(distinct u.id)::int from studio_users u join studio_projects p on p.owner='fabrica:' || u.id join studio_versions v on v.project=p.id) as uploaded_version,
      (select count(distinct u.id)::int from studio_users u join studio_projects p on p.owner='fabrica:' || u.id join studio_versions v on v.project=p.id where v.published=1) as published,
      (select count(distinct u.id)::int from studio_users u join billing_studios s on s.owner='fabrica:' || u.id join billing_accounts a on a.studio=s.id where a.state='active') as paid`,
  ]);
  return { generatedAt: now, summary: summary[0], accounts, signups, activity, billing: billing[0], funnel: funnel[0] };
}
