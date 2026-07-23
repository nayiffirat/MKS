import { API_BASE } from './api';

export const generateAIContent = async (modelName: string, contents: any, config?: any) => {
  try {
    const response = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        contents: contents,
        config: config
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.text;
  } catch (error: any) {
    // Avoid cyclic structures when logging
    const errorMessage = error?.message || String(error);
    console.error("Gemini API Proxy Error:", errorMessage);
    throw new Error(errorMessage);
  }
};
