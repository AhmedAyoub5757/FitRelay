import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(url, anonKey)

const testEmail = `test-${Date.now()}@example.com`
const testPassword = 'Test1234!'

async function main() {
  console.log('Signing up test owner...')
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  })
  if (signUpError) throw signUpError
  console.log('Session active:', !!signUpData.session)

  console.log('Creating gym + owner...')
  const { data: gym, error: gymError } = await supabase.rpc('create_gym_and_owner', {
    gym_name: 'Test Gym',
    gym_timezone: 'Asia/Karachi',
    owner_full_name: 'Test Owner',
  })
  if (gymError) throw gymError
  console.log('Gym created:', gym)

  console.log('Creating a membership plan...')
  const { data: plan, error: planError } = await supabase
    .from('membership_plans')
    .insert({ gym_id: gym.id, name: 'Monthly', duration_days: 30, default_price: 3000 })
    .select()
    .single()
  if (planError) throw planError

  const today = new Date().toISOString().slice(0, 10)

  console.log('Registering a member with membership + initial payment...')
  const { data: member, error: regError } = await supabase.rpc('register_member_with_membership', {
    p_full_name: 'Ali Khan',
    p_phone: '0300-1234567',
    p_phone_normalized: '+923001234567',
    p_emergency_contact_name: null,
    p_emergency_contact_phone: null,
    p_joining_date: today,
    p_plan_id: plan.id,
    p_plan_name_snapshot: plan.name,
    p_duration_days: plan.duration_days,
    p_start_date: today,
    p_gross_amount: 3000,
    p_discount_amount: 0,
    p_initial_payment_amount: 2000,
    p_initial_payment_method: 'cash',
  })
  if (regError) throw regError
  console.log('Member registered:', member)

  const { data: status } = await supabase.from('member_status').select('*').eq('member_id', member.id).single()
  console.log('Member status:', status)

  const { data: memberships } = await supabase.from('memberships').select('*').eq('member_id', member.id)
  console.log('Memberships:', memberships)
  const membershipId = memberships[0].id

  console.log('Paying off the remaining balance (1000)...')
  const { error: payError } = await supabase.rpc('create_payment', {
    p_member_id: member.id,
    p_amount: 1000,
    p_payment_method: 'cash',
    p_allocations: null,
  })
  if (payError) throw payError

  console.log('Freezing the membership...')
  const { data: freeze, error: freezeError } = await supabase.rpc('create_freeze', {
    p_membership_id: membershipId,
    p_start_date: today,
  })
  if (freezeError) throw freezeError
  console.log('Freeze created:', freeze)

  console.log('Attempting to renew while frozen (expect an error)...')
  const { error: renewWhileFrozenError } = await supabase.rpc('renew_membership', {
    p_membership_id: membershipId,
    p_plan_id: plan.id,
    p_plan_name_snapshot: plan.name,
    p_duration_days: plan.duration_days,
    p_gross_amount: 3000,
    p_discount_amount: 0,
  })
  console.log('Got expected error:', renewWhileFrozenError?.message)

  console.log('Unfreezing...')
  const { error: unfreezeError } = await supabase.rpc('unfreeze', {
    p_freeze_id: freeze.id,
    p_end_date: today,
  })
  if (unfreezeError) throw unfreezeError

  console.log('Renewing...')
  const { data: renewed, error: renewError } = await supabase.rpc('renew_membership', {
    p_membership_id: membershipId,
    p_plan_id: plan.id,
    p_plan_name_snapshot: plan.name,
    p_duration_days: plan.duration_days,
    p_gross_amount: 3000,
    p_discount_amount: 0,
  })
  if (renewError) throw renewError
  console.log('Renewed membership:', renewed)

  if (serviceKey) {
    console.log('Running reminder generation as service role...')
    const adminClient = createClient(url, serviceKey)
    const { error: jobError } = await adminClient.rpc('run_reminder_generation')
    if (jobError) throw jobError

    const { data: jobRuns } = await adminClient
      .from('job_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(5)
    console.log('Recent job runs:', jobRuns)

    const { data: reminders } = await adminClient.from('reminders').select('*')
    console.log('Reminders:', reminders)
  } else {
    console.log('SUPABASE_SERVICE_ROLE_KEY not set — skipping reminder job test.')
  }

  console.log('All checks completed.')
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})