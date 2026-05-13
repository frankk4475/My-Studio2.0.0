const { GoogleGenerativeAI } = require('@google/generative-ai');
const Settings = require('../models/Settings');

// Ensure env is loaded
require('dotenv').config();

let apiKey = process.env.GEMINI_API_KEY || '';
let genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Refresh API Key from DB
 */
async function refreshConfig() {
  try {
    const settings = await Settings.findOne();
    if (settings && settings.apiKeys && settings.apiKeys.geminiApiKey) {
      apiKey = settings.apiKeys.geminiApiKey;
      genAI = new GoogleGenerativeAI(apiKey);
      console.log('✅ Gemini Service: API Key loaded from DB settings');
    }
  } catch (err) {
    console.error('❌ Gemini Service: Failed to refresh config from DB:', err.message);
  }
}

// Initial load attempt
refreshConfig();

/**
 * Reusable function to call Gemini API with retries and error handling
 */
async function callGemini(prompt, options = {}) {
  if (!genAI) await refreshConfig();
  if (!genAI) {
    throw new Error('Gemini API Key is not configured. Please set it in Settings.');
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

/**
 * Specialized function to parse booking details from a message
 */
async function parseBooking(text) {
  const prompt = `Extract booking information from the following Thai or English message. 
  The user might type in any format (structured or natural language). 
  Your goal is to extract the details as accurately as possible.

  Message to analyze:
  ---
  "${text}"
  ---

  Return a JSON object with EXACTLY these fields:
  {
    "bookingType": "string (e.g., Wedding, Portrait, Event) or null",
    "date": "YYYY-MM-DD (Universal ISO format) or null",
    "startTime": "HH:mm or null",
    "endTime": "HH:mm or null",
    "contactPhone": "string or null",
    "details": "string (any extra info provided) or null",
    "isBooking": boolean (true if the message clearly intends to book or inquire about a specific slot)
  }
  
  Critical Guidelines:
  - Current Date Context: Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
  - Thai Month Handling: Recognize Thai months (ม.ค., ก.พ., ..., ธ.ค.) and convert to numeric months.
  - Thai Year Handling: If the user provides a Buddhist Era year (e.g., 2569), convert it to Common Era (2026).
  - Time Range: If the user says "10 โมง ถึง เที่ยง", convert to "10:00" and "12:00".
  - Flexible Parsing: Even if the text is messy, try your best to find a date and time.
  - Response Format: Return ONLY valid JSON. No conversational text or markdown code blocks.`;

  try {
    const response = await callGemini(prompt, { model: 'gemini-flash-latest' });
    // Clean JSON if Gemini adds markdown code blocks
    const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error('❌ Gemini Parsing Error:', err.message);
    return null;
  }
}

module.exports = { callGemini, refreshConfig, parseBooking };
