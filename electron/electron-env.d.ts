/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    DIST: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  netApi: {
    request: (
      input: RequestInfo,
      init?: RequestInit & {
        requestId?: string
        responseType?: 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream'
      },
      callback?: (data: { done: boolean; value: string }) => void
    ) => Promise<any>
    abort: (requestId: string) => void
  }
  db: {
    insertConversation: (data: any) => Promise<any>
    getConversations: (data: { pageSize: number; pageNum: number; }) => Promise<any[]>
    updateConversation: (data: any) => Promise<any>
    getConversation: (id: string) => Promise<any>
    deleteConversation: (id: string) => Promise<any>
  },
  toolApi: {
    printToPDF: () => Promise<any>
  }
}
