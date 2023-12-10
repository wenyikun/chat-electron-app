export function copyText(text: string) {
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('style', 'position: absolute; left: -9999px;');
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
}
