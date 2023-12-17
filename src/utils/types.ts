export interface FileDetail {
  data: string
  mimeType: string
}

export interface MessageType {
  role: 'user' | 'assistant'
  type?: 'openai' | 'gemini'
  content: string
  files?: FileDetail[]
}