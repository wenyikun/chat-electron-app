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
  db: {
    insertConversation: (data: any) => Promise<any>
    getConversations: (data: { pageSize: number; pageNum: number; }) => Promise<any[]>
    updateConversation: (data: any) => Promise<any>
    getConversation: (id: string) => Promise<any>
    deleteConversation: (id: string) => Promise<any>
  },
  toolApi: {
    printToPDF: () => Promise<any>
    openPrintView: (messages: any[]) => void
    getPrintMessages: () => Promise<any[]>
  }
}
