cask "claude-monitor" do
  version "1.0.3"

  on_arm do
    sha256 "caef1e79998052a88d47ae22c4056f67e1829343b76ec274f5132bae37c654b7"
    url "https://github.com/kyutaekjung-wq/claude_usage_monitor_tool/releases/download/v#{version}/Claude.Monitor-#{version}-arm64.dmg"
  end

  on_intel do
    sha256 "141a62e4cfc56ae6c068fc6badfe60c00de87c3b04f5b165c340325e902e7f62"
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
