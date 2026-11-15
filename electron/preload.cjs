const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('wendoroDesktop', {
  isDesktopApp: true,
  platform: process.platform,
  arch: process.arch,
});
