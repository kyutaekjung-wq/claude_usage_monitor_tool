const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  fetchUsage: () => ipcRenderer.invoke('fetch-usage'),
  setAlwaysOnTop: (val) => ipcRenderer.send('set-always-on-top', val),
  closeApp: () => ipcRenderer.send('close-app'),
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
  onTriggerRefresh: (cb) => ipcRenderer.on('trigger-refresh', cb),
  setThresholds: (vals) => ipcRenderer.send('set-thresholds', vals),
  login: () => ipcRenderer.invoke('login'),
  getOrgs: () => ipcRenderer.invoke('get-orgs'),
  setOrg: (orgId) => ipcRenderer.invoke('set-org', orgId),
  setTrayMode: (mode) => ipcRenderer.send('set-tray-mode', mode),
  resizeWindow: (height) => ipcRenderer.send('resize-window', height),
});
