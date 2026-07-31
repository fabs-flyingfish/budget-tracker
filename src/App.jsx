import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import BudgetApp from './BudgetApp.jsx'

const USER_ID = 'fabs'

export default function App() {
  const [initialData, setInitialData] = useState(null)
  const [initialSettings, setInitialSettings] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!supabase) {
        setInitialData({})
        setInitialSettings({})
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('budgets')
        .select('months_data, settings')
        .eq('user_id', USER_ID)
        .single()

      setInitialData(data?.months_data || {})
      setInitialSettings(data?.settings || {})
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async (monthsData) => {
    if (!supabase) return
    await supabase
      .from('budgets')
      .upsert(
        { user_id: USER_ID, months_data: monthsData, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
  }

  const handleSaveSettings = async (settings) => {
    if (!supabase) return
    await supabase
      .from('budgets')
      .upsert(
        { user_id: USER_ID, settings, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '16px'
      }}>
        Loading your budget...
      </div>
    )
  }

  return (
    <BudgetApp
      initialMonthsData={initialData}
      initialSettings={initialSettings}
      onSave={handleSave}
      onSaveSettings={handleSaveSettings}
    />
  )
}
