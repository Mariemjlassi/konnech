const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('konnech', {
  load: () => ipcRenderer.invoke('load'),
  save: (items) => ipcRenderer.invoke('save', items),
  openFolder: () => ipcRenderer.invoke('openFolder')
});
