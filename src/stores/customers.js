import { defineStore } from 'pinia'
import { useStorage } from '../utils/storage'
import { uid } from '../utils/format'
import { useSettings } from './settings'
import { useAudit } from './audit'

export const useCustomers = defineStore('customers', () => {
  const settings = useSettings()
  /** { id, code, name, phone, email, address, note, createdAt } */
  const items = useStorage('customers', [])

  const byId = (id) => items.value.find((c) => c.id === id)
  const byPhone = (phone) => items.value.find((c) => c.phone && c.phone === phone)

  function save(data) {
    if (data.id) {
      Object.assign(byId(data.id), data)
      return data.id
    }
    const c = { ...data, id: uid(), code: settings.nextCode('KH'), createdAt: new Date().toISOString() }
    items.value.unshift(c)
    useAudit().log('customer.create', `${c.code} · ${c.name}`)
    return c.id
  }

  function remove(id) {
    const c = byId(id)
    items.value = items.value.filter((c) => c.id !== id)
    useAudit().log('customer.delete', `${c?.code} · ${c?.name}`)
  }

  return { items, byId, byPhone, save, remove }
})
