import { dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
// import log from 'electron-log'

// log.transports.file.level = "debug"
// autoUpdater.logger = log

autoUpdater.autoDownload = false

autoUpdater.on('error', (error) => {
  dialog.showErrorBox('Error: ', error == null ? 'unknown' : (error.stack || error).toString())
})

autoUpdater.on('update-not-available', () => {
  dialog.showMessageBox({
    title: '软件无更新',
    message: '当前已是最新版本，无需更新。'
  })
})

autoUpdater.on('update-available', () => {
  dialog
    .showMessageBox({
      type: 'info',
      title: '软件更新',
      message: '有新版本可更新，是否现在更新?',
      buttons: ['立即更新', '暂不更新'],
    })
    .then(() => {
      autoUpdater.downloadUpdate()
    })
})

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    title: '下载完成',
    message: '更新包已下载, 程序将会退出更新...'
  }).then(() => {
    setImmediate(() => autoUpdater.quitAndInstall())
  })
})

export function checkForUpdates() {
  autoUpdater.checkForUpdates()
}
