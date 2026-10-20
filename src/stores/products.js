import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useStorage } from '../utils/storage'
import { uid } from '../utils/format'
import { useSettings } from './settings'
import { useAudit } from './audit'

export const useProducts = defineStore('products', () => {
  const settings = useSettings()
  /** { id, code, name, category, unit, price, cost, stock, minStock, color, active, desc } */
  const items = useStorage('products', [])
  /** Phiếu nhập: { id, code, date, supplier, note, items:[{productId,name,qty,cost}], total } */
  const imports = useStorage('imports', [])

  // Giữ thứ tự như trên menu (theo thứ tự món được thêm vào), nhóm "Dịch vụ" xếp cuối
  const categories = computed(() => {
    const list = [...new Set(items.value.filter((p) => p.active !== false).map((p) => p.category))]
    return [...list.filter((c) => c !== 'Dịch vụ'), ...list.filter((c) => c === 'Dịch vụ')]
  })
  const active = computed(() => items.value.filter((p) => p.active !== false))
  const lowStock = computed(() =>
    active.value.filter((p) => p.trackStock !== false && p.stock <= (p.minStock ?? 5))
  )
  const stockValue = computed(() =>
    items.value.reduce((s, p) => s + (p.trackStock !== false ? p.stock * p.cost : 0), 0)
  )
  const byId = (id) => items.value.find((p) => p.id === id)

  function save(data) {
    if (data.id) {
      const p = byId(data.id)
      const oldPrice = p.price
      Object.assign(p, data)
      if (oldPrice !== p.price) useAudit().log('product.price', `${p.name}: ${oldPrice.toLocaleString('vi-VN')} → ${p.price.toLocaleString('vi-VN')} ₫`)
      else useAudit().log('product.update', `Sửa ${p.name}`)
      return data.id
    }
    const p = { trackStock: true, minStock: 5, active: true, ...data, id: uid(), code: data.code || settings.nextCode('SP') }
    items.value.push(p)
    useAudit().log('product.create', `${p.name} · ${p.price.toLocaleString('vi-VN')} ₫`)
    return p.id
  }

  function remove(id) {
    // Không xoá cứng để giữ lịch sử hoá đơn → ẩn đi
    const p = byId(id)
    if (p) p.active = false
    if (p) useAudit().log('product.disable', `Ngừng bán ${p.name}`)
  }

  /** delta âm = xuất, dương = nhập */
  function adjustStock(id, delta) {
    const p = byId(id)
    if (p && p.trackStock !== false) p.stock = (p.stock || 0) + delta
  }

  function createImport({ supplier, note, lines, date = new Date().toISOString() }) {
    const rec = {
      id: uid(),
      code: settings.nextCode('PN'),
      date,
      supplier,
      note,
      items: lines.map((l) => ({ productId: l.productId, name: byId(l.productId)?.name, qty: +l.qty, cost: +l.cost })),
    }
    rec.total = rec.items.reduce((s, l) => s + l.qty * l.cost, 0)
    rec.items.forEach((l) => {
      adjustStock(l.productId, l.qty)
      const p = byId(l.productId)
      if (p) p.cost = l.cost // cập nhật giá vốn mới nhất
    })
    imports.value.unshift(rec)
    useAudit().log('stock.import', `${rec.code} · ${rec.items.length} mặt hàng · ${rec.total.toLocaleString('vi-VN')} ₫`)
    return rec
  }

  return { items, imports, categories, active, lowStock, stockValue, byId, save, remove, adjustStock, createImport }
})
