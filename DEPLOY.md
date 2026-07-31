# Deploy AI Remix Video

App này là **nhà máy render video** — cần máy chủ **chạy liên tục** + **ổ đĩa bền** + **ffmpeg**.
Vì vậy KHÔNG deploy lên Vercel/Netlify (serverless, đĩa tạm, function bị timeout).
Dùng **Render** hoặc **Railway** (đã kèm sẵn `Dockerfile`).

Ổ đĩa bền được mount vào `STORAGE_DIR` (mặc định `/app/persistent`); toàn bộ dữ liệu
(`data/*.json`) và media (`uploads/…`) ghi vào đó nên **không mất khi redeploy**.

---

## Cách A — Render (dễ nhất, có sẵn `render.yaml`)

1. Đẩy code lên GitHub (xem mục "Đưa code lên GitHub" bên dưới).
2. Vào [dashboard.render.com](https://dashboard.render.com) → **New +** → **Blueprint**.
3. Chọn repo này. Render đọc `render.yaml`, tạo 1 web service (Docker) + 1 disk 5GB.
4. Ở bước điền biến môi trường, nhập 2 secret:
   - `OPENAI_API_KEY` = key OpenAI của bạn
   - `PEXELS_API_KEY` = key Pexels của bạn
5. **Apply** → Render build image và deploy (~5–10 phút lần đầu).
6. Xong sẽ có URL dạng `https://ai-remix-video.onrender.com`.

> Chọn plan **Starter** trở lên (không dùng Free) — render ffmpeg cần RAM, Free tier dễ bị
> hết bộ nhớ. `PORT` do Render tự cấp, app tự đọc.

---

## Cách B — Railway

1. Đẩy code lên GitHub.
2. Vào [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → chọn repo.
   Railway tự nhận `Dockerfile`.
3. Tab **Variables**, thêm:
   ```
   STORAGE_DIR=/app/persistent
   STORE_DRIVER=fs
   TTS_PROVIDER=openai
   STOCK_PROVIDER=pexels
   NODE_ENV=production
   OPENAI_API_KEY=<key của bạn>
   PEXELS_API_KEY=<key của bạn>
   ```
4. Tab **Settings → Volumes**: tạo volume, **Mount path = `/app/persistent`** (khớp `STORAGE_DIR`).
5. Deploy. Railway cấp domain public ở **Settings → Networking → Generate Domain**.

---

## Đưa code lên GitHub

```bash
cd ~/Documents/ai-remix-video
git add -A
git commit -m "AI Remix Video pipeline"
# tạo repo trống trên github.com trước, rồi:
git remote add origin https://github.com/<user>/ai-remix-video.git
git branch -M main
git push -u origin main
```

`.env.local` (chứa key) đã được `.gitignore` — sẽ KHÔNG lên GitHub. Key chỉ nhập trong
dashboard Render/Railway.

---

## Lưu ý vận hành

- **Voice trên Linux:** server không có lệnh `say` của macOS, nên voice dùng **OpenAI TTS**
  (cần `OPENAI_API_KEY`). Thiếu key → voice sẽ im lặng.
- **Chi phí OpenAI:** ~vài cent mỗi video (Whisper + GPT + TTS). Theo dõi ở dashboard OpenAI.
- **Batch lớn:** worker xử lý tuần tự trong tiến trình; nhiều video sẽ lâu. Máy chủ nhiều RAM/CPU
  sẽ nhanh hơn.
- **Nâng cấp sau (không bắt buộc):** chuyển `STORE_DRIVER=supabase` + chạy `supabase/schema.sql`
  để dùng Postgres thay cho file JSON khi dữ liệu lớn.
