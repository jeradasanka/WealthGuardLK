/**
 * Shared utilities for PDF parsing with Gemini AI
 * Centralizes common functionality to avoid duplication across parsers
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Convert File to base64 string for Gemini API
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Parse PDF with Gemini AI using a custom prompt
 * Generic function for all PDF parsing operations
 * 
 * @param file - PDF file to parse
 * @param apiKey - Gemini API key
 * @param prompt - Custom prompt for the specific parsing task
 * @param model - Gemini model to use (default: gemini-2.0-flash-exp)
 * @returns Parsed response from Gemini AI
 */
export async function parseWithGeminiAI<T>(
  file: File,
  apiKey: string,
  prompt: string,
  model: string = 'gemini-2.0-flash-exp'
): Promise<T> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });
    
    // Convert PDF to base64
    const base64Data = await fileToBase64(file);
    
    // Send to Gemini AI with the PDF and prompt
    const result = await geminiModel.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type || 'application/pdf',
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Clean and parse JSON response
    const cleanedText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return JSON.parse(cleanedText) as T;
  } catch (error) {
    console.error('Gemini AI parsing error:', error);
    throw error;
  }
}

/**
 * Clean and extract JSON from Gemini AI response
 * Handles common formatting issues in AI responses
 */
export function cleanGeminiResponse(text: string): string {
  return text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
}
