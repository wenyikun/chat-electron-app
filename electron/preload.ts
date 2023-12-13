import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
// contextBridge.exposeInMainWorld('ipcRenderer', withPrototype(ipcRenderer))

// `exposeInMainWorld` can't detect attributes and methods of `prototype`, manually patching it.
// function withPrototype(obj: Record<string, any>) {
//   const protos = Object.getPrototypeOf(obj)

//   for (const [key, value] of Object.entries(protos)) {
//     if (Object.prototype.hasOwnProperty.call(obj, key)) continue

//     if (typeof value === 'function') {
//       // Some native APIs, like `NodeJS.EventEmitter['on']`, don't work in the Renderer process. Wrapping them into a function.
//       obj[key] = function (...args: any) {
//         return value.call(obj, ...args)
//       }
//     } else {
//       obj[key] = value
//     }
//   }
//   return obj
// }

// 数据库操作 api
contextBridge.exposeInMainWorld('db', {
  insertConversation: (data: any) => ipcRenderer.invoke('insertConversation', data),
  getConversations: (data: { pageSize: number; pageNum: number; } = { pageSize: 10, pageNum: 1 }) => ipcRenderer.invoke('getConversations', data),
  updateConversation: (data: any) => ipcRenderer.invoke('updateConversation', data),
  getConversation: (id: number) => ipcRenderer.invoke('getConversation', id),
  deleteConversation: (id: number) => ipcRenderer.invoke('deleteConversation', id)
})

const replyMap = new Map()
ipcRenderer.on('stream-reply', (_event, data) => {
  replyMap.get(data.requestId)?.(data)
  if (data.done) {
    replyMap.delete(data.requestId)
  }
})

// 网络请求 api
contextBridge.exposeInMainWorld('netApi', {
  request: (
    input: RequestInfo,
    init?: RequestInit & {
      responseType?: 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream'
      requestId?: string
    },
    callback?: (data: { done: boolean; value: string }) => void
  ) => {
    if (init?.responseType === 'stream' && init.requestId && callback) {
      replyMap.set(init.requestId, callback)
    }
    return ipcRenderer.invoke('request', input, init)
  },
  abort(requestId: string) {
    ipcRenderer.send('request-abort', requestId)
  }
})

contextBridge.exposeInMainWorld('toolApi', {
  printToPDF: () => ipcRenderer.invoke('printToPDF'),
  openPrintView: (messages: any[]) => {
    ipcRenderer.send('openPrintView', messages)
  },
  getPrintMessages: () => ipcRenderer.invoke('getPrintMessages'),
})

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true)
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true)
        }
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find((e) => e === child)) {
      parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find((e) => e === child)) {
      parent.removeChild(child)
    }
  },
}

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
  const className = `loaders-css__square-spin`
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `
  const oStyle = document.createElement('style')
  const oDiv = document.createElement('div')

  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className = 'app-loading-wrap'
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle)
      safeDOM.append(document.body, oDiv)
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle)
      safeDOM.remove(document.body, oDiv)
    },
  }
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev) => {
  ev.data.payload === 'removeLoading' && removeLoading()
}

setTimeout(removeLoading, 4999)
