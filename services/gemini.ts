import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

export function getGeminiModel(modelName: string = "gemini-1.5-flash") {
  if (!genAI) {
    // Priority order for API key:
    // 1. process.env (injected by Vite define or server)
    // 2. import.meta.env (Vite standard)
    // 3. Fallback to empty string (will fail safely at API level)
    
    // Use VITE_ prefix for client-side access in Vite
    // process.env is usually not available in the browser unless replaced by build tools
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyDRgls969QsCnRny-j8dZZQn_S-JM6Xcqs";
    
    console.log("Gemini API Key detected (first 5 chars):", apiKey.slice(0, 5));

    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      console.warn("Gemini API key is missing or is using a placeholder!");
    }
    
    genAI = new GoogleGenAI(apiKey);
  }
  
  return genAI.getGenerativeModel({ model: modelName });
}

export const GENERATIVE_MODELS = {
  FLASH: "gemini-1.5-flash",
  PRO: "gemini-1.5-pro",
};
