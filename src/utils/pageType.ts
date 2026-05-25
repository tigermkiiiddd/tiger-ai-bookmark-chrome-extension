export const isSpecialPage = (url: string): boolean => {
  return url.startsWith('chrome://') || 
         url.startsWith('chrome-extension://') ||
         url.startsWith('about:');
};