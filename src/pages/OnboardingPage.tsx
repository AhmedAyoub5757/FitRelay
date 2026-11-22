import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export default function OnboardingPage() {
  const [gymName, setGymName] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.rpc('create_gym_and_owner', {
      gym_name: gymName,
      gym_timezone: 'Asia/Karachi',
      owner_full_name: fullName,
    })
    setLoading(false)
    if (error) return setError(error.message)
    await queryClient.invalidateQueries({ queryKey: ['appUser'] })
    navigate('/app')
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Set up your gym</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div>
          <label className="block text-sm font-medium">Gym name</label>
          <input required value={gymName} onChange={(e) => setGymName(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Your name</label>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <button type="submit" disabled={loading} className="w-full rounded bg-black py-2 text-white disabled:opacity-50">
          {loading ? 'Setting up...' : 'Create gym'}
        </button>
      </form>
    </div>
  )
}