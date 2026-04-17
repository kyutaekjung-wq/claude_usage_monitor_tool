cask "claude-monitor" do
  version "1.0.1"

  on_arm do
    sha256 "19e9ac688c7e2574f8418098392d4ae9017679ba58eef2751bda6186ae1c8a76"
    url "https://github.com/kyutaekjung-wq/claude_usage_monitor_tool/releases/download/v#{version}/Claude.Monitor-#{version}-arm64.dmg"
  end

  on_intel do
    sha256 "6f6e40200a87a22771bbd1aa580cc7448d7d8ee714c1d338706c550649410244"
    url "https://github.com/kyutaekjung-wq/claude_usage_monitor_tool/releases/download/v#{version}/Claude.Monitor-#{version}.dmg"
  end

  name "Claude Monitor"
  desc "Claude 사용량 실시간 모니터 (메뉴바 + 플로팅 창)"
  homepage "https://github.com/kyutaekjung-wq/claude_usage_monitor_tool"

  app "Claude Monitor.app"

  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/Claude Monitor.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/claude-monitor",
    "~/Library/Preferences/io.github.kyutaekjung-wq.claude-usage-monitor-tool.plist",
    "~/Library/Saved Application State/io.github.kyutaekjung-wq.claude-usage-monitor-tool.savedState",
  ]
end
