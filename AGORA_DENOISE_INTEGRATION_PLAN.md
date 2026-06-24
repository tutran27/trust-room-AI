# Agora Denoise Integration Plan

## 1. Mục tiêu

Tích hợp giảm noise cho meeting/audio room trong repo bằng phương án mạnh nhất có thể:

1. Dùng Web SDK local mà bạn tải về từ Agora nếu muốn đưa folder vào repo.
2. Bật audio preprocessing built-in: `AEC`, `ANS`, `AGC`.
3. Nếu có AI Noise Suppression extension assets, bật thêm `agora-extension-ai-denoiser` để xử lý noise bằng AI.
4. Có fallback an toàn khi browser không hỗ trợ, thiếu Wasm assets, hoặc CPU quá tải.

## 2. Nhận diện folder bạn đã tải

Folder trong ảnh:

```txt
Agora_Web_SDK_FULL/
  AgoraRTC_N-4.16.1.js
  index.css
  index.html
  index.js
  vendor/
```

Đây là Agora Web SDK full/sample package, không chắc đã bao gồm AI denoiser extension.

| File/folder | Dùng để làm gì |
|---|---|
| `AgoraRTC_N-4.16.1.js` | SDK chính để join/publish audio/video trên browser. |
| `index.html`, `index.js`, `index.css` | Demo/sample, không nên import vào app production. |
| `vendor/` | Dependency của sample hoặc SDK. Cần kiểm tra có chứa denoiser Wasm hay không. |

Web SDK `4.16.1` đủ mới để dùng AI denoiser extension, vì AI denoiser web yêu cầu Agora Web SDK khoảng `4.15.x+`.

## 3. Kiểm tra folder có AI denoiser chưa

Trước khi tích hợp, kiểm tra trong folder tải về:

```bash
find Agora_Web_SDK_FULL -iname "*denoise*" -o -iname "*noise*" -o -iname "*.wasm"
find Agora_Web_SDK_FULL -iname "*AIDenoiser*" -o -iname "*processor*"
```

Nếu không thấy các file kiểu:

```txt
agora-extension-ai-denoiser
external/
*.wasm
*_simd.wasm
AIDenoiserExtension
```

thì folder hiện tại chỉ dùng được cho Agora RTC + built-in `ANS`, chưa phải AI Noise Suppression extension mạnh nhất.

## 4. Chiến lược tích hợp khuyến nghị

### Option A - Khuyến nghị cho repo Next.js hiện tại

Dùng npm packages:

```bash
pnpm add agora-rtc-sdk-ng agora-extension-ai-denoiser
```

Ưu điểm:

1. TypeScript import sạch.
2. Ít lỗi global script.
3. Dễ build với Next.js.
4. Dễ update version.

Vẫn cần copy Wasm assets của denoiser vào `public`.

### Option B - Dùng folder tải về local

Đưa folder vào:

```txt
apps/web/public/vendor/agora/web-sdk-4.16.1/
  AgoraRTC_N-4.16.1.js
  vendor/
```

Sau đó load SDK bằng script trong browser:

```ts
await loadScript('/vendor/agora/web-sdk-4.16.1/AgoraRTC_N-4.16.1.js');
const AgoraRTC = window.AgoraRTC;
```

Option này phù hợp demo nhanh, nhưng không đẹp bằng npm trong Next.js.

## 5. Cấu trúc file nên thêm vào repo

Nếu dùng npm:

```txt
apps/web/
  public/
    vendor/
      agora/
        denoiser/
          external/
            ...wasm/js assets from agora-extension-ai-denoiser...
  lib/
    agora/
      noise-suppression.ts
      audio-track.ts
```

Nếu dùng folder tải về local:

```txt
apps/web/
  public/
    vendor/
      agora/
        web-sdk-4.16.1/
          AgoraRTC_N-4.16.1.js
          vendor/
        denoiser/
          external/
            ...AI denoiser wasm assets nếu có...
  lib/
    agora/
      load-agora-sdk.ts
      noise-suppression.ts
      audio-track.ts
```

Không nên import `index.js` của sample vào app. Chỉ dùng SDK file và denoiser assets.

## 6. Method giảm noise mạnh nhất

Stack mạnh nhất nên bật theo thứ tự:

1. Browser/Agora built-in audio constraints:
   - `AEC: true`
   - `ANS: true`
   - `AGC: true`
2. Agora AI Denoiser extension:
   - `AIDenoiserExtension`
   - `createProcessor()`
   - `audioTrack.pipe(processor).pipe(audioTrack.processorDestination)`
   - `processor.enable()`
3. Overload fallback:
   - Nếu CPU quá tải, giảm mode hoặc disable AI denoiser.
   - Vẫn giữ `AEC/ANS/AGC`.

Luồng xử lý:

```txt
Microphone
  -> AEC/ANS/AGC built-in
  -> Agora AI Denoiser processor
  -> Agora local audio track
  -> publish to channel
```

## 7. Implementation plan chi tiết

### Phase 1 - Đưa file vào repo

Copy folder Web SDK:

```txt
Downloads/Agora_Web_SDK_FULL
-> apps/web/public/vendor/agora/web-sdk-4.16.1
```

Nếu có denoiser folder/package:

```txt
node_modules/agora-extension-ai-denoiser/external
-> apps/web/public/vendor/agora/denoiser/external
```

Nếu bạn chỉ có folder trong ảnh, cần tải thêm extension:

```bash
pnpm add agora-extension-ai-denoiser
```

rồi copy:

```bash
cp -R node_modules/agora-extension-ai-denoiser/external \
  apps/web/public/vendor/agora/denoiser/external
```

### Phase 2 - Helper tạo audio track mạnh nhất

Tạo file:

```txt
apps/web/lib/agora/audio-track.ts
```

Nội dung logic:

```ts
import AgoraRTC, { type ILocalAudioTrack } from 'agora-rtc-sdk-ng';
import { enableAgoraAIDenoiser } from './noise-suppression';

export async function createBestLocalAudioTrack() {
  const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
    AEC: true,
    ANS: true,
    AGC: true,
    encoderConfig: 'music_standard',
  });

  const denoiser = await enableAgoraAIDenoiser(audioTrack);

  return {
    audioTrack,
    denoiser,
  };
}
```

Ghi chú:

1. Nếu ưu tiên speech/meeting, có thể thử `encoderConfig: 'speech_standard'` nếu SDK version support.
2. Nếu cần chất lượng giọng tự nhiên hơn, dùng `music_standard`.
3. Với STT, ưu tiên tiếng nói rõ hơn nhạc nền, nên test thực tế giữa 2 config.

### Phase 3 - Helper AI denoiser

Tạo file:

```txt
apps/web/lib/agora/noise-suppression.ts
```

Nội dung logic:

```ts
import AgoraRTC, { type ILocalAudioTrack } from 'agora-rtc-sdk-ng';
import { AIDenoiserExtension } from 'agora-extension-ai-denoiser';

let extension: AIDenoiserExtension | null = null;
let registered = false;

export function registerAgoraAIDenoiser() {
  if (typeof window === 'undefined') return null;
  if (extension) return extension;

  extension = new AIDenoiserExtension({
    assetsPath: '/vendor/agora/denoiser/external',
  });

  if (!extension.checkCompatibility()) {
    console.warn('[Agora] AI denoiser is not supported in this browser.');
    return null;
  }

  extension.onloaderror = (error) => {
    console.error('[Agora] AI denoiser asset load failed:', error);
  };

  if (!registered) {
    AgoraRTC.registerExtensions([extension]);
    registered = true;
  }

  return extension;
}

export async function enableAgoraAIDenoiser(audioTrack: ILocalAudioTrack) {
  const denoiser = registerAgoraAIDenoiser();
  if (!denoiser) return null;

  const processor = denoiser.createProcessor();

  processor.on('overload', async () => {
    console.warn('[Agora] AI denoiser overloaded, disabling fallback to built-in ANS.');
    await processor.disable();
  });

  audioTrack.pipe(processor).pipe(audioTrack.processorDestination);
  await processor.enable();

  return processor;
}
```

### Phase 4 - Gắn vào meeting component

Tìm nơi hiện tạo microphone track, khả năng nằm ở:

```txt
apps/web/components/meeting-rtc-panel.tsx
apps/web/lib/agora-stt.ts
```

Thay đoạn:

```ts
const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
```

bằng:

```ts
const { audioTrack, denoiser } = await createBestLocalAudioTrack();
```

Khi rời room:

```ts
await denoiser?.disable();
audioTrack.stop();
audioTrack.close();
```

### Phase 5 - Thêm toggle UI

Trong meeting panel nên có toggle:

```txt
Noise suppression: Off / Basic / AI Strong
```

Mapping:

| Mode | Hành vi |
---|---|
| `Off` | Không bật AI denoiser, có thể tắt cả `ANS` nếu cần debug raw mic. |
| `Basic` | Chỉ dùng `AEC/ANS/AGC`. |
| `AI Strong` | `AEC/ANS/AGC` + AI Denoiser extension. |

Default nên là `AI Strong`, nếu fail thì tự fallback về `Basic`.

## 8. Nếu bắt buộc dùng file local `AgoraRTC_N-4.16.1.js`

Tạo:

```txt
apps/web/lib/agora/load-agora-sdk.ts
```

```ts
export async function loadAgoraSdkFromPublic() {
  if (typeof window === 'undefined') return null;
  if ((window as any).AgoraRTC) return (window as any).AgoraRTC;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/agora/web-sdk-4.16.1/AgoraRTC_N-4.16.1.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Agora Web SDK'));
    document.head.appendChild(script);
  });

  return (window as any).AgoraRTC;
}
```

Sau đó:

```ts
const AgoraRTC = await loadAgoraSdkFromPublic();
const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
  AEC: true,
  ANS: true,
  AGC: true,
});
```

Nhưng nếu dùng TypeScript/Next.js production, vẫn khuyến nghị npm import.

## 9. CSP và static asset lưu ý

AI denoiser cần load Wasm/JS assets trong browser.

Nếu app có CSP, thêm tối thiểu:

```txt
script-src 'self' 'wasm-unsafe-eval' blob:;
worker-src 'self' blob:;
connect-src 'self' https:;
```

Nếu deploy qua CDN khác domain:

1. Bật CORS cho `.wasm`, `.js`.
2. Không load HTTP asset trong HTTPS site.
3. Kiểm tra MIME type `.wasm` là `application/wasm`.

## 10. Test plan

### 10.1. Test build

```bash
pnpm --filter @trustroom/web typecheck
pnpm --filter @trustroom/web build
```

### 10.2. Test runtime

1. Mở meeting room.
2. Join bằng 2 tab hoặc 2 máy.
3. Bật mic với mode `Basic`.
4. Gõ keyboard/quạt/tạp âm nền.
5. Chuyển sang `AI Strong`.
6. Người nghe bên kia phải thấy noise giảm rõ.
7. Console không có lỗi load Wasm.
8. Network tab phải load được file trong `/vendor/agora/denoiser/external`.

### 10.3. Test fallback

Đổi sai `assetsPath` tạm thời:

```ts
assetsPath: '/wrong-path'
```

Expected:

1. App không crash.
2. Console báo asset load failed.
3. Meeting vẫn publish audio với `AEC/ANS/AGC`.

### 10.4. Test overload

Trên máy yếu hoặc mở nhiều tab:

1. Nếu processor emit `overload`, app disable AI denoiser.
2. Audio vẫn chạy.
3. UI chuyển từ `AI Strong` sang `Basic fallback`.

## 11. Acceptance criteria

| Tiêu chí | Pass khi |
|---|---|
| Local SDK folder | File `AgoraRTC_N-4.16.1.js` nằm trong `apps/web/public/vendor/agora/web-sdk-4.16.1`. |
| Basic noise suppression | Mic track được tạo với `AEC: true`, `ANS: true`, `AGC: true`. |
| AI denoiser assets | Denoiser Wasm assets load thành công từ `/vendor/agora/denoiser/external`. |
| AI strong mode | `audioTrack.pipe(processor).pipe(audioTrack.processorDestination)` chạy trước publish. |
| Fallback | Nếu AI denoiser fail, user vẫn nói/nghe được bằng built-in `ANS`. |
| Cleanup | Rời room thì disable processor, stop/close audio track, không leak mic. |
| Build | `pnpm --filter @trustroom/web typecheck` pass. |

## 12. Kết luận

Folder bạn tải dùng tốt để đưa Web SDK local vào repo, nhưng để đạt giảm noise mạnh nhất cần thêm AI denoiser extension assets. Cấu hình mạnh nhất là:

```txt
AEC + ANS + AGC
  plus
Agora AI Denoiser Extension
  plus
overload fallback
```

Nếu chỉ dùng folder trong ảnh, mức mạnh nhất hiện có là `AEC/ANS/AGC`. Nếu bổ sung `agora-extension-ai-denoiser` và copy `external` assets vào `public`, mới đạt AI Noise Suppression mạnh nhất cho web.

