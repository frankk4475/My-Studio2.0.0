const { GoogleGenerativeAI } = require('@google/generative-ai');

// Ensure env is loaded
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Reusable function to call Gemini API with retries and error handling
 */
async function callGemini(prompt, options = {}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in .env');
  }

  // Use gemini-flash-latest which is confirmed to work in this environment
  const model = genAI.getGenerativeModel({ model: options.model || 'gemini-flash-latest' });

  let retries = options.retries || 2;
  let lastError;

  while (retries >= 0) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      lastError = error;
      console.warn(`Gemini API call failed, retries left: ${retries}`, error.message);
      retries--;
      if (retries >= 0) await new Promise(res => setTimeout(res, 1000));
    }
  }

  throw new Error(`Gemini API failed after retries: ${lastError.message}`);
}

module.exports = { callGemini };
