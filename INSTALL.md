# 🧰 Claude Monitor 설치 가이드

## 방법 1: Homebrew Cask (추천)

```bash
# Tap 등록 (최초 1회)
brew tap kyutaekjung-wq/claude-monitor https://github.com/kyutaekjung-wq/claude_usage_monitor_tool

# 설치
brew install --cask claude-monitor

# 업데이트
brew upgrade --cask claude-monitor

# 제거
brew uninstall --cask claude-monitor
brew untap kyutaekjung-wq/claude-monitor
```

## 방법 2: DMG 직접 설치

1. [Releases](https://github.com/kyutaekjung-wq/claude_usage_monitor_tool/releases)에서 DMG 다운로드
   - Apple Silicon: `Claude Monitor-x.x.x-arm64.dmg`
   - Intel Mac: `Claude Monitor-x.x.x.dmg`
2. DMG 더블클릭 → Applications 폴더로 드래그
3. `/Applications/Claude Monitor.app` 실행

## 방법 3: 소스에서 빌드

```bash
git clone https://github.com/kyutaekjung-wq/claude_usage_monitor_tool
cd claude_usage_monitor_tool/electron
npm install
npm start              # 개발 실행
npm run dist           # DMG 빌드
```

## 요구사항

- macOS 10.13+ (Apple Silicon 또는 Intel)
- **Claude Desktop 설치 + 로그인** 권장 (최초 인증용)
- 또는 앱 내 "🔐 로그인" 버튼으로 claude.ai 직접 로그인 가능

## 릴리즈 프로세스 (배포자용)

```bash
cd electron
npm version patch      # 버전 올리기
npm run dist           # DMG 빌드
shasum -a 256 dist/*.dmg   # SHA256 계산 → Casks/claude-monitor.rb 업데이트
gh release create v1.0.1 dist/*.dmg --notes "..."
git add Casks/ && git commit -m "bump 1.0.1" && git push
```
