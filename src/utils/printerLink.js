/**
 * KẾT NỐI TRỰC TIẾP MÁY IN NHIỆT (không qua hộp thoại in của trình duyệt).
 * - USB       (WebUSB)      : Chrome/Edge trên máy tính, Android (cáp OTG)
 * - Bluetooth (Web Bluetooth): máy in Bluetooth BLE — Chrome Android/máy tính
 * - Cổng COM  (Web Serial)  : máy in cổng COM/USB-Serial, Bluetooth đã ghép đôi trên Windows
 * iPhone/iPad (Safari) không hỗ trợ các cách này -> dùng hộp thoại in như cũ.
 *
 * Cài đặt kết nối lưu riêng trên TỪNG MÁY (không đồng bộ qua máy chủ), vì mỗi máy cắm một máy in khác nhau.
 */
import { reactive } from 'vue'
import { useStorage } from './storage'

export const MODES = {
  system: { label: 'Hộp thoại in', hint: 'Mọi máy in, mọi thiết bị (kể cả iPhone)', icon: 'print' },
  usb: { label: 'USB', hint: 'Cắm cáp USB — Chrome/Edge trên máy tính, Android', icon: 'fa-usb-drive' },
  bluetooth: { label: 'Bluetooth', hint: 'Máy in Bluetooth BLE — Chrome trên Android/máy tính', icon: 'fa-signal-stream' },
  serial: { label: 'Cổng COM', hint: 'Máy in cổng COM, hoặc Bluetooth đã ghép đôi trên Windows', icon: 'fa-plug' },
}

export const supported = {
  system: true,
  usb: typeof navigator !== 'undefined' && 'usb' in navigator,
  bluetooth: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
  serial: typeof navigator !== 'undefined' && 'serial' in navigator,
}

let cfg
/** Cài đặt máy in của máy này: { mode, label, usb, serial, baud, cut } */
export function printerDevice() {
  cfg ??= useStorage('printerDevice', { mode: 'system', label: '', usb: null, serial: null, baud: 9600, cut: true })
  return cfg
}

/** Trạng thái kết nối hiện tại (để hiện trên màn hình cài đặt) */
export const link = reactive({ connected: false, busy: false })

let usb = null // { device, ep }
let ble = null // { device, char }
let port = null // SerialPort

// ---------------- USB ----------------
async function usbOpen(device) {
  if (!device.opened) await device.open()
  if (!device.configuration) await device.selectConfiguration(1)
  // Tìm cổng ghi dữ liệu (bulk OUT), ưu tiên giao diện lớp "máy in" (7)
  const found = []
  for (const iface of device.configuration.interfaces) {
    for (const alt of iface.alternates) {
      const ep = alt.endpoints.find((e) => e.direction === 'out' && e.type === 'bulk')
      if (ep) found.push({ iface, alt, ep })
    }
  }
  found.sort((a, b) => (b.alt.interfaceClass === 7) - (a.alt.interfaceClass === 7))
  const pick = found[0]
  if (!pick) throw new Error('Thiết bị USB này không phải máy in')
  if (!pick.iface.claimed) await device.claimInterface(pick.iface.interfaceNumber)
  if (pick.alt.alternateSetting) await device.selectAlternateInterface(pick.iface.interfaceNumber, pick.alt.alternateSetting)
  return { device, ep: pick.ep.endpointNumber }
}

async function usbGet() {
  if (usb?.device.opened) return usb
  const saved = printerDevice().value.usb
  const list = await navigator.usb.getDevices()
  const device = list.find((d) => saved && d.vendorId === saved.vendorId && d.productId === saved.productId && (!saved.serial || d.serialNumber === saved.serial))
  if (!device) throw new Error('Không thấy máy in USB — kiểm tra dây cáp/nguồn, hoặc chọn lại máy in trong Cài đặt')
  return (usb = await usbOpen(device))
}

// ---------------- Bluetooth (BLE) ----------------
// Các dịch vụ BLE mà máy in nhiệt hay dùng
const BLE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  0xff00, 0xffe0, 0xfff0, 0xffe5,
]

async function bleOpen(device) {
  const server = device.gatt.connected ? device.gatt : await device.gatt.connect()
  for (const svc of await server.getPrimaryServices()) {
    for (const c of await svc.getCharacteristics()) {
      if (c.properties.write || c.properties.writeWithoutResponse) return { device, char: c }
    }
  }
  throw new Error('Máy in Bluetooth này không nhận lệnh in')
}

async function bleGet() {
  if (ble) return ble.device.gatt.connected ? ble : (ble = await bleOpen(ble.device))
  // Chrome chưa nhớ máy BLE qua các lần mở app: thử getDevices (nếu có), không thì hỏi lại
  const saved = printerDevice().value.label
  const known = navigator.bluetooth.getDevices ? await navigator.bluetooth.getDevices() : []
  const device = known.find((d) => d.name === saved) || (await bleRequest())
  return (ble = await bleOpen(device))
}

const bleRequest = () => navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES })

// ---------------- Cổng COM (Serial) ----------------
async function serialGet() {
  if (port?.writable) return port
  const saved = printerDevice().value.serial
  const ports = await navigator.serial.getPorts()
  const p = ports.find((x) => {
    const i = x.getInfo()
    return saved && i.usbVendorId === saved.usbVendorId && i.usbProductId === saved.usbProductId
  }) || (ports.length === 1 ? ports[0] : null)
  if (!p) throw new Error('Không thấy cổng máy in — chọn lại máy in trong Cài đặt')
  if (!p.writable) await p.open({ baudRate: Number(printerDevice().value.baud) || 9600 })
  return (port = p)
}

// ---------------- Chung ----------------
/** Mở hộp chọn máy in của trình duyệt (phải gọi ngay khi bấm nút) */
export async function pickPrinter(mode) {
  const cfg = printerDevice()
  await forget()
  if (mode === 'usb') {
    const device = await navigator.usb.requestDevice({ filters: [] })
    usb = await usbOpen(device)
    cfg.value = { ...cfg.value, mode, label: device.productName || `USB ${device.vendorId.toString(16)}:${device.productId.toString(16)}`,
      usb: { vendorId: device.vendorId, productId: device.productId, serial: device.serialNumber || '' } }
  } else if (mode === 'bluetooth') {
    const device = await bleRequest()
    ble = await bleOpen(device)
    cfg.value = { ...cfg.value, mode, label: device.name || 'Máy in Bluetooth' }
  } else if (mode === 'serial') {
    const p = await navigator.serial.requestPort()
    await p.open({ baudRate: Number(cfg.value.baud) || 9600 })
    port = p
    const i = p.getInfo()
    cfg.value = { ...cfg.value, mode, label: i.usbVendorId ? `Cổng COM (USB ${i.usbVendorId.toString(16)}:${i.usbProductId.toString(16)})` : 'Cổng COM / Bluetooth',
      serial: { usbVendorId: i.usbVendorId, usbProductId: i.usbProductId } }
  }
  link.connected = true
}

/** Ngắt kết nối đang mở (không xoá cài đặt) */
export async function forget() {
  try { if (usb?.device.opened) await usb.device.close() } catch { /* bỏ qua */ }
  try { ble?.device.gatt.connected && ble.device.gatt.disconnect() } catch { /* bỏ qua */ }
  try { if (port?.writable) await port.close() } catch { /* bỏ qua */ }
  usb = ble = port = null
  link.connected = false
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Đảm bảo đã kết nối (gọi trước tiên khi bấm In: Bluetooth có thể cần hỏi chọn lại máy) */
export async function ensureLink() {
  const mode = printerDevice().value.mode
  if (mode === 'usb') await usbGet()
  else if (mode === 'bluetooth') await bleGet()
  else if (mode === 'serial') await serialGet()
  else throw new Error('Chưa chọn máy in kết nối trực tiếp')
  link.connected = true
}

/** Gửi dữ liệu thô tới máy in đang chọn */
export async function sendRaw(data) {
  const mode = printerDevice().value.mode
  if (mode === 'usb') {
    const { device, ep } = await usbGet()
    for (let o = 0; o < data.length; o += 16384) {
      const r = await device.transferOut(ep, data.subarray(o, o + 16384))
      if (r.status !== 'ok') throw new Error('Máy in USB báo lỗi: ' + r.status)
    }
  } else if (mode === 'bluetooth') {
    const { char } = await bleGet()
    // Có xác nhận thì gửi nhanh; không có thì gửi từng gói nhỏ, nghỉ chút cho máy in kịp xử lý
    const ack = char.properties.write
    const size = ack ? 180 : 100
    for (let o = 0; o < data.length; o += size) {
      const chunk = data.subarray(o, o + size)
      if (ack) await char.writeValueWithResponse(chunk)
      else { await char.writeValueWithoutResponse(chunk); await wait(12) }
    }
  } else if (mode === 'serial') {
    const p = await serialGet()
    const writer = p.writable.getWriter()
    try { await writer.write(data) } finally { writer.releaseLock() }
  } else {
    throw new Error('Chưa chọn máy in kết nối trực tiếp')
  }
  link.connected = true
}
