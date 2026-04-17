# Claude Monitor

> Claude 사용량을 macOS 메뉴바 + 플로팅 창으로 실시간 모니터링

## ✨ 기능

- 🔴 **메뉴바 Tray 아이콘** - Claude 캐릭터 + 사용량 시각화 (떨리는 아이콘 / 세로 바 / 원형 차트 / 숫자 %)
- 📊 **플로팅 창** - 현재 세션 / 주간 (모든 모델) / 주간 (Sonnet) 3개 게이지
- ⏰ **세션 재설정 알람** - macOS 네이티브 알림
- ⚙️ **환경설정** - 임계값 (경고/위험), 그래프 표시 토글, 투명도, 다크/라이트 모드
- 🏢 **다중 조직** - 여러 claude.ai 조직 간 자동/수동 전환
- 📌 **Pin** - 항상 위에 고정
- 🔐 **로그인** - Claude Desktop 쿠키 자동 감지 + 자체 OAuth 로그인 폴백

## 🖼 스크린샷

메뉴바와 팝업 창이 나란히 동작합니다.

## 📦 설치

자세한 내용은 [INSTALL.md](INSTALL.md) 참고.

```bash
brew tap kyutaekjung-wq/claude-monitor https://github.com/kyutaekjung-wq/claude_usage_monitor_tool
brew install --cask claude-monitor
```

## 🧪 요구사항

- macOS 10.13+
- Claude Desktop 또는 Claude.ai 계정

## 🏗 기술 스택

- **Electron** (UI + 메뉴바 Tray)
- **playwright-core** (Cloudflare 우회 + claude.ai API 호출)
- **pngjs** (동적 아이콘 합성)
- **sql.js** (Claude Desktop Cookies SQLite 파싱)

## 📜 라이선스

MIT
