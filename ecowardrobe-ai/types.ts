
export enum ItemStatus {
  ACTIVE = 'ACTIVE',
  RESERVED = 'RESERVED',
  DONATED = 'DONATED',
  TRANSFORMED = 'TRANSFORMED'
}

export type Category = 
  | 'Shirts' 
  | 'Skirts' 
  | 'Jeans' 
  | 'Pajamas' 
  | 'Socks' 
  | 'Shoes' 
  | 'Dresses' 
  | 'Outerwear' 
  | 'Other';

export interface WardrobeItem {
  id: string;
  name: string;
  category: Category;
  color: string;
  material: string;
  imageUrl: string;
  purchaseDate: string;
  lastWornDate: string | null;
  wearCount: number;
  status: ItemStatus;
  reserveReason?: string;
}

export interface StyleProfile {
  preferredStyles: string[];
  preferredColors: string[];
  dislikedElements: string[];
}

export interface AnalysisResponse {
  itemId: string;
  reasoning: string;
  suggestedAction: 'DONATE' | 'TRANSFORM' | 'RESERVE';
  wearProbability: number;
}

export interface TransformationGuide {
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  toolsNeeded: string[];
  steps: string[];
}

export interface AICategorization {
  name: string;
  category: Category;
  color: string;
  material: string;
}
