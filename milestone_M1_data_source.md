# M1: 데이터 소스 확보

## 상태: ✅ 완료

## 채택 방법: Playwright + Claude Desktop Keychain 쿠키

### API 응답 구조
```json
{
  "five_hour": { "utilization": 18.0, "resets_at": "2026-04-17T10:00:01Z" },
  "seven_day":  { "utilization": 7.0,  "resets_at": "2026-04-24T00:00:01Z" },
  "seven_day_sonnet": { "utilization": 0.0, "resets_at": "2026-04-24T06:00:00Z" }
}
```

### 필드 매핑
| 화면 표시 | API 필드 |
|-----------|----------|
| 현재 세션 % | `five_hour.utilization` |
| 세션 재설정 시간 | `five_hour.resets_at` |
| 주간 모든 모델 % | `seven_day.utilization` |
| 주간 모든 모델 재설정 | `seven_day.resets_at` |
| Sonnet 주간 % | `seven_day_sonnet.utilization` |
| Sonnet 재설정 | `seven_day_sonnet.resets_at` |

### 작동 방식
1. macOS Keychain → "Claude Safe Storage" 키로 복호화 키 획득
2. Claude Desktop Cookies SQLite → sessionKey, cf_clearance 등 복호화
3. Playwright headless Chromium → 쿠키 주입 → `/api/organizations/{org}/usage` 호출
4. 응답 파싱 → 구조화된 사용량 데이터 반환
