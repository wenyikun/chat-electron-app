import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import database from './database'
// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'logo.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // devTools: !!VITE_DEV_SERVER_URL
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  // 对话插入
  ipcMain.handle('insertConversation', (_event, data) => database.then((db) => db.insert(data).into('conversations')))
  ipcMain.handle('getConversations', (_event, data) => {
    return database.then((db) =>
      db
        .select('id', 'title')
        .limit(data.pageSize)
        .offset((data.pageNum - 1) * data.pageSize)
        .from('conversations')
        .orderBy('id', 'desc')
    )
  })
  ipcMain.handle('updateConversation', (_event, data) =>
    database.then((db) => db.update(data).into('conversations').where({ id: data.id }))
  )
  ipcMain.handle('getConversation', (_event, id) =>
    database.then((db) => db.from('conversations').where('id', id).first())
  )
  ipcMain.handle('deleteConversation', (_event, id) =>
    database.then((db) => db.delete().from('conversations').where('id', id))
  )

  let pdfWin: BrowserWindow | null
  let pdfMessages: any[] = []
  const closePdfWin = () => {
    pdfWin?.close()
    pdfWin = null
    pdfMessages = []
  }
  ipcMain.on('openPrintView', (_event, messages) => {
    pdfMessages = messages
    pdfWin = new BrowserWindow({
      icon: path.join(process.env.VITE_PUBLIC, 'logo.svg'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
      show: false
    })

    if (VITE_DEV_SERVER_URL) {
      pdfWin.loadURL(VITE_DEV_SERVER_URL + '#print')
    } else {
      // win.loadFile('dist/index.html')
      pdfWin.loadFile(path.join(process.env.DIST, 'index.html'), {
        hash: 'print'
      })
    }
  })

  ipcMain.handle('getPrintMessages', () => pdfMessages)

  ipcMain.handle('printToPDF', async (event) => {
    try {
      const value = await dialog.showSaveDialog({
        title: '保存为PDF',
        defaultPath: '未命名.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })
      if (value.canceled) {
        closePdfWin()
        return
      }
      const data = await event.sender.printToPDF({
        printBackground: true,
        margins: {
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
        },
        // scale: 1.2,
        landscape: true,
        pageSize: 'A4',
      })
      await fs.promises.writeFile(value.filePath as string, data)
      closePdfWin()
    } catch (error) {
      closePdfWin()
    }
  })
  createWindow()
})
