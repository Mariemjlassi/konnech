const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const root = () => path.join(app.getPath('documents'), 'Konnech');
const dataFile = () => path.join(root(), 'konnech.json');
const backupFile = () => path.join(root(), 'konnech.backup.json');
const mirrorDir = () => path.join(root(), 'Mes dossiers');

function readItems(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(raw.items) ? raw.items : [];
}

ipcMain.handle('load', () => {
  try { return readItems(dataFile()); } catch (e) {}
  try { return readItems(backupFile()); } catch (e) {}
  return [];
});

let mirrorTimer = null;
ipcMain.handle('save', (_e, items) => {
  fs.mkdirSync(root(), { recursive: true });
  if (fs.existsSync(dataFile())) fs.copyFileSync(dataFile(), backupFile());
  const tmp = dataFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ app: 'Konnech', version: 1, saved: new Date().toISOString(), items }, null, 1), 'utf8');
  fs.renameSync(tmp, dataFile());
  clearTimeout(mirrorTimer);
  mirrorTimer = setTimeout(() => { try { writeMirror(items); } catch (e) { console.error(e); } }, 1500);
  return true;
});

ipcMain.handle('openFolder', () => {
  fs.mkdirSync(mirrorDir(), { recursive: true });
  return shell.openPath(mirrorDir());
});

/* Readable copy of the notebook as real folders and .html pages */
const safe = (n) => (String(n || 'Sans titre').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/, '').trim().slice(0, 80) || 'Sans titre');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function writeMirror(items) {
  const byParent = new Map();
  for (const it of items) {
    if (it.kind === 'ticket') continue;
    const p = it.parent || '';
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(it);
  }
  const out = mirrorDir();
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'LISEZ-MOI.txt'),
    "Copie lisible de ton carnet Konnech, régénérée automatiquement.\r\nModifie tes pages dans l'app : les changements faits ici seront remplacés.\r\nLes vraies données sont dans konnech.json (et konnech.backup.json).\r\n", 'utf8');
  const walk = (pid, dir) => {
    const used = new Set();
    for (const it of byParent.get(pid) || []) {
      let base = safe(it.name), name = base, i = 2;
      while (used.has(name.toLowerCase())) name = `${base} (${i++})`;
      used.add(name.toLowerCase());
      const target = it.archived ? path.join(dir, '_Archives') : dir;
      fs.mkdirSync(target, { recursive: true });
      if (it.kind === 'folder') {
        const d = path.join(target, name);
        fs.mkdirSync(d, { recursive: true });
        walk(it.id, d);
      } else {
        const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(it.name)}</title>
<style>body{font-family:"Segoe UI",system-ui,sans-serif;max-width:760px;margin:48px auto;padding:0 20px;line-height:1.7;color:#151515}
h1{font-weight:600}pre{background:#f4f4f3;padding:10px 14px;white-space:pre-wrap}ul.check{list-style:none;padding-left:0}
ul.check li::before{content:"☐ "}ul.check li.done::before{content:"☑ "}ul.check li.done{color:#888;text-decoration:line-through}</style></head>
<body>${it.content || ''}</body></html>`;
        fs.writeFileSync(path.join(target, name + '.html'), html, 'utf8');
      }
    }
  };
  walk('', out);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 420, minHeight: 500,
    title: 'Konnech', backgroundColor: '#ffffff', autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: true }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.loadFile(path.join(__dirname, 'index.html'));
}

Menu.setApplicationMenu(null);
app.whenReady().then(() => {
  app.setAppUserModelId('Konnech');
  createWindow();
});
app.on('window-all-closed', () => app.quit());
