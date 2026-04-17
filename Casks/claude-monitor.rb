cask "claude-monitor" do
  version "1.0.2"

  on_arm do
    sha256 "cb6ed97bb688215ab039cfd2a9e2f3ca3a4adba8cb12c6686fc97877e3ca1ba0"
    url "https://github.com/kyutaekjung-wq/claude_usage_monitor_tool/releases/download/v#{version}/Claude.Monitor-#{version}-arm64.dmg"
  end

  on_intel do
    sha256 "9edf8474865411ec6c6e92e0ab8d90116f47d71954f5fb2380870768b1d69276"
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
