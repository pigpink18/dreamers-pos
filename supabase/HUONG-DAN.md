# Hướng dẫn cài máy chủ cho hệ thống nhiều quán (Supabase)

Làm 1 lần, khoảng 20 phút. Sau đó:

- **Chủ quán nào cũng tự đăng ký** trên link app, tạo quán của mình và dùng ngay.
- **Mỗi quán có dữ liệu riêng hoàn toàn**: menu, phòng, hoá đơn, nhân viên, ca làm việc. Quán này không thể xem hay sửa dữ liệu quán khác. Máy chủ kiểm tra quyền trên từng dòng dữ liệu, kể cả khi ai đó tự gọi API.
- **1 tài khoản có thể có nhiều quán** (chi nhánh), chuyển qua lại được.
- **Mọi máy của cùng 1 quán** (máy quầy, điện thoại, iPad) dùng chung dữ liệu theo thời gian thực. Mất mạng vẫn bán được bình thường.

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

(File `schema-1-quan-cu.sql` là bản cũ cho 1 quán, không cần chạy.)

## 3. Cho phép chủ quán tự đăng ký

Vào **Authentication**:

1. **Sign In / Providers** → **Email**: bật **Enable Email provider** và **Allow new users to sign up**.
2. Cũng ở mục Email: **tắt Confirm email**. Như vậy chủ quán đăng ký xong dùng ngay, không cần bấm link trong email.
   - Nếu muốn bắt xác nhận email thì cứ để bật. App sẽ báo "Đã gửi email xác nhận" và chủ quán bấm link rồi quay lại đăng nhập.
3. **URL Configuration** → **Site URL**: điền link app, VD `https://pigpink18.github.io/dreamers-pos/`.

## 4. Gắn máy chủ vào app trên GitHub

1. Trong Supabase, vào **Project Settings** → **API** (hoặc **API Keys**). Copy 2 thứ:
   - **Project URL**, dạng `https://abcdxyz.supabase.co`
   - **anon / public key**, hoặc **publishable key**. Đây là khoá công khai, đưa vào app được.
   - ⚠️ **Không bao giờ** dùng khoá `service_role` / `secret` trong app.
2. Trên GitHub, mở repo **dreamers-pos** → **Settings** → **Secrets and variables** → **Actions** → tab **Variables** → **New repository variable**. Tạo 2 biến:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon key
3. Vào tab **Actions** → **Deploy to GitHub Pages** → **Run workflow** (hoặc đẩy code mới lên). Khoảng 2 phút sau link app có máy chủ.

Khi chưa làm bước 4, app vẫn chạy **chế độ 1 máy** như cũ: dữ liệu chỉ nằm trên máy đó.

## 5. Đưa quán Dreamers lên hệ thống (làm trên máy quầy, máy có dữ liệu đúng)

1. Mở app. App tự chuyển tới màn **Tài khoản chủ quán**.
2. Chọn **Đăng ký quán mới**, nhập email + mật khẩu của chủ quán.
3. Ở form **Tạo quán mới**: điền tên quán, chọn **Dữ liệu đang có trên máy này** (menu, phòng, hoá đơn, nhân viên, mã PIN giữ nguyên) → **Tạo quán & mở**.
4. Trên **máy thứ 2, 3…** của Dreamers: mở app → **Đăng nhập** bằng đúng email đó → bấm vào quán Dreamers. App tự tải dữ liệu quán về.
   - Lần đầu mở quán trên 1 máy cần có mạng.

## 6. Mời chủ quán khác dùng

Gửi họ link app. Họ:

1. Bấm **Đăng ký quán mới**, nhập email + mật khẩu của họ.
2. Điền tên quán, địa chỉ, tên của họ và mã PIN 6 số → **Tạo quán & mở**.
3. Quán mới **trống hoàn toàn**: họ tự thêm menu (Hàng hoá), phòng (Sơ đồ phòng), nhân viên (Cài đặt › Người dùng), tài khoản ngân hàng nhận chuyển khoản (Cài đặt › Thanh toán).

Mở thêm chi nhánh: vào **Cài đặt** → **Tài khoản & đồng bộ** → **Tài khoản & đổi quán** → **Tạo quán mới**.

## 6b. Nhân viên: dùng PIN hoặc mời bằng email

Vào **Cài đặt** → **Người dùng** → **Thêm người dùng**. Có 2 cách, chọn cách nào cũng được:

- **Chỉ dùng PIN** (để trống ô Email): nhân viên vào ca và chốt ca bằng mã PIN trên máy của quán, như trước giờ.
- **Mời bằng email** (điền Email): app hiện **link mời** → bấm **Sao chép link** hoặc **Chia sẻ** để gửi qua Zalo / tin nhắn.
  - Nhân viên mở link → **đăng ký hoặc đăng nhập bằng đúng email đó** → vào thẳng quán trên điện thoại của họ, rồi vào ca bằng PIN của mình.
  - Link chỉ dùng được với đúng email đó. Người khác có link nhưng khác email thì không vào được.
  - Danh sách người dùng hiện trạng thái **Chờ nhận lời mời** (bấm vào để lấy lại link) hoặc **Đã tham gia**.
  - **Khoá** người dùng hoặc xoá email: người đó mất quyền vào quán ngay trên mọi máy.

Quyền trên máy chủ theo vai trò:

- **Quản lý:** bán hàng, sửa menu, thêm nhân viên, mời nhân viên. **Không** đổi được tài khoản ngân hàng nhận tiền.
- **Nhân viên, thu ngân, lễ tân, buồng phòng:** bán hàng, nhận / trả phòng, ca làm việc. **Không** sửa được người dùng, mã PIN, phân quyền, thông tin quán hay tài khoản ngân hàng, kể cả khi cố tình gọi thẳng máy chủ.

⚠️ **Mỗi khi file `supabase/schema.sql` được cập nhật, chạy lại toàn bộ file trong SQL Editor.** Chạy lại nhiều lần vẫn an toàn, không mất dữ liệu.

Biểu tượng đám mây trên thanh trên cùng cho biết trạng thái đồng bộ:

- **Xanh lá:** đang đồng bộ.
- **Vàng:** mất mạng. App vẫn bán bình thường và sẽ tự gửi khi có mạng lại.
- **Số nhỏ trên biểu tượng:** số thay đổi đang chờ gửi.

## 7. Cài Supabase CLI (cho bước 8 và 9)

Cần cho tính năng lịch Booking.com / Airbnb và hoá đơn điện tử thật. Chạy trên Mac, trong Terminal:

```bash
brew install supabase/tap/supabase
cd ~/Documents/dreamers-pos
supabase login
supabase link --project-ref abcdxyz      # "abcdxyz" là phần đầu của Project URL
```

## 8. Kênh đặt phòng (Booking.com, Airbnb)

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

## 9. Hoá đơn điện tử

1. Lúc chưa có hợp đồng: vào **Cài đặt** → **Hoá đơn điện tử**, chọn **Thử nghiệm** để chạy thử toàn bộ quy trình. Số hoá đơn lúc này là giả lập.
2. Khi đã ký với MISA / Viettel / VNPT, nhà cung cấp sẽ cấp tài liệu API, tài khoản và môi trường thử nghiệm.
3. Lưu thông tin bí mật lên máy chủ. Mật khẩu chỉ nằm trên máy chủ, không nằm trên máy bán hàng.

   ```bash
   supabase secrets set EINV_USERNAME=... EINV_PASSWORD=... EINV_BASE_URL=... EINV_SHOP_IDS=<mã quán Dreamers>
   ```

   `EINV_SHOP_IDS` là mã của quán được dùng tài khoản HĐĐT này (xem trong Supabase › Table Editor › bảng `shops`, cột `id`). Quán khác trên hệ thống **không** dùng được mã số thuế của Dreamers.

4. Điền phần `TODO` trong `supabase/functions/einvoice/index.ts` theo tài liệu của nhà cung cấp. App đã chuẩn hoá sẵn dữ liệu: người bán, người mua, từng dòng hàng, thuế, tổng tiền.
5. Triển khai:

   ```bash
   supabase functions deploy einvoice
   ```

6. Trong app, chọn nhà cung cấp, điền mã số thuế, mẫu số và ký hiệu. Thử với môi trường thử nghiệm của nhà cung cấp trước khi bật **Tự xuất HĐĐT**.

## Bảo mật: việc cần làm trước khi mở link cho nhiều người

App đã tự bảo vệ:

- **Tách dữ liệu từng quán ngay trên máy chủ (RLS):** quán khác không đọc, không sửa được dữ liệu của mình, kể cả khi tự gọi API.
- **Mã PIN:** sai 5 lần thì khoá nhập 30 giây, sai tiếp thì khoá lâu dần (tối đa 15 phút). Mỗi lần bị khoá đều ghi vào Nhật ký.
- **Đổi tài khoản ngân hàng nhận chuyển khoản:** bắt buộc nhập PIN **chủ quán** và ghi Nhật ký (số cũ → số mới).
- **Trang tài khoản chủ quán** (đăng xuất, tạo / đổi quán): cần PIN chủ quán hoặc quản lý. Nhân viên không vào được.
- **Mật khẩu chủ quán:** tối thiểu 8 ký tự, có cả chữ và số.
- **Mất điện thoại:** vào trang tài khoản → **Đăng xuất khỏi mọi máy**.
- **Hoá đơn điện tử:** chỉ quán nằm trong `EINV_SHOP_IDS` mới dùng được tài khoản HĐĐT.
- **Trình duyệt:** chỉ chạy mã của chính app và chỉ gửi dữ liệu tới máy chủ Supabase (Content-Security-Policy). Trang khác không nhúng được app để lừa bấm.
- **App không giữ tiền:** mã QR chỉ hiện số tài khoản của quán, tiền khách chuyển thẳng vào ngân hàng của quán. App không có quyền rút hay chuyển tiền.

**Chị cần tự bật / làm (quan trọng nhất là bật 2 lớp bảo mật):**

1. **Bật xác thực 2 lớp (2FA) cho GitHub và Supabase.** Ai vào được tài khoản GitHub thì sửa được code app, ai vào được Supabase thì xem được dữ liệu mọi quán. Đây là điểm cần bảo vệ nhất.
   - GitHub: **Settings** → **Password and authentication** → **Enable two-factor authentication**.
   - Supabase: avatar → **Account preferences** → **Multi-factor authentication**.
2. **Supabase → Authentication → Sign In / Providers → Email:** đặt **Minimum password length = 8** và **Password requirements = Letters and digits**.
3. **Supabase → Authentication → Rate Limits:** giữ mặc định (đã chặn dò mật khẩu và đăng ký hàng loạt). Nếu sau này bị spam đăng ký thì bật **Attack Protection → CAPTCHA**.
4. **Không bao giờ** đưa khoá `service_role` / `secret` hay mật khẩu database cho ai, không dán vào app hay GitHub.
5. Mã token GitHub (`ghp_…`) cũng là chìa khoá. Lỡ lộ thì vào **github.com/settings/tokens** xoá ngay.
6. Mỗi quán nên sao lưu định kỳ: **Cài đặt** → **Dữ liệu** → **Sao lưu**.

## Câu hỏi thường gặp

- **Quán khác có xem được dữ liệu của mình không?**
  - Không. Mỗi dòng dữ liệu gắn với 1 quán, và máy chủ chỉ trả dữ liệu cho tài khoản là thành viên của quán đó. Tài khoản khác gọi API đọc / ghi quán của mình đều bị chặn.
- **Nhân viên có cần tài khoản email không?**
  - Không. Chủ quán đăng nhập tài khoản 1 lần trên mỗi máy của quán. Nhân viên vào ca bằng mã PIN như trước.
- **Chủ quán quên mật khẩu?**
  - Vào Supabase → **Authentication** → **Users**, tìm email → **Send password recovery** (gửi email đặt lại mật khẩu).
- **Đăng xuất trên 1 máy thì sao?**
  - Dữ liệu các quán bị xoá khỏi máy đó, còn trên máy chủ thì vẫn nguyên. Đăng nhập lại là tải về.
  - App không cho đăng xuất khi còn thay đổi chưa gửi lên máy chủ.
- **Xoá 1 quán?**
  - Hiện làm trong Supabase: **Table Editor** → bảng `shops` → xoá dòng của quán. Mọi dữ liệu của quán đó bị xoá theo.

- **Mất mạng thì sao?**
  - App vẫn bán, nhận phòng, đóng ca bình thường. Mọi thay đổi nằm trong hàng đợi và tự gửi khi có mạng.
  - Nếu 2 máy cùng sửa **một** bản ghi lúc mất mạng (VD cùng sửa giá 1 món), bản gửi lên sau sẽ được giữ.
- **Mã hoá đơn có bị trùng giữa 2 máy không?**
  - Bộ đếm luôn lấy số lớn nhất giữa các máy.
  - Chỉ có thể trùng khi 2 máy cùng mất mạng và cùng bán. Khi đó vẫn đủ hoá đơn, chỉ trùng số thứ tự hiển thị.
- **Gói miễn phí của Supabase có đủ không?**
  - Gói miễn phí có 500 MB cơ sở dữ liệu. Một quán café + homestay dùng vài MB mỗi năm, nên đủ cho khá nhiều quán lúc đầu. Khi đông quán hơn thì nâng lên gói Pro.
  - Dự án miễn phí có thể bị **tạm dừng nếu 7 ngày không có hoạt động**. Quán dùng hằng ngày thì không bị.
- **Sao lưu?**
  - **Cài đặt** → **Dữ liệu** → **Xuất bản sao lưu** vẫn dùng được.
  - Supabase cũng tự sao lưu hằng ngày ở các gói trả phí.
