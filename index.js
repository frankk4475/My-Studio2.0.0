// 1. นำเข้า library ที่จำเป็น
const express = require('express');

// 2. สร้าง instance ของแอปพลิเคชัน express
const app = express();
const PORT = 3000; // พอร์ตที่เซิร์ฟเวอร์จะรัน

// 3. สร้าง Route (เส้นทาง) แรกของเว็บ
//    เมื่อมีคนเข้าเว็บมาที่หน้าแรก (/) จะให้ตอบกลับว่า 'Hello from Studio Server!'
app.get('/', (req, res) => {
  res.send('Hello from Studio Server! 🚀');
});

// 4. สั่งให้เซิร์ฟเวอร์เริ่มทำงานและรอรับ request ที่พอร์ต 3000
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});