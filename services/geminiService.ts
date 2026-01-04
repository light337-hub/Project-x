import { GoogleGenAI, Type } from "@google/genai";
import { WaveConfig } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelName = 'gemini-3-flash-preview';

export const fallbackWave: WaveConfig = {
  enemies: [
    { type: 'scout', count: 5, speed: 2, hp: 10, color: '#34d399', formation: 'v' },
    { type: 'fighter', count: 2, speed: 1.5, hp: 30, color: '#60a5fa' }
  ],
  flavorText: "System initialized. Engaging standard defense protocols."
};

export const generateWave = async (level: number, playerPerformance: string): Promise<WaveConfig> => {
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `
        Generate a tactical wave of enemies for a space shooter game.
        Current Level: ${level}.
        Player Performance Context: ${playerPerformance}.
        
        Rules:
        - Enemy Types:
          - 'scout': Fast, weak, erratic movement. Moves in 'v' formations.
          - 'decoy': Sabotage unit. Mimics player appearance and fires deceptive blue pulses. Mirros player X position.
          - 'fighter': Balanced speed/HP.
          - 'tank': Slow, high HP.
          - 'turret': Stationary (very slow), high fire rate, high HP. 
          - 'kamikaze': Very fast, chases player, explodes.
          - 'bomber': Slow moving, drops mines.
          - 'support': Heals nearby allies.
          - 'swarm': Spawns in large groups (10+).
          - 'cloaked': Phases in and out of visibility.
          - 'boss': Massive HP, big size, slow, high fire rate.
        - Formations: Use 'v' for groups of scouts or decoys, 'line' for tanks/bombers, 'random' for others.
        - As level increases, enemies should get harder.
        - Colors should be valid hex codes.
        - Flavor text should be sci-fi military style.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            enemies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['scout', 'fighter', 'tank', 'boss', 'turret', 'kamikaze', 'bomber', 'support', 'swarm', 'cloaked', 'decoy'] },
                  count: { type: Type.NUMBER },
                  speed: { type: Type.NUMBER },
                  hp: { type: Type.NUMBER },
                  color: { type: Type.STRING },
                  formation: { type: Type.STRING, enum: ['v', 'line', 'random'] }
                },
                required: ['type', 'count', 'speed', 'hp', 'color']
              }
            },
            flavorText: { type: Type.STRING }
          },
          required: ['enemies', 'flavorText']
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as WaveConfig;
    }
    return fallbackWave;
  } catch (error) {
    console.error("Gemini generation failed:", error);
    return fallbackWave;
  }
};