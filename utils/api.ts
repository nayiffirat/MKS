
export const getApiBase = () => {
  const isCapacitor = window.location.origin.includes('localhost') || 
                      window.location.origin.includes('capacitor://') ||
                      window.location.origin.includes('http://localhost');
  
  // Replace this with your actual production URL
  const PROD_URL = 'https://ais-pre-zmy7cyrul53kimjptv7wnk-324283545149.europe-west2.run.app';
  const ALT_PROD_URL = 'https://m-hendis-kay-t-sistemi-65385039239.europe-west3.run.app';
  
  // Use the origin if it looks like a production URL, otherwise fallback
  const currentOrigin = window.location.origin;
  const isProdOrigin = currentOrigin.includes('run.app');
  
  if (isCapacitor) {
     return PROD_URL; // Or ALT_PROD_URL depending on where the server is
  }
  
  return isProdOrigin ? '' : PROD_URL; 
};

export const API_BASE = getApiBase();
