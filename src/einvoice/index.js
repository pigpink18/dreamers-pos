/**
 * HOÁ ĐƠN ĐIỆN TỬ (HĐĐT)
 *
 * App không gọi thẳng nhà cung cấp (MISA / Viettel / VNPT) từ trình duyệt vì:
 *  - mật khẩu API không được lộ ra máy bán hàng,
 *  - các API này không cho gọi trực tiếp từ trình duyệt (CORS).
 * Thay vào đó app gọi Supabase Edge Function `einvoice` (supabase/functions/einvoice) — hàm này giữ mật khẩu
 * và chuyển yêu cầu sang nhà cung cấp. Chế độ "sandbox" giả lập toàn bộ để thử quy trình khi chưa có hợp đồng.
 */
import { useSettings } from '../stores/settings'
import { useInvoices } from '../stores/invoices'
import { useAudit } from '../stores/audit'

export const PROVIDERS = {
  none: 'Chưa dùng',
  sandbox: 'Thử nghiệm (giả lập, không gửi cơ quan thuế)',
  misa: 'MISA meInvoice',
  viettel: 'Viettel S-Invoice',
  vnpt: 'VNPT Invoice',
}
export const EINV_STATUS = {
  issued: ['Đã xuất HĐĐT', 'success'],
  pending: ['Chờ xuất HĐĐT', 'warning'],
  failed: ['Xuất HĐĐT lỗi', 'danger'],
}

/** Tách tiền trước thuế / thuế từ giá đã gồm thuế */
export function splitVat(total, rate) {
  const pre = Math.round(total / (1 + rate / 100))
  return { pre, vat: total - pre }
}

/** Dữ liệu gửi đi — định dạng chung, Edge Function đổi sang định dạng riêng của từng nhà cung cấp */
export function buildPayload(inv, buyer, cfg) {
  const rate = +cfg.vatRate || 0
  const lines = inv.items.map((l, i) => {
    const amount = l.price * l.qty
    return { no: i + 1, name: l.name, unit: l.unit || '', qty: l.qty, priceInclVat: l.price, amountInclVat: amount, vatRate: rate, ...splitVat(amount, rate) }
  })
  return {
    ref: inv.code, // mã tham chiếu duy nhất phía app — dùng để chống xuất trùng
    issuedAt: new Date().toISOString(),
    seller: { taxCode: cfg.taxCode, name: cfg.sellerName, templateCode: cfg.templateCode, series: cfg.series },
    buyer: {
      type: buyer?.taxCode ? 'company' : 'individual',
      name: buyer?.name || inv.customerName || 'Khách lẻ',
      companyName: buyer?.companyName || '',
      taxCode: buyer?.taxCode || '',
      address: buyer?.address || '',
      email: buyer?.email || '',
    },
    payment: inv.method === 'cash' ? 'TM' : inv.method === 'transfer' ? 'CK' : 'TM/CK',
    lines,
    discount: inv.discount || 0,
    total: inv.total,
    vatRate: rate,
    ...splitVat(inv.total, rate),
  }
}

async function sandboxIssue(p) {
  await new Promise((r) => setTimeout(r, 700))
  const n = String(Math.floor(Math.random() * 9e6) + 1e6)
  return {
    number: n,
    series: p.seller.series || '1C26TDW',
    lookupCode: 'SBX' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    lookupUrl: '',
    sandbox: true,
  }
}

/**
 * Xuất HĐĐT cho 1 hoá đơn. buyer = null → khách lẻ không lấy thông tin.
 * Trả về invoice.einvoice đã cập nhật; lỗi thì ghi trạng thái 'failed' và ném lỗi.
 */
export async function issueEinvoice(invoiceId, buyer = null) {
  const settings = useSettings()
  const invoices = useInvoices()
  const cfg = settings.einvoice
  const inv = invoices.byId(invoiceId)
  if (!inv) throw new Error('Không tìm thấy hoá đơn')
  if (inv.status !== 'completed') throw new Error('Hoá đơn đã huỷ')
  if (inv.einvoice?.status === 'issued') return inv.einvoice
  if (!cfg.provider || cfg.provider === 'none') throw new Error('Chưa bật hoá đơn điện tử (Cài đặt › Hoá đơn điện tử)')

  const payload = buildPayload(inv, buyer, cfg)
  inv.einvoice = { status: 'pending', provider: cfg.provider, buyer: payload.buyer, requestedAt: payload.issuedAt }
  try {
    let res
    if (cfg.provider === 'sandbox') res = await sandboxIssue(payload)
    else {
      const { getClient } = await import('../sync/connection')
      const client = getClient()
      if (!client) throw new Error('Cần kết nối máy chủ (Cài đặt › Đồng bộ) để xuất HĐĐT thật')
      const { activeShopId } = await import('../tenant')
      const { data, error } = await client.functions.invoke('einvoice', { body: { action: 'issue', provider: cfg.provider, payload, shopId: activeShopId } })
      if (error) throw new Error(error.message || 'Máy chủ HĐĐT báo lỗi')
      if (data?.error) throw new Error(data.error)
      res = data
    }
    inv.einvoice = { ...inv.einvoice, status: 'issued', issuedAt: new Date().toISOString(), ...res, vat: payload.vat, pre: payload.pre }
    useAudit().log('einvoice.issue', `${inv.code} → HĐĐT số ${res.number}${res.sandbox ? ' (thử nghiệm)' : ''}`)
    return inv.einvoice
  } catch (e) {
    inv.einvoice = { ...inv.einvoice, status: 'failed', error: e.message || String(e) }
    throw e
  }
}
