
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
        text: `Analyze this clothing item and return details in JSON format.
        Categories MUST be one of: Shirts, Skirts, Jeans, Pajamas, Socks, Shoes, Dresses, Outerwear, Other.
        Identify the primary color and material.`
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

  return JSON.parse(response.text || '{}');
};

export const analyzeWardrobeUsage = async (
  items: WardrobeItem[],
  profile: StyleProfile
): Promise<AnalysisResponse[]> => {
  const ai = getAI();
  
  const prompt = `
    As a sustainable fashion expert, analyze this wardrobe against the user's style profile.
    Identify items that are likely neglected or underused.
    
    User Style Profile:
    - Preferred Styles: ${profile.preferredStyles.join(', ')}
    - Preferred Colors: ${profile.preferredColors.join(', ')}
    - Disliked: ${profile.dislikedElements.join(', ')}
    
    Wardrobe Items:
    ${items.map(i => `- ID: ${i.id}, Name: ${i.name}, Category: ${i.category}, Color: ${i.color}, Wear Count: ${i.wearCount}`).join('\n')}
    
    Provide an analysis for each item with ID, reasoning for usage patterns, and a suggested path (DONATE, TRANSFORM, or RESERVE).
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

  return JSON.parse(response.text || '[]');
};

export const generateTransformationGuide = async (
  item: WardrobeItem,
  profile: StyleProfile
): Promise<TransformationGuide> => {
  const ai = getAI();
  
  const prompt = `
    Create a DIY transformation guide to turn this "${item.name}" into something that fits the user's "${profile.preferredStyles.join(', ')}" style.
    The goal is to reduce waste and ensure the user actually wears the item.
    
    Item Details: ${item.color} ${item.material} ${item.category}.
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

  return JSON.parse(response.text || '{}');
};
