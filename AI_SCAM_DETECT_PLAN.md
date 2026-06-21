# Kế hoạch xây dựng AI nhận diện mô hình scam realtime

## 1. Mục tiêu

Xây dựng một module AI có khả năng nhận diện sớm các mô hình lừa đảo trong giao dịch P2P, đặc biệt trong môi trường có **Deal Room**, **escrow**, hội thoại realtime, bằng chứng thanh toán/giao hàng và lịch sử ví on-chain.

Module không chỉ phát hiện từ khóa nguy hiểm, mà phải phân tích **toàn bộ bối cảnh giao dịch** gồm:

- Nội dung hội thoại giữa buyer và seller.
- Thứ tự hành động của hai bên.
- Trạng thái deal và escrow.
- Điều khoản đã xác nhận.
- Lịch sử ví và hành vi on-chain.
- Bằng chứng thanh toán hoặc giao hàng.
- Hành vi bất thường trong Deal Room.

Mục tiêu cuối cùng là cảnh báo người dùng trước khi họ:

- Release tiền sai thời điểm.
- Bị dụ giao dịch ngoài nền tảng.
- Gửi tiền vào ví ngoài escrow.
- Tin vào fake proof of payment.
- Chia sẻ thông tin nhạy cảm.
- Ký hoặc xác nhận điều khoản bất lợi.

---

## 2. Nguyên tắc thiết kế

### 2.1. Không kết luận scam chỉ từ một câu nói

Một câu riêng lẻ có thể chưa đủ để kết luận gian lận. Hệ thống nên dùng mô hình **risk signal aggregation**, tức là gom nhiều tín hiệu rủi ro thành một điểm tổng.

Ví dụ:

- Câu “Qua Telegram nói chuyện cho tiện” có thể là rủi ro trung bình.
- Nếu sau đó đối phương nói “Không cần escrow” và “Release trước đi”, rủi ro phải tăng mạnh.
- Nếu ví đối phương mới tạo, chưa có lịch sử deal, risk score tiếp tục tăng.
- Nếu đối phương gửi ảnh bill nhưng không có xác minh on-chain hoặc xác nhận thanh toán đáng tin, hệ thống nên chặn release hoặc yêu cầu xác minh thêm.

### 2.2. AI phải có khả năng giải thích

Mỗi cảnh báo cần trả về:

- Intent rủi ro được phát hiện.
- Risk level.
- Điểm rủi ro.
- Lý do cụ thể.
- Bằng chứng liên quan: câu chat, timestamp, speaker, deal state.
- Hành động đề xuất.

### 2.3. Ưu tiên bảo vệ tiền trong escrow

Các hành vi có thể dẫn đến mất tiền trực tiếp phải được xử lý nghiêm hơn, ví dụ:

- Yêu cầu release trước.
- Gửi ví ngoài escrow.
- Fake proof of payment.
- Yêu cầu seed phrase, private key hoặc OTP.
- Thay đổi điều khoản sau khi đã deposit.

---

## 3. Các mô hình scam cần nhận diện

## 3.1. Dụ giao dịch ra ngoài nền tảng

### Mô tả

Đối phương cố chuyển hội thoại hoặc thanh toán ra khỏi Deal Room để tránh AI giám sát, tránh escrow và tránh lưu bằng chứng.

### Ví dụ

- “Qua Telegram nói chuyện cho tiện.”
- “Chuyển qua Zalo đi.”
- “Không cần escrow đâu, mất phí.”
- “Bạn gửi thẳng vào ví này.”
- “Tôi không thích bị AI nghe.”

### Signal cần bắt

- Từ khóa: `telegram`, `zalo`, `whatsapp`, `discord`, `private chat`, `off-platform`, `no escrow`, `direct transfer`.
- Intent: `move_off_platform`.
- Sequence: xuất hiện sau khi buyer đã deposit escrow thì tăng risk mạnh.

### Hành động hệ thống

- Cảnh báo Medium hoặc High.
- Ghi event vào Evidence Vault.
- Nhắc người dùng không rời khỏi Deal Room.
- Nếu lặp lại nhiều lần, yêu cầu xác nhận cảnh báo hoặc tạm khóa release.

---

## 3.2. Yêu cầu release tiền trước khi hoàn tất nghĩa vụ

### Mô tả

Một bên yêu cầu bên kia release escrow trước khi giao hàng, chuyển tài sản hoặc có bằng chứng hoàn tất hợp lệ.

### Ví dụ

- “Bạn release trước đi rồi tôi gửi file.”
- “Bấm hoàn tất trước, tôi chuyển NFT sau.”
- “Tôi uy tín mà, cứ release đi.”
- “Tôi gửi ảnh bill rồi, release cho tôi đi.”

### Signal cần bắt

- Từ khóa: `release trước`, `confirm first`, `complete first`, `send later`, `trust me`, `urgent release`.
- Intent: `early_release_request`.
- Rule theo trạng thái: nếu deal chưa ở trạng thái `delivery_verified` hoặc `ready_to_release`, mọi yêu cầu release đều là rủi ro cao.
- Temporal rule: nếu yêu cầu release xuất hiện trước `submit_delivery_proof`, gắn cờ High Risk.

### Hành động hệ thống

- Popup High Risk.
- Tạm disable nút Release hoặc yêu cầu xác nhận lại.
- Hiển thị nguyên tắc: “Escrow chỉ release sau khi delivery proof được xác minh.”
- Ghi transcript, speaker và timestamp vào Evidence Vault.

---

## 3.3. Fake proof of payment

### Mô tả

Đối phương gửi ảnh bill, email, SMS hoặc screenshot giả để chứng minh đã thanh toán, sau đó thúc ép release tài sản.

### Ví dụ

- “Tôi chuyển rồi, xem ảnh bill đi.”
- “Ngân hàng báo pending nhưng tiền chắc chắn về.”
- “Email xác nhận đây rồi, release đi.”
- “Tôi gửi ảnh biên lai rồi, bạn còn chờ gì nữa?”

### Signal cần bắt

- Intent: `fake_payment_pressure`, `screenshot_as_payment_proof`.
- OCR ảnh bill: số tiền, tên người gửi, thời gian, mã giao dịch.
- Consistency check: so sánh amount, timestamp, sender, token/payment method với deal.
- Với crypto: chỉ chấp nhận transaction hash on-chain hợp lệ.
- Với fiat: screenshot không được coi là bằng chứng cuối cùng.

### Hành động hệ thống

- Cảnh báo: “Không release chỉ dựa trên screenshot.”
- Yêu cầu transaction hash hoặc xác nhận tiền đã vào tài khoản thật.
- Gắn flag `unverified_payment_proof`.
- Nếu người gửi proof thúc ép release liên tục, tăng risk score.

---

## 3.4. Áp lực thời gian và thao túng tâm lý

### Mô tả

Scammer tạo cảm giác khẩn cấp để người dùng quyết định nhanh, bỏ qua xác minh.

### Ví dụ

- “Chỉ còn 5 phút thôi.”
- “Không làm ngay thì mất deal.”
- “Nếu bạn không release ngay, tôi report bạn.”
- “Nhanh lên, tôi không có thời gian.”

### Signal cần bắt

- Từ khóa: `urgent`, `now`, `hurry`, `limited time`, `last chance`, `gấp`, `nhanh lên`, `chỉ còn`.
- Classifier phát hiện ép buộc, đe dọa, thao túng.
- Nếu đi kèm yêu cầu release hoặc ví ngoài escrow, tăng risk mạnh.

### Hành động hệ thống

- Cảnh báo Medium hoặc High.
- Gợi ý cooldown: “Hãy kiểm tra lại điều kiện giao dịch trước khi tiếp tục.”
- Với deal lớn, yêu cầu thêm bước xác nhận.

---

## 3.5. Yêu cầu thông tin nhạy cảm

### Mô tả

Đối phương yêu cầu thông tin có thể dẫn đến chiếm đoạt ví, tài khoản hoặc danh tính.

### Ví dụ

- “Gửi seed phrase để tôi kiểm tra ví.”
- “Cho tôi private key.”
- “Gửi OTP cho tôi xác minh.”
- “Cài app này để kết nối ví.”
- “Ký thử transaction này không mất phí đâu.”

### Signal cần bắt

- Từ khóa: `seed phrase`, `private key`, `recovery phrase`, `OTP`, `password`, `remote access`, `AnyDesk`, `TeamViewer`.
- Intent: `credential_request`, `phishing_attempt`, `malicious_signature_request`.
- URL detection: phát hiện link lạ, domain giả mạo, URL shortener.
- Transaction simulation: nếu người dùng được yêu cầu ký transaction, backend mô phỏng transaction trước khi ký.

### Hành động hệ thống

- Cảnh báo Critical.
- Chặn gửi seed phrase/private key trong chat nếu là text.
- Làm mờ link phishing và cảnh báo.
- Yêu cầu human review nếu transaction bất thường.

---

## 3.6. Giả mạo support, admin hoặc đại diện dự án

### Mô tả

Scammer tự nhận là nhân viên nền tảng, trọng tài, admin cộng đồng hoặc đại diện dự án để tạo lòng tin.

### Ví dụ

- “Tôi là support của nền tảng.”
- “Admin bảo bạn release đi.”
- “Tôi có quyền xử lý dispute.”
- “Hệ thống đang bảo trì, chuyển ngoài giúp tôi.”

### Signal cần bắt

- NER phát hiện tên nền tảng, admin, support, dự án.
- Role verification: kiểm tra account/wallet người nói có role chính thức hay không.
- Intent: `impersonation_claim`.
- Nếu user thường tự nhận support/admin, cảnh báo ngay.

### Hành động hệ thống

- Hiển thị: “Người này không phải verified support/admin.”
- Gắn badge role chính thức cho tài khoản thật.
- Chặn username/label gây nhầm lẫn như “TrustRoom Support”.

---

## 3.7. Thay đổi điều khoản sau khi đã deposit

### Mô tả

Sau khi buyer đã deposit vào escrow, đối phương cố thay đổi giá, deadline, điều kiện release hoặc loại tài sản.

### Ví dụ

- “Giờ giá phải là 120 USDC.”
- “Muốn bản full thì trả thêm.”
- “Bạn phải release một phần trước.”
- “Deadline phải lùi thêm 7 ngày.”

### Signal cần bắt

- Deal term extraction: trích xuất điều khoản mới từ hội thoại.
- Term diffing: so sánh với điều khoản đã ký.
- Semantic comparison: phát hiện thay đổi về nghĩa, không chỉ câu chữ.
- State rule: nếu deal đã `terms_confirmed`, mọi thay đổi phải yêu cầu hai bên ký lại.

### Hành động hệ thống

- Cảnh báo: “Điều khoản mới khác với điều khoản đã xác nhận.”
- Yêu cầu tạo amendment và hai bên ký lại.
- Nếu một bên không đồng ý, giữ nguyên điều khoản cũ.

---

## 3.8. Không chịu xác nhận điều khoản rõ ràng

### Mô tả

Một bên cố nói mập mờ, né tránh việc xác nhận điều khoản cụ thể hoặc chỉ muốn thỏa thuận bằng lời.

### Ví dụ

- “Cứ tin tôi đi, không cần ghi rõ đâu.”
- “Cứ deposit đi rồi bàn tiếp.”
- “Đừng ghi cái này vào điều khoản.”
- “Tôi nói vậy thôi, không cần xác nhận.”

### Signal cần bắt

- Missing terms detector: kiểm tra các field bắt buộc như price, asset, deadline, delivery condition, release condition.
- LLM ambiguity detection: phát hiện câu mơ hồ hoặc né tránh xác nhận.
- Confirmation gate: không cho deposit/release nếu thiếu điều khoản quan trọng.

### Hành động hệ thống

- AI yêu cầu làm rõ tài sản, giá, deadline và điều kiện release.
- Không chuyển deal sang `terms_confirmed` nếu thiếu dữ liệu.

---

## 3.9. Split transaction hoặc né escrow

### Mô tả

Scammer đề nghị chia giao dịch thành nhiều phần nhỏ hoặc chuyển một phần ngoài escrow.

### Ví dụ

- “Bạn gửi trước 30% ngoài escrow.”
- “Chia ra làm 3 ví cho dễ.”
- “Escrow chỉ để tượng trưng thôi.”
- “Cọc trực tiếp cho tôi trước.”

### Signal cần bắt

- Intent: `partial_off_escrow_payment`, `split_payment`, `direct_deposit_request`.
- Amount consistency check: tổng số tiền nhắc trong hội thoại so với amount trong deal.
- Wallet address detection: phát hiện địa chỉ ví khác escrow address.

### Hành động hệ thống

- Cảnh báo High Risk.
- Làm nổi bật địa chỉ ví lạ.
- Nhắc rằng chỉ escrow address chính thức mới được bảo vệ.
- Ghi địa chỉ ví ngoài escrow vào Evidence Vault.

---

## 3.10. Địa chỉ ví bị thay thế hoặc ví lạ xuất hiện

### Mô tả

Đối phương gửi địa chỉ ví khác với ví đã đăng ký trong Deal Room hoặc escrow contract.

### Ví dụ

- “Gửi vào ví này thay vì ví trên hệ thống.”
- “Ví kia lỗi rồi, gửi ví mới này.”
- “Escrow bị lỗi, chuyển vào address này.”

### Signal cần bắt

- Wallet address parser: tự động phát hiện Solana address trong transcript.
- Address comparison: so sánh address được nhắc với buyer wallet, seller wallet và escrow address.
- Risk rule: nếu address không thuộc deal metadata, đánh dấu `suspicious_external_address`.
- On-chain lookup: kiểm tra ví mới có lịch sử rủi ro hay không.

### Hành động hệ thống

- Cảnh báo Critical nếu address không khớp escrow.
- Không cho copy address lạ nếu chưa xác nhận.
- Yêu cầu hai bên ký lại nếu thật sự muốn đổi ví.

---

## 3.11. Giao hàng không có bằng chứng xác minh

### Mô tả

Seller tuyên bố đã giao tài sản/dịch vụ nhưng không cung cấp bằng chứng đủ tin cậy.

### Ví dụ

- “Tôi gửi rồi mà.”
- “File ở link này, đừng hỏi thêm.”
- “NFT đang pending, release trước đi.”
- “Tôi đã làm xong nhưng chưa upload được.”

### Signal cần bắt

- Delivery proof validator: kiểm tra đã có file, tx hash hoặc bằng chứng giao hàng chưa.
- On-chain verification: với NFT/token, kiểm tra owner mới, transaction hash, token mint.
- File integrity check: tạo SHA-256 hash cho file delivery.
- Link scanner: kiểm tra link có đáng ngờ không.
- Deal condition matching: so sánh proof với điều kiện release.

### Hành động hệ thống

- Không cho release nếu chưa có delivery proof hợp lệ, trừ khi buyer override có xác nhận.
- Gắn trạng thái `delivery_unverified`.
- Yêu cầu seller cung cấp bằng chứng phù hợp.

---

## 3.12. Hành vi ví bất thường

### Mô tả

Ví có dấu hiệu rủi ro từ dữ liệu on-chain hoặc lịch sử giao dịch trong hệ thống.

### Signal cần bắt

- Ví mới tạo.
- Ít giao dịch.
- Không có lịch sử deal.
- Nhiều dispute hoặc refund.
- Nhận tiền rồi chuyển đi ngay.
- Nhiều ví nhỏ gom tiền về một ví trung tâm.
- Liên quan đến ví từng bị report.
- Volume bất thường so với tuổi ví.

### Feature đề xuất

```json
{
  "wallet_age_days": 3,
  "tx_count": 5,
  "total_volume_usd": 120,
  "completed_deals": 0,
  "dispute_count": 0,
  "refund_count": 0,
  "linked_reported_wallets": 1,
  "inflow_outflow_velocity": "high"
}
```

### Hành động hệ thống

- Gắn risk level cho wallet.
- Hiển thị lý do rõ ràng.
- Với High Risk wallet, yêu cầu strict escrow mode hoặc stake thêm.
- Với deal lớn, đề xuất human review.

---

## 4. Kiến trúc AI/ML đề xuất

## 4.1. Pipeline realtime

```text
Agora Audio
→ Speech-to-Text
→ Transcript Event
→ Text Normalization
→ Rule Detector
→ LLM Intent Classifier
→ Scam Playbook Similarity Search
→ Deal State Checker
→ Wallet Risk Engine
→ Evidence Verification Engine
→ Risk Aggregator
→ Frontend Warning Popup
→ Evidence Vault
```

## 4.2. Input của module

```json
{
  "deal_id": "deal_123",
  "speaker_id": "seller_456",
  "speaker_role": "seller",
  "timestamp": "2026-06-21T10:05:22Z",
  "message": "Bạn release trước đi rồi tôi gửi file.",
  "deal_state": "funded",
  "escrow_state": "locked",
  "confirmed_terms": {
    "amount": "100 USDC",
    "asset": "design_file.zip",
    "delivery_condition": "file_uploaded_and_verified",
    "release_condition": "buyer_confirms_delivery"
  },
  "wallet_profiles": {
    "buyer_wallet": "...",
    "seller_wallet": "...",
    "escrow_wallet": "..."
  },
  "uploaded_evidence": [],
  "onchain_data": {}
}
```

## 4.3. Output của module

```json
{
  "deal_id": "deal_123",
  "risk_events": [
    {
      "intent": "early_release_request",
      "risk_level": "high",
      "score": 40,
      "confidence": 0.91,
      "reason": "Seller asks buyer to release escrow before delivery proof is submitted.",
      "evidence": {
        "speaker": "seller",
        "message": "Bạn release trước đi rồi tôi gửi file.",
        "timestamp": "2026-06-21T10:05:22Z"
      }
    }
  ],
  "final_risk_score": 65,
  "final_risk_level": "high",
  "suggested_action": "Do not release funds until delivery proof is verified.",
  "ui_action": "show_high_risk_popup_and_require_confirmation"
}
```

---

## 5. Các lớp phát hiện scam

## 5.1. Rule-based keyword detection

Dùng để phát hiện nhanh các pattern rõ ràng, dễ giải thích và phù hợp MVP.

Ví dụ rule:

```json
{
  "rule_id": "EARLY_RELEASE_001",
  "patterns": [
    "release trước",
    "xác nhận trước",
    "bấm hoàn tất trước",
    "send later",
    "release first",
    "confirm first"
  ],
  "intent": "early_release_request",
  "risk_level": "high",
  "score": 40
}
```

### Ưu điểm

- Dễ triển khai.
- Nhanh.
- Dễ debug.
- Dễ demo trong hackathon.

### Nhược điểm

- Dễ bỏ sót câu nói vòng vo.
- Dễ false positive nếu không xét bối cảnh.

---

## 5.2. LLM intent classification

Dùng để phân loại ý định thật sự của câu nói, kể cả khi không có keyword rõ ràng.

### Intent cần phân loại

- `move_off_platform`
- `early_release_request`
- `fake_payment_pressure`
- `credential_request`
- `phishing_link`
- `impersonation`
- `time_pressure`
- `term_change`
- `external_wallet_request`
- `ambiguous_terms`
- `delivery_unverified`

### Prompt nội bộ đề xuất

```text
You are a fraud-risk classifier for P2P escrow deals.
Classify the speaker message into one or more risk intents.
Consider the deal state, escrow status, confirmed terms, previous conversation, wallet metadata, and uploaded evidence.
Return JSON only with: intents, risk_level, confidence, score_delta, reason, evidence_refs, recommended_action.
Do not invent facts. If evidence is insufficient, return uncertainty.
```

### JSON schema output

```json
{
  "intents": [
    {
      "intent": "early_release_request",
      "risk_level": "high",
      "confidence": 0.91,
      "score_delta": 40,
      "reason": "Seller asks buyer to release escrow before delivery proof is submitted.",
      "evidence_refs": ["msg_10_05_22"],
      "recommended_action": "Block release until delivery proof is verified."
    }
  ]
}
```

### Guardrails

- Bắt buộc JSON schema.
- Không cho LLM tự quyết định release/block trực tiếp; LLM chỉ tạo signal.
- Rule engine và risk aggregator mới là lớp quyết định hành động hệ thống.
- Lưu confidence và reason để audit.
- Khi confidence thấp, yêu cầu thêm signal thay vì cảnh báo quá mạnh.

---

## 5.3. Semantic similarity với scam playbook

Dùng embedding để so sánh câu nói mới với thư viện các mẫu scam đã biết.

### Cách làm

1. Xây dựng scam playbook gồm nhiều ví dụ theo từng intent.
2. Embed từng mẫu scam.
3. Khi có câu chat mới, embed câu đó.
4. Tìm các mẫu gần nhất bằng vector search.
5. Nếu similarity vượt ngưỡng, tạo risk signal.

### Ví dụ

Câu mới:

```text
Bạn cứ bấm hoàn tất trước, tôi gửi file ngay sau đó.
```

Gần nghĩa với mẫu scam:

```text
Confirm the deal first, then I will deliver.
```

Intent suy ra:

```text
early_release_request
```

### Công cụ có thể dùng

- OpenAI embeddings.
- Sentence Transformers.
- pgvector, Qdrant, Pinecone hoặc Weaviate.

---

## 5.4. Sequence-based behavior detection

Dùng để phát hiện chuỗi hành vi nguy hiểm thay vì từng câu riêng lẻ.

### Ví dụ chuỗi rủi ro cao

```text
Buyer deposits escrow
→ Seller asks to move to Telegram
→ Seller sends external wallet address
→ Seller asks buyer to release first
```

### Event cần lưu

- `deposit`
- `message`
- `warning`
- `upload_proof`
- `release_click`
- `wallet_address_detected`
- `delivery_proof_submitted`
- `terms_confirmed`
- `terms_changed`

### Kỹ thuật

- Event stream.
- Redis Streams hoặc Kafka khi scale lớn.
- Rule engine.
- Finite-state machine.
- Temporal rules.

---

## 5.5. Deal state checker

Kiểm tra hành vi có phù hợp với trạng thái deal hay không.

### Rule mẫu

| Deal state | Hành vi | Risk |
|---|---|---|
| `draft` | Gửi ví ngoài escrow | High |
| `terms_confirmed` | Thay đổi amount/deadline | High |
| `funded` | Yêu cầu release trước delivery proof | High |
| `delivery_submitted` | Proof không khớp điều kiện | Medium/High |
| `delivery_verified` | Release request | Low |
| `disputed` | Dụ ra ngoài nền tảng | High |

---

## 5.6. Wallet risk engine

### Feature MVP

- `wallet_age_days`
- `tx_count`
- `completed_deals`
- `dispute_count`
- `refund_count`
- `is_reported_wallet`
- `linked_reported_wallets`

### Feature nâng cao

- Total volume.
- Counterparty diversity.
- Token diversity.
- Inflow/outflow velocity.
- Cluster liên quan ví rủi ro.
- Graph centrality.
- Độ bất thường của volume so với tuổi ví.

### Model đề xuất theo giai đoạn

| Giai đoạn | Phương pháp |
|---|---|
| MVP | Rule-based score |
| V1 | Logistic Regression / XGBoost |
| V2 | Isolation Forest / anomaly detection |
| V3 | Graph-based risk scoring / GNN |

---

## 5.7. Evidence verification engine

### Loại bằng chứng cần xử lý

- Transaction hash.
- NFT transfer.
- Token transfer.
- File delivery.
- Screenshot.
- Email.
- Link.
- Text confirmation.

### Verification rule

| Evidence | Cách xác minh |
|---|---|
| Crypto tx hash | Kiểm tra sender, receiver, amount, token mint, status |
| NFT transfer | Kiểm tra owner mới và token mint |
| File delivery | Tạo SHA-256 hash, kiểm tra file tồn tại và metadata |
| Screenshot bill | OCR + consistency check, không coi là bằng chứng cuối cùng |
| Link | Kiểm tra domain, URL shortener, phishing pattern |
| Text confirmation | Chỉ là signal phụ, không đủ để release |

---

## 6. Risk scoring tổng hợp

## 6.1. Điểm rủi ro đề xuất

| Tín hiệu | Điểm |
|---|---:|
| Ví mới tạo dưới 7 ngày | +10 |
| Chưa có deal history | +10 |
| Yêu cầu chuyển ra ngoài nền tảng | +25 |
| Gửi ví ngoài escrow | +35 |
| Yêu cầu release trước | +40 |
| Yêu cầu seed phrase/private key/OTP | +100 |
| Fake proof of payment pressure | +40 |
| Tạo áp lực thời gian | +15 |
| Thay đổi điều khoản sau deposit | +25 |
| Delivery proof chưa xác minh | +20 |
| Lặp lại cùng hành vi nguy hiểm | +10 đến +30 |

## 6.2. Phân loại mức rủi ro

| Điểm | Mức rủi ro | Hành động |
|---:|---|---|
| 0–24 | Low | Chỉ ghi log |
| 25–49 | Medium | Hiển thị warning |
| 50–79 | High | Warning mạnh, yêu cầu xác nhận lại |
| 80+ | Critical | Tạm khóa release, đề xuất dispute/human review |

## 6.3. Công thức MVP

```text
Final Risk Score =
Conversation Risk
+ Wallet Risk
+ Escrow State Risk
+ Evidence Risk
+ Repetition Penalty
```

Trong đó:

- **Conversation Risk**: rủi ro từ nội dung hội thoại.
- **Wallet Risk**: rủi ro từ ví.
- **Escrow State Risk**: hành động có phù hợp trạng thái deal không.
- **Evidence Risk**: bằng chứng có xác minh được không.
- **Repetition Penalty**: lặp lại hành vi nguy hiểm nhiều lần.

---

## 7. Data model đề xuất

## 7.1. Bảng `deal_events`

```sql
CREATE TABLE deal_events (
  id UUID PRIMARY KEY,
  deal_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  speaker_id UUID,
  speaker_role TEXT,
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 7.2. Bảng `risk_events`

```sql
CREATE TABLE risk_events (
  id UUID PRIMARY KEY,
  deal_id UUID NOT NULL,
  source_event_id UUID,
  intent TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  score_delta INT NOT NULL,
  confidence NUMERIC,
  reason TEXT,
  evidence JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 7.3. Bảng `wallet_risk_profiles`

```sql
CREATE TABLE wallet_risk_profiles (
  wallet_address TEXT PRIMARY KEY,
  wallet_age_days INT,
  tx_count INT,
  total_volume_usd NUMERIC,
  completed_deals INT DEFAULT 0,
  dispute_count INT DEFAULT 0,
  refund_count INT DEFAULT 0,
  linked_reported_wallets INT DEFAULT 0,
  risk_score INT DEFAULT 0,
  risk_level TEXT DEFAULT 'low',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 7.4. Bảng `scam_playbook_examples`

```sql
CREATE TABLE scam_playbook_examples (
  id UUID PRIMARY KEY,
  intent TEXT NOT NULL,
  language TEXT,
  example_text TEXT NOT NULL,
  risk_level TEXT,
  embedding VECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 8. API thiết kế sơ bộ

## 8.1. Analyze transcript event

```http
POST /api/scam-guard/analyze-message
```

### Request

```json
{
  "deal_id": "deal_123",
  "speaker_id": "seller_456",
  "speaker_role": "seller",
  "message": "Bạn release trước đi rồi tôi gửi file.",
  "timestamp": "2026-06-21T10:05:22Z"
}
```

### Response

```json
{
  "risk_level": "high",
  "risk_score": 65,
  "risk_events": [
    {
      "intent": "early_release_request",
      "score_delta": 40,
      "confidence": 0.91,
      "reason": "Seller asks for escrow release before delivery proof is verified."
    }
  ],
  "ui_warning": {
    "title": "Phát hiện rủi ro cao",
    "message": "Đối phương đang yêu cầu release escrow trước khi có bằng chứng giao hàng hợp lệ.",
    "suggested_action": "Không release tiền cho đến khi điều kiện giao hàng được xác minh."
  },
  "lock_release": true
}
```

## 8.2. Verify evidence

```http
POST /api/scam-guard/verify-evidence
```

### Request

```json
{
  "deal_id": "deal_123",
  "evidence_type": "crypto_tx_hash",
  "tx_hash": "5abc...",
  "expected": {
    "receiver": "escrow_wallet",
    "amount": "100",
    "token": "USDC"
  }
}
```

### Response

```json
{
  "verified": true,
  "evidence_risk_level": "low",
  "checks": {
    "receiver_match": true,
    "amount_match": true,
    "token_match": true,
    "tx_success": true
  }
}
```

---

## 9. UX cảnh báo

## 9.1. Warning popup

### High Risk

```text
Phát hiện rủi ro cao

Seller đang yêu cầu bạn release escrow trước khi có bằng chứng giao hàng hợp lệ.

Khuyến nghị:
Không release tiền cho đến khi điều kiện giao hàng được xác minh.
```

### Critical Risk

```text
Cảnh báo cực kỳ nguy hiểm

Phát hiện yêu cầu chia sẻ seed phrase/private key/OTP hoặc địa chỉ ví ngoài escrow.

Hành động:
Không tiếp tục giao dịch. Không chia sẻ thông tin nhạy cảm. Đề xuất mở dispute hoặc yêu cầu human review.
```

## 9.2. AI Monitor Panel

Hiển thị:

- Current Risk Level.
- Latest Warning.
- Reason.
- Suggested Action.
- Related Transcript.
- Deal State.
- Evidence Status.
- Wallet Risk Summary.

## 9.3. Evidence Timeline

```text
10:05:22 — Seller: “Bạn release trước đi rồi tôi gửi file.”
10:05:23 — AI detected early_release_request.
10:05:24 — High-risk warning shown to Buyer.
10:05:25 — Release button temporarily locked.
```

---

## 10. Lộ trình triển khai

## Phase 0 — Chuẩn bị dữ liệu và rule base

### Việc cần làm

- Chuẩn hóa danh sách scam intents.
- Tạo bộ keyword tiếng Việt + tiếng Anh.
- Tạo scam playbook ban đầu với 20–50 ví dụ cho mỗi intent.
- Thiết kế JSON schema cho risk event.
- Thiết kế bảng `deal_events`, `risk_events`, `wallet_risk_profiles`.

### Deliverable

- `scam_intents.json`
- `scam_rules.json`
- `scam_playbook_seed.csv`
- Database migration.

---

## Phase 1 — MVP realtime scam detection

### Việc cần làm

- Tích hợp STT realtime từ Agora hoặc provider STT.
- Tạo transcript event theo speaker và timestamp.
- Xây dựng rule detector.
- Xây dựng LLM intent classifier.
- Xây dựng deal state checker.
- Tạo risk score aggregator.
- Hiển thị warning popup trên frontend.
- Lưu evidence vào Evidence Vault.

### Intent bắt buộc trong MVP

- `early_release_request`
- `move_off_platform`
- `external_wallet_request`
- `credential_request`
- `fake_payment_pressure`
- `time_pressure`
- `term_change`

### Deliverable

- API `/analyze-message`.
- Rule engine chạy realtime.
- UI warning popup.
- Evidence Timeline.
- Demo script 3–5 tình huống scam.

---

## Phase 2 — Evidence verification và wallet risk

### Việc cần làm

- Tích hợp Solana RPC/Helius để verify transaction hash.
- Kiểm tra amount, receiver, token mint và tx status.
- Tạo hash cho file giao hàng.
- OCR ảnh bill ở mức cơ bản.
- Wallet risk scoring rule-based.
- Chặn hoặc cảnh báo ví ngoài escrow.

### Deliverable

- API `/verify-evidence`.
- API `/wallet-risk/:address`.
- Evidence status trong AI Monitor Panel.
- Wallet risk badge.

---

## Phase 3 — Scam playbook similarity search

### Việc cần làm

- Embed scam playbook.
- Lưu embedding vào pgvector/Qdrant.
- Search top-k scam examples cho mỗi message.
- Tạo similarity signal.
- Kết hợp rule + LLM + similarity vào aggregator.

### Deliverable

- Vector database cho scam playbook.
- Similarity detector.
- Dashboard xem các mẫu scam gần nhất.

---

## Phase 4 — Sequence detection và risk orchestration

### Việc cần làm

- Lưu toàn bộ event stream của Deal Room.
- Định nghĩa các sequence pattern nguy hiểm.
- Tăng risk score khi các event xuất hiện theo chuỗi.
- Tạo cooldown, lock release, human review trigger.

### Deliverable

- Sequence rule engine.
- Temporal risk scoring.
- Human review queue.

---

## Phase 5 — ML nâng cao và fraud intelligence

### Việc cần làm

- Huấn luyện model từ dữ liệu thật đã được label.
- Xây dựng anomaly detection cho wallet behavior.
- Xây dựng graph risk scoring.
- Cải thiện OCR/tampering detection.
- A/B test ngưỡng cảnh báo.

### Deliverable

- Model fraud scoring V1.
- Graph wallet risk engine.
- Evaluation report.
- Monitoring dashboard.

---

## 11. Bộ rule mẫu cho MVP

## 11.1. Rule yêu cầu release trước

```json
{
  "rule_id": "SCAM_EARLY_RELEASE",
  "trigger": {
    "intent": "early_release_request",
    "deal_state_not_in": ["delivery_verified", "ready_to_release"]
  },
  "risk_level": "high",
  "score": 40,
  "message": "Đối phương đang yêu cầu release escrow trước khi hoàn tất nghĩa vụ."
}
```

## 11.2. Rule chuyển ra ngoài nền tảng

```json
{
  "rule_id": "SCAM_OFF_PLATFORM",
  "trigger": {
    "intent": "move_off_platform"
  },
  "risk_level": "high",
  "score": 35,
  "message": "Đối phương đang đề nghị chuyển giao dịch ra ngoài nền tảng."
}
```

## 11.3. Rule yêu cầu seed phrase/private key/OTP

```json
{
  "rule_id": "SCAM_CREDENTIAL_REQUEST",
  "trigger": {
    "keywords": ["seed phrase", "private key", "recovery phrase", "OTP"]
  },
  "risk_level": "critical",
  "score": 100,
  "message": "Không bao giờ chia sẻ seed phrase, private key hoặc OTP."
}
```

## 11.4. Rule ví ngoài escrow

```json
{
  "rule_id": "SCAM_EXTERNAL_WALLET",
  "trigger": {
    "detected_wallet_address": true,
    "address_not_in_deal": true
  },
  "risk_level": "critical",
  "score": 80,
  "message": "Phát hiện địa chỉ ví không thuộc escrow hoặc hai bên đã xác thực."
}
```

## 11.5. Rule fake proof pressure

```json
{
  "rule_id": "SCAM_FAKE_PAYMENT_PROOF",
  "trigger": {
    "intent": "screenshot_as_payment_proof",
    "pressure_to_release": true
  },
  "risk_level": "high",
  "score": 40,
  "message": "Không release tài sản chỉ dựa trên ảnh chụp màn hình thanh toán."
}
```

---

## 12. Test cases cần demo

## Test case 1 — Release trước

### Input

```text
Seller: Bạn release trước đi rồi tôi gửi file ngay.
Deal state: funded
Delivery proof: none
```

### Expected output

```json
{
  "intent": "early_release_request",
  "risk_level": "high",
  "lock_release": true
}
```

---

## Test case 2 — Dụ ra ngoài nền tảng

### Input

```text
Seller: Qua Telegram nói chuyện cho tiện, ở đây chậm quá.
Deal state: funded
```

### Expected output

```json
{
  "intent": "move_off_platform",
  "risk_level": "high"
}
```

---

## Test case 3 — Ví ngoài escrow

### Input

```text
Seller: Escrow lỗi rồi, bạn gửi vào ví này nhé: 7aYx...
Detected address: not in deal metadata
```

### Expected output

```json
{
  "intent": "external_wallet_request",
  "risk_level": "critical",
  "lock_release": true
}
```

---

## Test case 4 — Fake payment proof

### Input

```text
Buyer: Tôi chuyển rồi, bill đây, release NFT đi.
Evidence: screenshot only
On-chain tx: none
```

### Expected output

```json
{
  "intent": "fake_payment_pressure",
  "risk_level": "high",
  "suggested_action": "Require verified payment before release."
}
```

---

## Test case 5 — Credential request

### Input

```text
Seller: Gửi seed phrase để tôi kiểm tra ví giúp bạn.
```

### Expected output

```json
{
  "intent": "credential_request",
  "risk_level": "critical",
  "block_message": true
}
```

---

## 13. Metrics đánh giá

## 13.1. Detection metrics

- Precision theo từng intent.
- Recall theo từng intent.
- False positive rate.
- False negative rate.
- Time-to-detect sau khi message xuất hiện.
- Tỷ lệ cảnh báo đúng trước khi user click release.

## 13.2. Product metrics

- Số lần release bị chặn đúng.
- Số dispute giảm.
- Tỷ lệ user tiếp tục giao dịch trong Deal Room sau cảnh báo.
- Tỷ lệ warning bị user bỏ qua.
- Tỷ lệ human review dẫn đến xác nhận scam.

## 13.3. Latency target

| Thành phần | Mục tiêu |
|---|---:|
| STT partial transcript | < 1.5s |
| Rule detector | < 100ms |
| LLM classifier | < 2.5s |
| Risk aggregation | < 100ms |
| Popup warning | < 500ms sau khi có risk event |

---

## 14. Những phần không nên ưu tiên trong MVP

Không nên dồn nguồn lực vào các phần khó đảm bảo độ chính xác trong hackathon hoặc giai đoạn đầu:

- Deepfake detection nâng cao.
- Graph Neural Network.
- Full AML engine.
- Bank payment verification tự động.
- Voice biometric.
- Complex fraud ML model.

Thay vào đó, MVP nên tập trung vào các tín hiệu có tác động trực tiếp đến mất tiền và dễ demo:

- Release trước.
- Ra ngoài nền tảng.
- Fake proof of payment.
- Ví ngoài escrow.
- Seed phrase/private key/OTP.
- Thay đổi điều khoản sau deposit.

---

## 15. Checklist triển khai MVP

- [ ] Tạo danh sách scam intents.
- [ ] Tạo rule keyword tiếng Việt + tiếng Anh.
- [ ] Tạo JSON schema cho risk event.
- [ ] Tích hợp STT realtime.
- [ ] Tạo transcript event theo speaker.
- [ ] Xây rule detector.
- [ ] Xây LLM intent classifier.
- [ ] Xây deal state checker.
- [ ] Xây wallet address parser.
- [ ] Xây risk aggregator.
- [ ] Tạo warning popup.
- [ ] Tạo AI Monitor Panel.
- [ ] Lưu Evidence Timeline.
- [ ] Test 5 kịch bản scam chính.
- [ ] Chuẩn bị demo script.

---

## 16. Kết luận

AI nhận diện scam nên được xây theo kiến trúc nhiều lớp:

1. Speech-to-Text realtime.
2. Rule-based keyword detection.
3. LLM intent classification.
4. Semantic similarity với scam playbook.
5. Deal state checker.
6. Wallet risk engine.
7. Evidence verification.
8. Risk score aggregator.
9. Realtime warning popup.
10. Evidence Vault.

Trong MVP, ưu tiên cao nhất là **phát hiện và chặn các hành vi có thể làm người dùng mất tiền ngay**, đặc biệt là yêu cầu release trước, giao dịch ngoài nền tảng, fake proof of payment, ví ngoài escrow và yêu cầu thông tin nhạy cảm.
