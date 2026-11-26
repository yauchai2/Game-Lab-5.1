let activeLanguage;
let activeStack;

export function canvasUiFont(size, weight = 400) {
  const root = document.documentElement;
  if (root.lang !== activeLanguage) {
    activeLanguage = root.lang;
    activeStack = getComputedStyle(root).getPropertyValue('--font-ui').trim();
  }
  return `${weight} ${size}px ${activeStack}`;
}
