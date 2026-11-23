import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const seedEmail = process.env.SEED_EMAIL
const seedPassword = process.env.SEED_PASSWORD

if (!supabaseUrl || !supabaseAnonKey || !seedEmail || !seedPassword) {
  console.error('Missing env vars. Need VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SEED_EMAIL, SEED_PASSWORD.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const firstNames = ['Ali', 'Hassan', 'Usman', 'Bilal', 'Zain', 'Ahmed', 'Omar', 'Hamza', 'Saad', 'Faisal', 'Ayesha', 'Sana', 'Hira', 'Mehwish', 'Komal', 'Sidra', 'Nida', 'Rabia', 'Fatima', 'Mariam']
const lastNames = ['Khan', 'Ahmed', 'Raza', 'Malik', 'Butt', 'Sheikh', 'Chaudhry', 'Qureshi', 'Abbasi', 'Iqbal']

function randomName() {
  const f = firstNames[Math.floor(Math.random() * firstNames.length)]
  const l = lastNames[Math.floor(Math.random() * lastNames.length)]
  return `${f} ${l}`
}

function randomPhone() {
  const rest = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('')
  const number = `3${rest}`
  return { display: `0${number.slice(0, 3)}-${number.slice(3)}`, normalized: `+92${number}` }
}

function daysFromToday(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

async function main() {
  const { error: authError } = await supabase.auth.signInWithPassword({ email: seedEmail, password: seedPassword })
  if (authError) throw authError

  const { data: plans, error: plansError } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('is_active', true)
    .not('duration_days', 'is', null)
    .gt('duration_days', 0)
    .order('duration_days', { ascending: true })
    .limit(1)
  if (plansError) throw plansError
  if (!plans || plans.length === 0) {
    console.error('No active membership_plans with duration_days > 0 found. Create one via SQL before seeding.')
    process.exit(1)
  }

  const plan = plans[0]
  const durationDays = Number(plan.duration_days) || 30
  const price = Number(plan.default_price ?? plan.price)
  console.log(`Using plan: ${plan.name} (${durationDays} days, ${price})`)

  async function registerMember({
    fullName,
    phone,
    phoneNormalized,
    joiningDate,
    startDate,
    grossAmount,
    discountAmount = 0,
    initialPaymentAmount = null,
    initialPaymentMethod = 'cash',
  }) {
    const normalizedInitialPayment =
      initialPaymentAmount && initialPaymentAmount > 0 ? initialPaymentAmount : null

    const { error } = await supabase.rpc('register_member_with_membership', {
      p_full_name: fullName,
      p_phone: phone,
      p_phone_normalized: phoneNormalized,
      p_emergency_contact_name: null,
      p_emergency_contact_phone: null,
      p_joining_date: joiningDate,
      p_plan_id: plan.id,
      p_plan_name_snapshot: plan.name,
      p_duration_days: durationDays,
      p_start_date: startDate,
      p_gross_amount: grossAmount,
      p_discount_amount: discountAmount,
      p_initial_payment_amount: normalizedInitialPayment,
      p_initial_payment_method: normalizedInitialPayment ? initialPaymentMethod : null,
    })
    if (error) throw error

    // Look the ids up rather than trusting the RPC's return shape, which isn't confirmed here.
    const { data: memberRow, error: memberErr } = await supabase
      .from('members')
      .select('id, full_name')
      .eq('phone_normalized', phoneNormalized)
      .single()
    if (memberErr) throw memberErr

    const { data: membershipRow, error: membershipErr } = await supabase
      .from('memberships')
      .select('id')
      .eq('member_id', memberRow.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (membershipErr) throw membershipErr

    return { memberId: memberRow.id, membershipId: membershipRow.id }
  }

  // Fully paid, active
  for (let i = 0; i < 3; i++) {
    const name = randomName()
    const { display, normalized } = randomPhone()
    await registerMember({
      fullName: name, phone: display, phoneNormalized: normalized,
      joiningDate: daysFromToday(0), startDate: daysFromToday(0),
      grossAmount: price, initialPaymentAmount: price,
    })
    console.log(`Seeded (paid, active): ${name}`)
  }

  // Partially paid, active
  {
    const name = randomName()
    const { display, normalized } = randomPhone()
    await registerMember({
      fullName: name, phone: display, phoneNormalized: normalized,
      joiningDate: daysFromToday(0), startDate: daysFromToday(0),
      grossAmount: price, initialPaymentAmount: Math.round(price * 0.5),
    })
    console.log(`Seeded (partially paid): ${name}`)
  }

  // Unpaid, active
  {
    const name = randomName()
    const { display, normalized } = randomPhone()
    await registerMember({
      fullName: name, phone: display, phoneNormalized: normalized,
      joiningDate: daysFromToday(0), startDate: daysFromToday(0),
      grossAmount: price, initialPaymentAmount: null,
    })
    console.log(`Seeded (unpaid): ${name}`)
  }

  // Overpaid -> credit balance
  {
    const name = randomName()
    const { display, normalized } = randomPhone()
    const { memberId } = await registerMember({
      fullName: name, phone: display, phoneNormalized: normalized,
      joiningDate: daysFromToday(0), startDate: daysFromToday(0),
      grossAmount: price, initialPaymentAmount: null,
    })
    const { error: payError } = await supabase.rpc('create_payment', {
      p_member_id: memberId, p_amount: price + 1000, p_payment_method: 'cash', p_allocations: null,
    })
    if (payError) throw payError
    console.log(`Seeded (overpaid, has credit): ${name}`)
  }

  // Frozen
  {
    const name = randomName()
    const { display, normalized } = randomPhone()
    const { membershipId } = await registerMember({
      fullName: name, phone: display, phoneNormalized: normalized,
      joiningDate: daysFromToday(-10), startDate: daysFromToday(-10),
      grossAmount: price, initialPaymentAmount: price,
    })
    const { error: freezeError } = await supabase.rpc('create_freeze', {
      p_membership_id: membershipId, p_start_date: daysFromToday(0),
    })
    if (freezeError) throw freezeError
    console.log(`Seeded (frozen): ${name}`)
  }

  // Expired / lapsed
  {
    const name = randomName()
    const { display, normalized } = randomPhone()
    await registerMember({
      fullName: name, phone: display, phoneNormalized: normalized,
      joiningDate: daysFromToday(-60), startDate: daysFromToday(-60),
      grossAmount: price, initialPaymentAmount: price,
    })
    console.log(`Seeded (expired): ${name}`)
  }

  // Renewed at least once (lapsed renewal)
  {
    const name = randomName()
    const { display, normalized } = randomPhone()
    const { membershipId } = await registerMember({
      fullName: name, phone: display, phoneNormalized: normalized,
      joiningDate: daysFromToday(-90), startDate: daysFromToday(-90),
      grossAmount: price, initialPaymentAmount: price,
    })
    const { error: renewError } = await supabase.rpc('renew_membership', {
      p_membership_id: membershipId,
      p_plan_id: plan.id,
      p_plan_name_snapshot: plan.name,
      p_duration_days: durationDays,
      p_gross_amount: price,
      p_discount_amount: 0,
    })
    if (renewError) throw renewError
    console.log(`Seeded (renewed): ${name}`)
  }

  console.log('Done.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err.message ?? err)
    process.exit(1)
  })