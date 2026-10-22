// =====================================================================
//  Supabase Edge Function: einvoice
//  Nhận yêu cầu xuất HĐĐT từ app, chuyển sang nhà cung cấp (MISA / Viettel / VNPT).
//
//  Triển khai:   supabase functions deploy einvoice
//  Mật khẩu API: supabase secrets set EINV_USERNAME=... EINV_PASSWORD=... EINV_BASE_URL=...
//
//  Mỗi nhà cung cấp có API riêng (đăng nhập lấy token, định dạng dữ liệu, ký số…) và chỉ cấp tài liệu
//  + môi trường thử nghiệm sau khi ký hợp đồng. Phần "TODO" bên dưới là chỗ điền theo tài liệu đó —
//  dữ liệu đầu vào (payload) đã được app chuẩn hoá sẵn: người bán, người mua, dòng hàng, thuế, tổng tiền.
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

type Payload = {
  ref: string
  issuedAt: string
  seller: { taxCode: string; name: string; templateCode: string; series: string }
  buyer: { type: 'company' | 'individual'; name: string; companyName: string; taxCode: string; address: string; email: string }
  payment: string
  lines: { no: number; name: string; unit: string; qty: number; priceInclVat: number; amountInclVat: number; vatRate: number; pre: number; vat: number }[]
  discount: number
  total: number
  vatRate: number
  pre: number
  vat: number
}
type Result = { number: string; series: string; lookupCode: string; lookupUrl?: string }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const env = (k: string) => Deno.env.get(k) ?? ''

// ---------------- Bộ chuyển đổi cho từng nhà cung cấp ----------------
const adapters: Record<string, (p: Payload) => Promise<Result>> = {
  async misa(p) {
    // TODO(MISA meInvoice): theo tài liệu API MISA cấp khi ký hợp đồng
    //  1. Lấy token bằng EINV_USERNAME / EINV_PASSWORD (+ mã số thuế p.seller.taxCode)
    //  2. Đổi p.lines / p.buyer sang cấu trúc hoá đơn của MISA, dùng p.ref làm mã tham chiếu chống trùng
    //  3. Gọi API phát hành, trả về số hoá đơn + mã tra cứu
    throw new Error('Chưa cấu hình kết nối MISA meInvoice — xem supabase/HUONG-DAN.md')
  },
  async viettel(p) {
    // TODO(Viettel S-Invoice): tương tự — đăng nhập, tạo hoá đơn theo tài liệu Viettel cấp
    throw new Error('Chưa cấu hình kết nối Viettel S-Invoice — xem supabase/HUONG-DAN.md')
  },
  async vnpt(p) {
    // TODO(VNPT Invoice): tương tự — theo tài liệu VNPT cấp
    throw new Error('Chưa cấu hình kết nối VNPT Invoice — xem supabase/HUONG-DAN.md')
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    // Chỉ tài khoản cửa hàng đã đăng nhập mới được gọi
    const auth = req.headers.get('Authorization') ?? ''
    const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return json({ error: 'Chưa đăng nhập' }, 401)

    const { action, provider, payload, shopId } = await req.json()
    if (action !== 'issue') return json({ error: 'Thao tác không hỗ trợ' }, 400)

    // Hệ thống nhiều quán: tài khoản HĐĐT (EINV_USERNAME/PASSWORD) là của 1 đơn vị cụ thể.
    // Chỉ cho phép đúng các quán được liệt kê trong EINV_SHOP_IDS (mã quán, cách nhau dấu phẩy),
    // và người gọi phải là thành viên của quán đó — quán khác không thể xuất hoá đơn bằng mã số thuế của mình.
    const allowed = env('EINV_SHOP_IDS').split(',').map((x) => x.trim()).filter(Boolean)
    if (!shopId || !allowed.includes(shopId)) return json({ error: 'Quán này chưa được bật hoá đơn điện tử trên máy chủ' }, 403)
    const { data: member } = await sb.from('shop_members').select('user_id').eq('shop_id', shopId).eq('user_id', user.id).maybeSingle()
    if (!member) return json({ error: 'Tài khoản không thuộc quán này' }, 403)
    const run = adapters[provider]
    if (!run) return json({ error: 'Nhà cung cấp không hỗ trợ: ' + provider }, 400)
    const res = await run(payload as Payload)
    return json(res)
  } catch (e) {
    return json({ error: (e as Error).message }, 200)
  }
})
