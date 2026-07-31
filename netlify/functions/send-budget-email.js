// Netlify scheduled function — runs at 9am on the 28th of every month
// Fetches budget data from Supabase and sends email via Resend

const { createClient } = require('@supabase/supabase-js')

const USER_ID = 'fabs'

const handler = async (event) => {
  try {
    // 1. Fetch current month's budget data from Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )

    const { data, error } = await supabase
      .from('budgets')
      .select('months_data, settings')
      .eq('user_id', USER_ID)
      .single()

    if (error || !data) {
      console.error('Could not fetch budget data:', error)
      return { statusCode: 500, body: 'Could not fetch budget data' }
    }

    // Work out the effective send day for this month
    // If user chose 31 but it's February, fall back to the last day of the month
    const sendDay = data.settings?.sendDay || 28
    const now = new Date()
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const effectiveSendDay = Math.min(sendDay, lastDayOfMonth)
    const todayDate = now.getDate()

    const forceSend = event.queryStringParameters?.force === 'true'

    if (!forceSend && todayDate !== effectiveSendDay) {
      console.log(`Today is the ${todayDate}th — effective send day is the ${effectiveSendDay}th (user chose ${sendDay}, month has ${lastDayOfMonth} days). Skipping.`)
      return { statusCode: 200, body: 'Not send day yet' }
    }

    console.log(`Sending budget email — today is the ${todayDate}th, send day is the ${effectiveSendDay}th`)

    // 2. Find current month's data
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`

    const monthData = data.months_data[monthKey]
    if (!monthData) {
      console.error('No data found for current month:', monthKey)
      return { statusCode: 404, body: 'No data for current month' }
    }

    const { bills, debts, creditCardNote } = monthData

    // 3. Calculate totals
    const totalCreditForBills = debts
      .filter(d => parseFloat(d.instalment) > 0)
      .reduce((sum, d) => sum + parseFloat(d.instalment), 0)

    const allBills = totalCreditForBills > 0
      ? [...bills, { id: 'cc', name: 'Credit Cards', emoji: '💳', amount: totalCreditForBills, note: creditCardNote || '' }]
      : bills

    const activeBills = allBills.filter(b => parseFloat(b.amount) > 0)
    const total = activeBills.reduce((sum, b) => sum + parseFloat(b.amount), 0)
    const each = (total / 2).toFixed(2)

    // 4. Build email HTML
    const billRows = activeBills.map(b => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #2a2455; font-size: 15px;">
          ${b.emoji} ${b.name}
          ${b.note ? `<br><span style="font-size: 12px; color: #a78bfa;">📝 ${b.note}</span>` : ''}
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #2a2455; text-align: right; font-weight: 700; font-size: 15px;">
          £${parseFloat(b.amount).toFixed(2)}
        </td>
      </tr>
    `).join('')

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="background: #0f0c29; margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; color: #fff;">
        <div style="max-width: 480px; margin: 0 auto;">

          <div style="background: linear-gradient(135deg, #1a1640, #2a2455); border-radius: 20px; padding: 28px; border: 1px solid rgba(139,92,246,0.3);">

            <h1 style="margin: 0 0 4px; font-size: 24px; font-weight: 800;">💰 ${monthLabel} Budget</h1>
            <p style="margin: 0 0 24px; color: rgba(255,255,255,0.5); font-size: 14px;">Here's this month's breakdown</p>

            <table style="width: 100%; border-collapse: collapse;">
              ${billRows}
            </table>

            <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid rgba(139,92,246,0.3);">
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="font-size: 16px; font-weight: 600;">Total</span>
                <span style="font-size: 16px; font-weight: 800;">£${total.toFixed(2)}</span>
              </div>
              <div style="background: linear-gradient(135deg, rgba(124,58,237,0.3), rgba(59,130,246,0.2)); border-radius: 14px; padding: 16px; text-align: center; border: 1px solid rgba(139,92,246,0.3);">
                <p style="margin: 0 0 4px; font-size: 13px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px;">Each pays</p>
                <p style="margin: 0; font-size: 36px; font-weight: 800; color: #c4b5fd;">£${each}</p>
              </div>
            </div>

            <p style="margin: 20px 0 0; font-size: 13px; color: rgba(255,255,255,0.4); text-align: center;">
              Please transfer £${each} to the joint account before the 1st! 🙏
            </p>
          </div>

          <p style="text-align: center; margin-top: 16px; font-size: 12px; color: rgba(255,255,255,0.2);">
            Sent automatically by Home Budget on the 28th
          </p>
        </div>
      </body>
      </html>
    `

    // 5. Send via Resend
    // Use emails from settings if saved, fall back to env vars
    const emails = [
      data.settings?.email1 || process.env.EMAIL_1,
      data.settings?.email2 || process.env.EMAIL_2
    ].filter(Boolean)

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
       from: 'Home Budget <onboarding@resend.dev>',
        to: emails,
        subject: `💰 ${monthLabel} Budget — £${each} each`,
        html,
      }),
    })

    if (!resendRes.ok) {
      const err = await resendRes.text()
      console.error('Resend error:', err)
      return { statusCode: 500, body: 'Email send failed' }
    }

    console.log(`Budget email sent for ${monthLabel} to ${emails.join(', ')}`)
    return { statusCode: 200, body: 'Email sent successfully' }

  } catch (err) {
    console.error('Unexpected error:', err)
    return { statusCode: 500, body: 'Unexpected error' }
  }
}

module.exports = { handler }
