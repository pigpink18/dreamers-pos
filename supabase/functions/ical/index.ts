// =====================================================================
//  Supabase Edge Function: ical
//   GET  ?room=<id>&token=<mã>&exclude=booking|airbnb  → lịch .ics của phòng (dán vào Booking.com / Airbnb)
//   POST { action: 'fetch', url }                     → tải lịch iCal của OTA hộ app (app phải đăng nhập)
//
//  Triển khai (cho phép OTA tải lịch không cần đăng nhập):
//    supabase functions deploy ical --no-verify-jwt
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const env = (k: string) => Deno.env.get(k) ?? ''
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

const ALLOWED = [/\.booking\.com$/, /\.airbnb\./, /^airbnb\./, /\.agoda\.com$/, /\.expedia\.com$/, /\.traveloka\.com$/]
const ymd = (d: string) => d.replaceAll('-', '')
const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))

  // ---------- Xuất lịch cho OTA ----------
  if (req.method === 'GET') {
    const u = new URL(req.url)
    const room = u.searchParams.get('room') ?? ''
    const token = u.searchParams.get('token') ?? ''
    const exclude = u.searchParams.get('exclude') ?? ''
    const { data: t } = await admin.from('ical_tokens').select('token').eq('room_id', room).maybeSingle()
    if (!t || !token || t.token !== token) return new Response('Not found', { status: 404 })

    const { data: rows } = await admin.from('docs').select('data').eq('collection', 'bookings').eq('deleted', false).eq('data->>roomId', room)
    const today = new Date().toISOString().slice(0, 10)
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dreamers Home & Coffee//POS//VI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
    for (const { data: b } of rows ?? []) {
      if (!b || b.status === 'cancelled' || b.checkOut <= today) continue
      if (exclude && b.channel === exclude) continue // không trả lại cho OTA lịch do chính OTA đó gửi sang
      lines.push(
        'BEGIN:VEVENT',
        `UID:${b.id}@dreamers-pos`,
        `DTSTAMP:${stamp()}`,
        `DTSTART;VALUE=DATE:${ymd(b.checkIn)}`,
        `DTEND;VALUE=DATE:${ymd(b.checkOut)}`,
        `SUMMARY:${esc('Dreamers - Not available')}`,
        'END:VEVENT',
      )
    }
    lines.push('END:VCALENDAR')
    return new Response(lines.join('\r\n') + '\r\n', { headers: { ...cors, 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' } })
  }

  // ---------- Tải lịch OTA hộ app ----------
  try {
    const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return json({ error: 'Chưa đăng nhập' }, 401)
    const { action, url } = await req.json()
    if (action !== 'fetch') return json({ error: 'Thao tác không hỗ trợ' }, 400)
    const host = new URL(url).hostname
    if (!ALLOWED.some((r) => r.test(host))) return json({ error: 'Chỉ hỗ trợ link lịch của Booking.com, Airbnb, Agoda, Expedia, Traveloka' })
    const r = await fetch(url, { headers: { 'User-Agent': 'DreamersPOS/1.0 (+ical)' } })
    if (!r.ok) return json({ error: `OTA trả về lỗi ${r.status}` })
    return json({ ics: await r.text() })
  } catch (e) {
    return json({ error: (e as Error).message })
  }
})
