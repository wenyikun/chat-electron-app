import { app, BrowserWindow, ipcMain, net } from 'electron'
import path from 'node:path'
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
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
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
  const controllerMap = new Map()
  ipcMain.handle('request', async (event, input, init) => {
    const { responseType, requestId, ...rest } = init
    try {
      const controller = new AbortController()
      controllerMap.set(requestId, controller)
      const resp = await net.fetch(input, {
        ...rest,
        signal: controller.signal
      })
      if (resp.ok) {
        if (responseType === 'stream') {
          const reader = resp.body!.getReader()
          const decoder = new TextDecoder()
          while (true) {
            const { value, done } = await reader.read()
            const chunkValue = decoder.decode(value)
            event.sender.send('stream-reply', {
              value: chunkValue,
              done,
              requestId,
            })
            if (done) {
              controllerMap.delete(requestId)
              return
            }
          }
        } else {
          controllerMap.delete(requestId)
          return await resp.json()
        }
      } else {
        controllerMap.delete(requestId)
        return await resp.json()
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        event.sender.send('stream-reply', {
          value: 'data: [DONE]',
          done: false,
          requestId,
        })
        controllerMap.delete(requestId)
      } else {
        return {
          error: {
            message: "网络错误，请重试！"
          }
        }
      }
    }
  })
  // 请求终止
  ipcMain.on('request-abort', (_event, requestId) => {
    const controller = controllerMap.get(requestId)
    controller?.abort()
  })
  // 对话插入
  ipcMain.handle('insertConversation', (_event, data) =>
    database.then((db) => db.insert(data).into('conversations'))
  )
  ipcMain.handle('getConversations', (_event, data) => {
    return database.then((db) => db.select('id', 'title').limit(data.pageSize).offset((data.pageNum - 1) * data.pageSize).from('conversations').orderBy('id', 'desc'))
  })
  ipcMain.handle('updateConversation', (_event, data) =>
    database.then((db) => db.update(data).into('conversations').where({ id: data.id }))
  )
  ipcMain.handle('getConversation', (_event, id) => database.then((db) => db.from('conversations').where('id', id).first()))
  ipcMain.handle('deleteConversation', (_event, id) => database.then((db) => db.delete().from('conversations').where('id', id)))
  createWindow()
})
