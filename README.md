# Dreamers Home & Coffee POS

Phần mềm bán hàng & quản lý homestay cho **Dreamers Home & Coffee**.

Phần mềm quản lý bán hàng kiểu KiotViet, kèm module quản lý phòng homestay.
Viết bằng **Vue 3 + Vite + Pinia + Vue Router + SCSS** (JavaScript), dữ liệu lưu trong **localStorage**.

### Giao diện
- Phong cách Apple (macOS / iOS) với 3 theme: **Latte** (kem sữa & nâu cà phê, mặc định), **Espresso** (tối), **Classic** (xám & indigo). Màu nằm trong `src/styles/_themes.scss`.
- Icon: **Font Awesome 6 Pro – Light** (`src/assets/font-awesome-6-pro`). Dùng `<Icon name="cart" />` hoặc `<Icon name="fa-mug-hot" />`.
- **Chọn ngày:** `@vuepic/vue-datepicker`, bọc trong `components/ui/AppDate.vue` (tiếng Việt, tuần bắt đầu Thứ 2, lịch kiểu iOS).
  `<AppDate v-model="ngay" />` → `'YYYY-MM-DD'` · `<AppDate v-model="thang" mode="month" />` → `'YYYY-MM'`
- **Dropdown có tìm kiếm (kiểu Select2):** `vue-multiselect`, bọc trong `components/ui/AppSelect.vue`.
  `<AppSelect v-model="id" :options="[{ value, label, sub }]" />`, tự bật ô tìm kiếm khi có hơn 7 lựa chọn.

### Chạy trên điện thoại như một app (PWA)
Trên điện thoại app có **thanh tab dưới đáy** kiểu iOS. Giỏ hàng POS và các popup biến thành **tấm trượt từ dưới lên**, bảng tự chuyển thành **danh sách thẻ**.

**Thử nhanh qua Wi-Fi** (máy tính và điện thoại cùng mạng):
```bash
npm run mobile          # in ra địa chỉ Network, ví dụ http://192.168.1.10:5173
```
Mở địa chỉ đó bằng Safari trên iPhone.

**Cài như app thật:** cần đưa lên một địa chỉ **https**, ví dụ Netlify hoặc Vercel (miễn phí, chỉ cần kéo thả thư mục `dist/` sau khi `npm run build`).
- iPhone: mở bằng Safari → nút Chia sẻ → **Thêm vào Màn hình chính**
- Android: Chrome → menu ⋮ → **Cài đặt ứng dụng**

App sẽ mở toàn màn hình với icon chữ D, và vẫn chạy được khi mất mạng.
Lưu ý: dữ liệu đang lưu trong từng máy (localStorage), nên điện thoại và máy tính **không dùng chung dữ liệu** cho tới khi có backend.

### Người dùng, phân quyền & vận hành
**Đăng nhập bằng PIN** kiểu máy POS ở quầy: chọn tên, nhập PIN 6 số. Dữ liệu mẫu có sẵn 2 người:

| Người | Vai trò | PIN | Được làm gì (mặc định) |
|---|---|---|---|
| Yến | Chủ quán | 240819 | Toàn quyền |
| Lam | Nhân viên | 123456 | Bán hàng, hoá đơn, khách, đặt/nhận/trả/dọn phòng, mở/đóng ca, giảm tới 10% |

Các vai trò Quản lý, Thu ngân, Lễ tân, Buồng phòng vẫn có sẵn để gán khi thêm người.

- **Phân quyền** (Cài đặt › Phân quyền): bật/tắt từng quyền cho từng vai trò, đặt mức giảm giá tối đa, tạo vai trò mới. Menu và nút bấm tự ẩn theo quyền; gõ thẳng đường dẫn cũng bị chặn.
- **Ca làm việc:** mở ca với tiền đầu ca, đóng ca bằng cách **đếm két theo từng mệnh giá**, tự tính tiền dự kiến và báo thừa/thiếu, in phiếu chốt ca. Có thể bật "bắt buộc mở ca trước khi bán".
- **Quản lý duyệt bằng PIN:** huỷ hoá đơn (bắt buộc ghi lý do), giảm giá vượt mức của vai trò, huỷ đặt phòng đã cọc, xoá dữ liệu.
- **Nhật ký thao tác:** ghi lại ai làm gì, lúc nào, ai duyệt; lọc theo người, loại thao tác, ngày; xuất CSV.
- **Khoá màn hình / đổi người:** từ menu tài khoản, hoặc tự khoá sau N phút không thao tác.
- **Giao diện:** 3 theme (Latte, Espresso, Classic) và 2 kiểu menu (dọc, ngang), chọn trong Cài đặt › Giao diện; lưu riêng cho từng máy.

> ⚠️ Toàn bộ dữ liệu, kể cả tài khoản, đang nằm trong trình duyệt. PIN được băm nhưng **không phải bảo mật thật**: ai mở được DevTools của máy đó đều can thiệp được. Khi dùng nhiều máy hoặc cần bảo mật, phải chuyển phần đăng nhập và dữ liệu lên server.

### Phòng (theo bảng giá Dreamers)
| Phòng | Giá/đêm |
|---|---|
| Mây · Cloud Room | 820.000 |
| Nắng · Sunny Room | 820.000 |
| Gió · Wind Room | 820.000 |
| Thu · Autumn Room | 780.000 |
| Hạ · Summer Room | 780.000 |
| Đông · Winter Room | 500.000 |
| Sương · Mist Room | 680.000 |

Nhận phòng 14:00 · Trả phòng 12:00 · Phụ thu người lớn 200.000 ₫/đêm (có sẵn trong mục Dịch vụ).

## Đưa app lên GitHub Pages cho mọi người test

App là web tĩnh, nên GitHub tự build và host miễn phí. File `.github/workflows/deploy.yml` đã có sẵn: mỗi lần đẩy code lên nhánh `main`, GitHub tự build và cập nhật link.

1. Tạo repo mới trên GitHub tên `dreamers-pos`. Đừng tick "Add a README".
2. Trong thư mục dự án, chạy:
   ```bash
   git init
   git add .
   git commit -m "Dreamers POS"
   git branch -M main
   git remote add origin https://github.com/<tên-tài-khoản>/dreamers-pos.git
   git push -u origin main
   ```
3. Trên GitHub: **Settings** → **Pages** → mục **Source** chọn **GitHub Actions**.
4. Mở tab **Actions**, đợi khoảng 1–2 phút cho dấu tích xanh. Link app: `https://<tên-tài-khoản>.github.io/dreamers-pos/`
5. Lần sau sửa code chỉ cần `git add . && git commit -m "..." && git push`.

Khi test:
- App mới chỉ có 2 tài khoản: **Yến** (chủ quán, PIN `240819`) và **Lam** (nhân viên, PIN `123456`). Chưa có món, phòng hay hoá đơn.
- Muốn xem thử với số liệu có sẵn: **Cài đặt** → **Dữ liệu** → **Nạp dữ liệu mẫu**.
- Mỗi người test có dữ liệu riêng trên trình duyệt của mình. Muốn mọi máy dùng chung dữ liệu thì kết nối Supabase (xem `supabase/HUONG-DAN.md`).
- Đổi `DATA_VERSION` trong `src/main.js` sẽ xoá sạch dữ liệu trên mọi máy ở lần mở tiếp theo.

## Chạy project

```bash
npm install
npm run dev      # mở http://localhost:5173
npm run build    # build ra thư mục dist/ để deploy
```

Lần đầu mở app sẽ tự nạp **dữ liệu mẫu** (khoảng 150 ngày hoá đơn, 8 phòng, 12 khách) để bạn xem được báo cáo ngay.
Khi muốn dùng thật: **Cài đặt → Xoá toàn bộ, bắt đầu dùng thật**.

## Tính năng

| Màn hình | Chức năng |
|---|---|
| **Tổng quan** | Doanh thu hôm nay (so với cùng giờ hôm qua), công suất phòng, biểu đồ 14 ngày, hoá đơn gần đây, hàng sắp hết |
| **Bán hàng (POS)** | Tìm hàng (F3), nhiều tab hoá đơn cùng lúc, chọn/thêm nhanh khách, giảm giá, 3 hình thức thanh toán, gợi ý tiền khách đưa, tính tiền thừa, thanh toán (F9), in hoá đơn K80. Chặn bán quá số tồn |
| **Hoá đơn** | Lọc theo ngày (hôm nay / hôm qua / 7 ngày / tháng này / tuỳ chọn), loại, hình thức, trạng thái; tìm theo mã/khách; xem, in, **huỷ hoá đơn (tự hoàn kho)**; xuất CSV |
| **Sơ đồ phòng** | Mỗi phòng có 4 trạng thái: **Đang trống / Sắp nhận / Đang ở / Đã trả – chờ dọn**. Nhận phòng, trả phòng (tính số đêm, cộng dịch vụ phát sinh, trừ tiền cọc, xuất hoá đơn), đánh dấu đã dọn, gia hạn. Danh sách khách đến và phòng đến hạn trả trong ngày |
| **Lịch đặt phòng** | Timeline 7/14/30 ngày, công suất % mỗi ngày, bấm ô trống để đặt nhanh, **chặn trùng lịch** |
| **Hàng hoá & kho** | Thêm/sửa/ngừng bán, nhóm hàng, giá vốn, lãi trên mỗi đơn vị, cảnh báo tồn thấp, **phiếu nhập hàng** (cộng kho và cập nhật giá vốn), lịch sử nhập |
| **Khách hàng** | Danh bạ, tổng chi tiêu, số lần lưu trú, lịch sử mua hàng và lưu trú của từng khách |
| **Báo cáo** | Tổng hợp theo **Ngày / Tháng / Quý / Năm**: doanh thu (tách bán hàng và tiền phòng), số hoá đơn, giá trị trung bình, lợi nhuận gộp, % so với kỳ trước, biểu đồ, tổng hợp theo tháng (khi xem quý/năm), hình thức thanh toán, top hàng bán chạy, xuất CSV |
| **Cài đặt** | Thông tin in trên hoá đơn, sao lưu/khôi phục JSON, nạp lại dữ liệu mẫu |

## Cấu trúc code

```
src/
├── main.js                 khởi động app, nạp dữ liệu mẫu lần đầu
├── router/index.js         danh sách trang + menu
├── styles/
│   ├── _tokens.scss        font, bo góc, hiệu ứng kính (mixin glass)
│   └── main.scss           ★ BẢNG MÀU Sáng/Tối (:root và [data-theme='dark']) + style dùng chung
├── utils/
│   ├── storage.js          useStorage(): ref tự lưu vào localStorage  ← đổi sang API thì sửa file này
│   ├── format.js           định dạng tiền, ngày, tìm kiếm không dấu, xuất CSV
│   └── report.js           tính toán báo cáo theo kỳ (ngày/tháng/quý/năm)
├── stores/                 Pinia — toàn bộ nghiệp vụ nằm ở đây
│   ├── products.js         hàng hoá, tồn kho, phiếu nhập
│   ├── customers.js
│   ├── invoices.js         tạo hoá đơn (trừ kho), huỷ (hoàn kho)
│   ├── rooms.js            phòng, đặt phòng, nhận/trả phòng, trạng thái phòng
│   ├── settings.js         thông tin cửa hàng, sinh mã HD000001, DP000001...
│   ├── ui.js               toast + hộp xác nhận
│   └── seed.js             dữ liệu mẫu
├── layouts/AppLayout.vue   sidebar + topbar
├── components/
│   ├── ui/                 Icon, BaseModal, StatCard, BarChart (SVG, không dùng thư viện)
│   ├── invoices/           mẫu in hoá đơn, chi tiết hoá đơn
│   ├── customers/          ô chọn khách, form khách
│   └── rooms/              form đặt phòng, trả phòng
└── views/                  9 màn hình
```

### Luồng dữ liệu chính

- **Bán hàng:** `PosView` → `invoices.create()` → trừ `products.stock`
- **Huỷ hoá đơn:** `invoices.cancel()` → cộng lại `stock`
- **Trả phòng:** `rooms.checkOut()` → tính số đêm → `invoices.create({ type: 'room' })` → phòng chuyển sang "chờ dọn"
- **Báo cáo:** `aggregate(invoices, buildRange(mode, kỳ))` chỉ tính hoá đơn **hoàn thành**, gom theo giờ/ngày/tuần/tháng

## Đổi giao diện theo phong cách của bạn

Mở `src/styles/main.scss`, sửa các biến ở đầu file:

```scss
:root {                    // giao diện Sáng
  --accent: #0071e3;       // màu nhấn (nút chính, mục đang chọn)
  --bg: #f5f5f7;           // nền
  --chart-1 / --chart-2    // màu biểu đồ
}
[data-theme='dark'] { ... } // giao diện Tối
```

## Kết nối & tích hợp

| Tính năng | Ở đâu | Cần gì |
|---|---|---|
| **Dùng chung dữ liệu nhiều máy** (realtime, chạy được khi mất mạng) | Cài đặt › Đồng bộ | Dự án Supabase (miễn phí) — xem `supabase/HUONG-DAN.md` |
| **QR chuyển khoản VietQR** (có sẵn số tiền + mã hoá đơn) | Cài đặt › Thanh toán | Chỉ cần số tài khoản; mã tạo ngay trên máy, không cần mạng |
| **Hoá đơn điện tử** | Cài đặt › Hoá đơn điện tử · nút "Xuất HĐĐT" trong hoá đơn | Chế độ Thử nghiệm dùng ngay; xuất thật cần hợp đồng MISA/Viettel/VNPT + Edge Function `einvoice` |
| **Lịch Booking.com / Airbnb** (iCal 2 chiều) | Cài đặt › Kênh đặt phòng | Link iCal từ OTA; link xuất lịch cần Edge Function `ical` |

Mã nguồn liên quan: `src/sync/` (đồng bộ), `src/utils/vietqr.js`, `src/einvoice/`, `src/channels/ical.js`, `supabase/` (SQL + Edge Functions).

## Giới hạn hiện tại và hướng nâng cấp

- Khi **chưa** kết nối máy chủ: dữ liệu chỉ nằm trong trình duyệt của 1 máy (localStorage ~5MB). Kết nối Supabase để dùng nhiều máy và không lo mất dữ liệu.
- iCal chỉ đồng bộ ngày bận (không có tên khách/giá), OTA cập nhật 1–3 giờ/lần. Cần chống trùng tức thì → channel manager trả phí.
- Hoá đơn điện tử thật cần điền phần kết nối theo tài liệu của nhà cung cấp (`supabase/functions/einvoice`).
- Chưa có trả hàng một phần, công nợ khách, quét mã vạch.
