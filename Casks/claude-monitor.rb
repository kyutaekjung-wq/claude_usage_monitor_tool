cask "claude-monitor" do
  version "1.0.0"

  on_arm do
    sha256 "b6613f83830b7ff33c8526298443021f083b50082b81b3348b8c4ae656f51851"
    url "https://github.com/kyutaekjung-wq/claude_usage_monitor_tool/releases/download/v#{version}/Claude.Monitor-#{version}-arm64.dmg"
  end

  on_intel do
    sha256 "f678921b68448968b1284770648c00337f6f2ad84883461daf8d798b2a33e0d8"
    url "https://github.com/kyutaekjung-wq/claude_usage_monitor_tool/releases/download/v#{version}/Claude.Monitor-#{version}.dmg"
  end

  name "Claude Monitor"
  desc "Claude 사용량 실시간 모니터 (메뉴바 + 플로팅 창)"
  homepage "https://github.com/kyutaekjung-wq/claude_usage_monitor_tool"

  app "Claude Monitor.app"

  zap trash: [
    "~/Library/Application Support/claude-monitor",
    "~/Library/Preferences/io.github.kyutaekjung-wq.claude-usage-monitor-tool.plist",
    "~/Library/Saved Application State/io.github.kyutaekjung-wq.claude-usage-monitor-tool.savedState",
  ]
end
