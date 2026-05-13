const axios = require('axios');
const Settings = require('../models/Settings');

/**
 * Ollama Service for Local AI
 * Default endpoint: http://localhost:11434
 */

let OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
let OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3'; // or 'phi3', 'mistral'

/**
 * Load settings from DB
 */
async function refreshConfig() {
  try {
    const settings = await Settings.findOne();
    if (settings && settings.apiKeys) {
      OLLAMA_URL = settings.apiKeys.ollamaUrl || OLLAMA_URL;
      OLLAMA_MODEL = settings.apiKeys.ollamaModel || OLLAMA_MODEL;
      console.log(`✅ Ollama Service: Config loaded (Model: ${OLLAMA_MODEL}, URL: ${OLLAMA_URL})`);
    }
  } catch (err) {
    console.error('❌ Ollama Service: Failed to refresh config from DB:', err.message);
  }
}

// Initial load
refreshConfig();

/**
 * Call Ollama Generate API
 */
async function callAI(prompt, systemPrompt = '') {
  if (OLLAMA_URL.includes('localhost')) {
      // Small check to remind user if they haven't set it up
  }
  // Ultra-strict Thai enforcement
  const thaiEnforcement = `
  IMPORTANT RULES:
  1. ALWAYS respond in THAI language (ภาษาไทย).
  2. Use polite Thai particles like 'ครับ'.
  3. DO NOT translate technical terms if they are commonly used in English (e.g., ISO, RAW, Lens), but the explanation must be in THAI.
  4. If you are asked to provide JSON, the values (strings) should be in THAI.
  `;
  
  const finalSystemPrompt = systemPrompt + thaiEnforcement;

  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: prompt,
      system: finalSystemPrompt,
      stream: false,
      options: {
        temperature: 0.2, // Even lower for maximum instruction following
        top_p: 0.9
      }
    });
    return response.data.response;
  } catch (error) {
    console.error('❌ Ollama Service Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Ollama is not running. Please run "ollama run llama3" on your machine.');
    }
    throw error;
  }
}

/**
 * Specialized function to parse booking details (Replacement for legacy AI version)
 */
async function parseBooking(text) {
  const systemPrompt = `คุณคือผู้ช่วยจองคิวอัจฉริยะสำหรับสตูดิโอถ่ายภาพ
  หน้าที่ของคุณคือสกัดข้อมูลการจองจากข้อความภาษาไทยหรืออังกฤษ
  **สำคัญมาก: ต้องตอบกลับเป็น JSON ภาษาอังกฤษตามรูปแบบที่กำหนดเท่านั้น**
  
  JSON Schema:
  {
    "bookingType": "string (ในภาษาไทย) or null",
    "date": "YYYY-MM-DD or null",
    "startTime": "HH:mm or null",
    "endTime": "HH:mm or null",
    "contactPhone": "string or null",
    "details": "string (ในภาษาไทย) or null",
    "isBooking": boolean
  }

  Important: 
  - If year is Buddhist Era (e.g. 2569), convert to AD (2026).
  - Current year is 2026.`;

  try {
    const response = await callAI(text, systemPrompt);
    // Clean JSON if the model includes markdown
    const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error('❌ Ollama Parsing Error:', err.message);
    return null;
  }
}

module.exports = { callAI, parseBooking };
