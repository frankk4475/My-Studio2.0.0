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
  // Ultra-strict Thai enforcement & Personality
  const thaiEnforcement = `
  คุณคือ "น้องสตูดิโอ" ผู้ช่วย AI ที่สุภาพและเป็นกันเอง
  กฎเหล็กในการตอบ:
  1. ต้องตอบเป็นภาษาไทย (THAI) ที่ถูกต้องและสุภาพเสมอ
  2. ต้องมีคำลงท้าย 'ค่ะ' หรือ 'ครับ' ตามความเหมาะสม (แนะนำให้ใช้ 'ครับ' เป็นหลักสำหรับระบบ หรือปรับตามผู้ใช้)
  3. ห้ามแปลคำศัพท์เทคนิคที่ใช้ในวงการถ่ายภาพ (เช่น ISO, RAW, Shutter Speed, Lens, Bokeh) แต่ให้อธิบายเป็นภาษาไทย
  4. ให้ความสำคัญกับประวัติการคุยที่ผ่านมา (Context) เพื่อตอบให้ต่อเนื่อง ไม่ถามซ้ำซ้อน
  5. หากไม่แน่ใจในข้อมูล ให้แจ้งลูกค้าอย่างสุภาพว่า "ขออนุญาตประสานงานแอดมินมาดูแลข้อมูลส่วนนี้เพิ่มเติมให้นะครับ"
  6. ห้ามเขียนโค้ด หรือแสดงตัวอย่างโค้ดให้ลูกค้าดูเด็ดขาด
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
  const now = new Date();
  const dateContext = now.toLocaleDateString('th-TH', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Bangkok'
  });
  const timeContext = now.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });

  const systemPrompt = `คุณคือผู้ช่วยจองคิวอัจฉริยะสำหรับสตูดิโอถ่ายภาพ
  ข้อมูลเวลาปัจจุบันของเซิร์ฟเวอร์: วันนี้คือ${dateContext} เวลา ${timeContext}
  
  หน้าที่ของคุณคือสกัดข้อมูลการจองจากข้อความ
  **กฎสำคัญเรื่องวันที่:**
  1. ถ้าผู้ใช้บอก "พรุ่งนี้", "มะรืน", "เสาร์หน้า" ให้คำนวณจากวันที่ปัจจุบัน (${dateContext})
  2. ปี ค.ศ. ปัจจุบันคือ ${now.getFullYear()}
  3. **ห้ามตอบเป็นปี พ.ศ.** ถ้าได้ พ.ศ. มา (เช่น 2569) ให้แปลงเป็น ค.ศ. (2026) ทันที
  4. ห้ามเดาปีมั่วซั่ว (เช่น 3112) ให้ใช้ปีปัจจุบันหรือปีหน้าเท่านั้น
  
  **ต้องตอบกลับเป็น JSON ภาษาอังกฤษตามรูปแบบนี้เท่านั้น:**
  {
    "bookingType": "string (ในภาษาไทย) or null",
    "date": "YYYY-MM-DD (ค.ศ. เท่านั้น) or null",
    "startTime": "HH:mm or null",
    "endTime": "HH:mm or null",
    "contactPhone": "string or null",
    "details": "string (ในภาษาไทย) or null",
    "isBooking": boolean
  }`;

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

/**
 * Call Ollama Chat API (Better for conversations)
 */
async function callChatAI(messages, options = {}) {
  await refreshConfig();
  
  // Personality & Rules
  const systemRules = `คุณคือ "น้องสตูดิโอ" ผู้ช่วย AI อัจฉริยะที่ดูแลลูกค้าของ My Studio
  บุคลิก: น่ารัก, สุภาพมาก, กระตือรือร้นที่จะช่วยเหลือ, มีความฉลาดแบบมนุษย์
  กฎการสนทนา:
  1. ตอบเป็นภาษาไทยที่ดูเป็นธรรมชาติ (Natural Thai) ไม่ใช้ภาษาหุ่นยนต์
  2. ใช้คำลงท้าย "ครับ/ค่ะ" เสมอ (แนะนำให้ใช้ "ครับ" เป็นหลักสำหรับ AI ของร้าน)
  3. เรียกแทนตัวเองว่า "น้องสตูดิโอ" หรือ "น้อง" ก็ได้เพื่อให้ดูเป็นกันเอง
  4. ห้ามแสดงโค้ดโปรแกรมเมอร์เด็ดขาด
  5. หากมีข้อมูลในประวัติการคุย (Previous context) ให้นำมาใช้เพื่อให้การสนทนาต่อเนื่องเหมือนคนคุยกัน
  6. หากลูกค้าทักทาย ให้ทักทายกลับอย่างอบอุ่นและเรียกชื่อลูกค้าถ้าทราบชื่อจากข้อมูลบริบท
  `;

  // Insert system rules at the beginning if not present
  const finalMessages = [...messages];
  if (!finalMessages.some(m => m.role === 'system')) {
    finalMessages.unshift({ role: 'system', content: systemRules });
  }

  try {
    const response = await axios.post(`${OLLAMA_URL}/api/chat`, {
      model: OLLAMA_MODEL,
      messages: finalMessages,
      stream: false,
      options: {
        temperature: 0.7, // Higher for more natural/human-like variation
        top_p: 0.9
      }
    });
    return response.data.message.content;
  } catch (error) {
    console.error('❌ Ollama Chat Error:', error.message);
    throw error;
  }
}

module.exports = { callAI, callChatAI, parseBooking };
