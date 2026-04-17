# Claude Usage Monitor Tool - 마일스톤 계획

## 프로젝트 개요
Claude Desktop의 사용량을 실시간으로 맥북 화면에 띄우는 모니터링 앱

## 기능 요구사항
- 현재 세션 사용량 한도 (%)
- 주간 한도 - 모든 모델 (%)
- 주간 한도 - Sonnet만 (%)
- 50% 초과: 노란색, 80% 초과: 빨간색
- 세션별 남은 시간 표시
- 그래프별 on/off 토글
- 창 핀 고정 (항상 최상단)
- 투명도 % 조절

## 데이터 소스 전략
**Accessibility API** 방식 채택:
- Claude Desktop 앱이 이미 인증되어 있음
- 쿠키/토큰 만료 문제 없음
- Cloudflare 우회 불필요
- Claude Desktop이 설치되어 있으면 즉시 동작

## 마일스톤

| # | 이름 | 상태 | 설명 |
|---|------|------|------|
| M1 | data_source | 🔄 진행중 | Accessibility API로 Claude Desktop 사용량 읽기 |
| M2 | data_parser | ⬜ 대기 | 텍스트 파싱 → 구조화된 사용량 데이터 |
| M3 | ui_app | ⬜ 대기 | PyQt 그래프 UI, 핀, 투명도 구현 |
| M4 | integration | ⬜ 대기 | 전체 통합 및 자동실행 설정 |

## 기술 스택
- **데이터**: AppleScript + macOS Accessibility API
- **UI**: Python + PyQt6 (투명도/항상위 네이티브 지원)
- **언어**: Python 3.9+
