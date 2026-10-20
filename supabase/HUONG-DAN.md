# Hướng dẫn cài máy chủ Supabase cho Dreamers POS

Làm 1 lần, khoảng 15 phút. Sau đó mọi máy (máy quầy, điện thoại của Lam, iPad…) dùng chung dữ liệu.

## 1. Tạo dự án Supabase

1. Vào <https://supabase.com>, bấm **Start your project** và đăng nhập bằng GitHub hoặc email.
2. Bấm **New project**:
   - **Name:** `dreamers-pos`
   - **Database password:** đặt một mật khẩu mạnh rồi lưu lại. App không dùng mật khẩu này, nó chỉ để quản trị.
   - **Region:** chọn **Southeast Asia (Singapore)** cho nhanh.
3. Đợi khoảng 2 phút để dự án khởi tạo xong.

## 2. Tạo bảng dữ liệu

1. Mở **SQL Editor** → **New query**.
2. Mở file `supabase/schema.sql` trong thư mục dự án, copy toàn bộ, dán vào rồi bấm **Run**.
3. Thấy dòng *Success* là xong. Chạy lại lần nữa cũng không sao.

## 3. Tạo tài khoản cho cửa hàng

Mọi máy của quán dùng chung **một** tài khoản này để kết nối. Nhân viên vẫn đăng nhập app bằng PIN như bình thường.

1. Mở **Authentication** → **Users** → **Add user** → **Create new user**.
2. Nhập email (VD `dreamers.pos@gmail.com`) và một mật khẩu. Tick **Auto Confirm User**.
3. **Quan trọng:** vào **Authentication** → **Sign In / Providers**, tắt **Allow new users to sign up**. Như vậy người lạ không tự tạo được tài khoản.

## 4. Kết nối app

1. Vào **Project Settings** → **API**. Copy 2 thứ:
   - **Project URL**, dạng `https://abcdxyz.supabase.co`
   - **anon / public key**, hoặc **publishable key**. Đây là khoá công khai, dán vào app được.
   - ⚠️ **Không** dùng khoá `service_role` / `secret` trong app.
2. Trên **máy quầy** (máy có dữ liệu đúng):
   - Mở app → **Cài đặt** → **Đồng bộ**, dán URL và key, nhập email/mật khẩu ở bước 3 rồi bấm **Kết nối**.
   - Máy chủ đang trống nên app tự đưa toàn bộ dữ liệu lên.
3. Trên **máy thứ 2, 3…**, làm giống hệt. Khi app hỏi, chọn **Dùng dữ liệu máy chủ**.

Biểu tượng đám mây trên thanh trên cùng cho biết trạng thái:

- **Xanh lá:** đang đồng bộ.
- **Vàng:** mất mạng. App vẫn bán bình thường và sẽ tự gửi khi có mạng lại.
- **Số nhỏ trên biểu tượng:** số thay đổi đang chờ gửi.

## 5. Cài Supabase CLI (cho bước 6 và 7)

Cần cho tính năng lịch Booking.com / Airbnb và hoá đơn điện tử thật. Chạy trên Mac, trong Terminal:

```bash
brew install supabase/tap/supabase
cd ~/Documents/dreamers-pos
supabase login
supabase link --project-ref abcdxyz      # "abcdxyz" là phần đầu của Project URL
```

## 6. Kênh đặt phòng (Booking.com, Airbnb)

```bash
supabase functions deploy ical --no-verify-jwt
```

`--no-verify-jwt` để Booking.com / Airbnb tải được lịch mà không cần đăng nhập. Mỗi link có mã bí mật riêng cho từng phòng.

Trong app, vào **Cài đặt** → **Kênh đặt phòng**, rồi làm với từng phòng:

- **Booking.com → Dreamers:**
  1. Trên Booking.com: **Extranet** → **Giá & Tình trạng phòng trống** → **Đồng bộ lịch** → **Xuất lịch**. Copy link.
  2. Dán link vào ô *Booking.com → Dreamers* của phòng tương ứng.
- **Airbnb → Dreamers:**
  1. Trên Airbnb: **Lịch** → chọn chỗ ở → **Tình trạng còn phòng** → **Kết nối với trang web khác** → **Xuất lịch**. Copy link.
  2. Dán vào ô *Airbnb → Dreamers*.
- **Dreamers → OTA:**
  1. Bấm **Link cho Booking.com** hoặc **Link cho Airbnb** để copy.
  2. Dán vào mục **Nhập lịch** trên Booking.com / Airbnb.
- Bấm **Lưu link** rồi **Đồng bộ ngay**.

Tên các mục menu trên Booking.com / Airbnb có thể khác một chút tuỳ phiên bản; tìm mục "Đồng bộ lịch / iCal".

Lưu ý:

- iCal chỉ cho biết **ngày bận**, không có tên khách hay giá. Lượt đặt nhập về sẽ có tên "Khách Booking.com" hoặc "Khách Airbnb · HM…".
- Booking.com / Airbnb thường chỉ cập nhật lịch **mỗi 1–3 giờ**, nên vẫn có thể bị trùng phòng trong khoảng đó.
- Nếu cần chống trùng tức thì hoặc đồng bộ cả giá, phải dùng channel manager trả phí.
- Đơn OTA bị huỷ (biến mất khỏi lịch) sẽ tự chuyển sang "Đã huỷ" nếu khách chưa nhận phòng.

## 7. Hoá đơn điện tử

1. Lúc chưa có hợp đồng: vào **Cài đặt** → **Hoá đơn điện tử**, chọn **Thử nghiệm** để chạy thử toàn bộ quy trình. Số hoá đơn lúc này là giả lập.
2. Khi đã ký với MISA / Viettel / VNPT, nhà cung cấp sẽ cấp tài liệu API, tài khoản và môi trường thử nghiệm.
3. Lưu thông tin bí mật lên máy chủ. Mật khẩu chỉ nằm trên máy chủ, không nằm trên máy bán hàng.

   ```bash
   supabase secrets set EINV_USERNAME=... EINV_PASSWORD=... EINV_BASE_URL=...
   ```

4. Điền phần `TODO` trong `supabase/functions/einvoice/index.ts` theo tài liệu của nhà cung cấp. App đã chuẩn hoá sẵn dữ liệu: người bán, người mua, từng dòng hàng, thuế, tổng tiền.
5. Triển khai:

   ```bash
   supabase functions deploy einvoice
   ```

6. Trong app, chọn nhà cung cấp, điền mã số thuế, mẫu số và ký hiệu. Thử với môi trường thử nghiệm của nhà cung cấp trước khi bật **Tự xuất HĐĐT**.

## Câu hỏi thường gặp

- **Mất mạng thì sao?**
  - App vẫn bán, nhận phòng, đóng ca bình thường. Mọi thay đổi nằm trong hàng đợi và tự gửi khi có mạng.
  - Nếu 2 máy cùng sửa **một** bản ghi lúc mất mạng (VD cùng sửa giá 1 món), bản gửi lên sau sẽ được giữ.
- **Mã hoá đơn có bị trùng giữa 2 máy không?**
  - Bộ đếm luôn lấy số lớn nhất giữa các máy.
  - Chỉ có thể trùng khi 2 máy cùng mất mạng và cùng bán. Khi đó vẫn đủ hoá đơn, chỉ trùng số thứ tự hiển thị.
- **Gói miễn phí của Supabase có đủ không?**
  - Một quán café + homestay thường dùng ít hơn nhiều so với giới hạn gói miễn phí (500 MB cơ sở dữ liệu).
  - Dự án miễn phí có thể bị **tạm dừng nếu 7 ngày không có hoạt động**. Quán dùng hằng ngày thì không bị.
- **Sao lưu?**
  - **Cài đặt** → **Dữ liệu** → **Xuất bản sao lưu** vẫn dùng được.
  - Supabase cũng tự sao lưu hằng ngày ở các gói trả phí.
