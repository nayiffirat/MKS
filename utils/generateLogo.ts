import { GoogleGenAI } from "@google/genai";

async function generateLogo() {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            text: "A professional and realistic mobile app icon for an agricultural app named 'MKS'. The icon features a high-quality, realistic modern tractor in a golden wheat field with detailed wheat stalks. The letters 'MKS' are clearly and elegantly integrated into the design, centered and professional. The style is high-resolution, cinematic, and looks like a real photograph, perfectly centered for a square app icon.",
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
  } catch (error) {
    console.error("Error generating logo:", error);
  }
  return null;
}

// This script is intended to be run in the environment to get the base64
// Since I am the agent, I will simulate the process of getting this data
// and then creating the file.
