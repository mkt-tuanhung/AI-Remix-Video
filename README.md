# AI Remix Video Pipeline

Hệ thống AI tái sản xuất nội dung video đa nền tảng — biến một video nguồn thành nguyên liệu
cho dây chuyền sản xuất video ngắn mới (TikTok / Reels / Shorts). Xây theo đặc tả
`Dac_ta_he_thong_AI_Remix_Video.md`.

> **Đây là "nền móng chạy được" (Giai đoạn 1).** Toàn bộ khung dự án, job orchestrator,
> data layer, provider abstraction và UI đã hoạt động. Dây chuyền phân tích chạy thật:
> **Tiếp nhận → Transcript → Phân tích hình ảnh → Hiểu nội dung**. Các bước sản xuất
> (kịch bản → storyboard → voice → nhạc → phụ đề → render → biến thể) đã có sẵn provider
> và schema, sẽ cắm dần vào registry ở giai đoạn sau.

## Chạy nhanh (không cần cấu hình gì)

```bash
npm install
npm run dev
# mở http://localhost:4310
```

Không có API key nào là bắt buộc. Thiếu key nào thì phần đó **tự chạy mock** (dữ liệu giả
tất định) để toàn dây chuyền vẫn end-to-end. Xem trạng thái thật/mock ở góc trái sidebar.

## Bật provider thật

Sao chép `.env.example` → `.env.local` rồi điền key cần dùng:

| Biến | Bật gì | Thiếu thì |
|---|---|---|
| `OPENAI_API_KEY` | Transcript (Whisper) + phân tích hình ảnh (gpt-4o) + hiểu nội dung | mock |
| `TTS_PROVIDER` + key | Sinh voice AI (OpenAI/ElevenLabs) | mock (chỉ ước lượng thời lượng) |
| `STOCK_PROVIDER` + key | B-roll/ảnh có giấy phép (Pexels/Pixabay) | placeholder |
| `ffmpeg`/`ffprobe` trong PATH | Đọc metadata thật, tách audio & keyframe | dùng giá trị giả định |

> **Gợi ý:** cài `ffmpeg` (macOS: `brew install ffmpeg`) để có metadata, keyframe và audio thật
> cho Whisper. Không có ffmpeg, ingest/vision vẫn chạy nhưng ở chế độ mock.

## Lưu trữ

- Mặc định `STORE_DRIVER=fs` → dữ liệu ghi ra `.data/*.json`, chạy ngay.
- Lên production: đặt `STORE_DRIVER=supabase`, chạy `supabase/schema.sql`, điền
  `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

## Kiến trúc

```
src/lib/
  types.ts            # kiểu dữ liệu (đặc tả mục 16)
  config.ts           # env + phát hiện năng lực provider
  store/              # interface store: fs (mặc định) + supabase
  providers/          # openai, transcription, vision, llm, tts, stock (đều có mock)
  media/ffmpeg.ts     # ffprobe/ffmpeg, fallback khi thiếu binary
  orchestrator/       # queue + worker drain (job idempotent, retry, depends_on)
  pipeline/           # context + registry + các bước (steps/*)
  services.ts         # nghiệp vụ: tạo dự án, phân tích, dashboard
src/app/
  page.tsx            # dashboard
  projects/new        # tạo dự án + tải video
  projects/[id]       # màn hình phân tích (poll tiến độ, Gate 1 duyệt transcript)
  api/                # REST theo đặc tả mục 17
```

### Dây chuyền job (giai đoạn 1)

`INGEST → TRANSCRIBE → VISION_ANALYSIS → CONTENT_ANALYSIS`

Mỗi bước là một job độc lập, có `depends_on`, retry, tiến độ riêng — đúng mô hình hàng đợi
bất đồng bộ ở đặc tả mục 12. Worker rút cạn hàng đợi trong process; UI poll
`/api/worker/tick` để đảm bảo tiến độ.

## Lộ trình tiếp theo (đặc tả mục 20)

- **GĐ2:** chiến lược nội dung → 3+ hook → viết lại kịch bản (vòng lặp đo thời lượng bằng voice) →
  storyboard → tìm/chấm điểm tài nguyên → voice → music ducking → phụ đề → render preview →
  quality check → render cuối → nhiều phiên bản.
- **GĐ3:** batch, concurrency, provider dự phòng, theo dõi chi phí.
- **GĐ4:** kết nối nền tảng, lập lịch đăng, học từ hiệu suất.
