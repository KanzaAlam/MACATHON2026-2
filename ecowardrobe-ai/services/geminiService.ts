
import { GoogleGenAI, Type } from "@google/genai";
import { WardrobeItem, StyleProfile, AnalysisResponse, TransformationGuide, AICategorization } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const categorizeItemFromImage = async (base64Data: string): Promise<AICategorization> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data
        }
      },
      {
        text: `You are a professional fashion assistant. Analyze this image and identify the clothing item. 
        Categorize it strictly into one of these: Shirts, Skirts, Jeans, Pajamas, Socks, Shoes, Dresses, Outerwear, Other.
        Also provide a short descriptive name (e.g., 'Blue Denim Jacket'), the primary color, and the material (e.g., 'Cotton', 'Denim', 'Wool').
        Return the result in JSON format.`
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          category: { type: Type.STRING },
          color: { type: Type.STRING },
          material: { type: Type.STRING }
        },
        required: ['name', 'category', 'color', 'material']
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text);
};

export const analyzeWardrobeUsage = async (
  items: WardrobeItem[],
  profile: StyleProfile
): Promise<AnalysisResponse[]> => {
  const ai = getAI();
  
  const prompt = `
    As a sustainable fashion expert, analyze this wardrobe against the user's style profile.
    Identify items that are likely neglected or underused based on the user's preferences.
    
    User Style Profile:
    - Preferred Styles: ${profile.preferredStyles.join(', ')}
    - Preferred Colors: ${profile.preferredColors.join(', ')}
    - Disliked: ${profile.dislikedElements.join(', ')}
    
    Wardrobe Items:
    ${items.map(i => `- ID: ${i.id}, Name: ${i.name}, Category: ${i.category}, Color: ${i.color}, Wear Count: ${i.wearCount}`).join('\n')}
    
    For each item that doesn't fit the profile well or hasn't been worn much, provide reasoning and a suggestion.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            itemId: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            suggestedAction: { type: Type.STRING, enum: ['DONATE', 'TRANSFORM', 'RESERVE'] },
            wearProbability: { type: Type.NUMBER }
          },
          required: ['itemId', 'reasoning', 'suggestedAction', 'wearProbability']
        }
      }
    }
  });

  const text = response.text;
  return JSON.parse(text || '[]');
};

export const generateTransformationGuide = async (
  item: WardrobeItem,
  profile: StyleProfile
): Promise<TransformationGuide> => {
  const ai = getAI();
  
  const prompt = `
    Create a creative DIY transformation guide to turn this "${item.name}" (${item.color} ${item.material}) 
    into something that fits the user's preferred style: "${profile.preferredStyles.join(', ')}".
    Focus on making it something they will actually wear frequently.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          difficulty: { type: Type.STRING, enum: ['Easy', 'Medium', 'Hard'] },
          toolsNeeded: { type: Type.ARRAY, items: { type: Type.STRING } },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['title', 'difficulty', 'toolsNeeded', 'steps']
      }
    }
  });

  const text = response.text;
  return JSON.parse(text || '{}');
};
