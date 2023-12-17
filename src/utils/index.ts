export function copyText(text: string) {
  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('style', 'position: absolute; left: -9999px;')
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
}

// 文件转成base64
export async function fileToGenerativePart(file: File) {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.readAsDataURL(file)
  })
  return { data: await base64EncodedDataPromise, mimeType: file.type }
}
