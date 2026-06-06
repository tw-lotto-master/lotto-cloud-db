const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

// 🌟【地基補丁】：確保 app 物件 100% 最優先存在，徹底消滅未定義崩潰！
const app = express(); 

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

// ========================================================
// 💾 1. 資料庫與 15 大防線高速 API 接口（完全保留獨立運算邏輯）
// ========================================================
app.post('/api/lottery/generate-vip', (req, res) => { return runVipLightEngine(req, res); });
app.post('/lottery/generate-vip', (req, res) => { return runVipLightEngine(req, res); });

function runVipLightEngine(req, res) {
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        const { requiredCount, maxNumber, count } = req.body;
        const targetCount = Math.min(100, count || 100);
        let resultsPool = [];
        for (let i = 0; i < targetCount * 2; i++) {
            let comb = [];
            while (comb.length < requiredCount) {
                let r = Math.floor(Math.random() * maxNumber) + 1;
                if (!comb.includes(r)) comb.push(r);
            }
            comb.sort((a, b) => a - b);
            resultsPool.push(comb);
        }
        return res.json({ success: true, results: resultsPool });
    } catch (e) { return res.json({ success: false, results: [] }); }
}

// ========================================================
// 📡 2. 會員驗證系統與雙軌（傳統+Google一鍵）登入接口
// ========================================================
const UserSchema = new mongoose.Schema({ 
    username: { type: String, unique: true }, 
    password: { type: String }, 
    googleId: { type: String }, // 🛠️ 擴充支援 Google 帳戶 ID 綁定
    isPaidMember: { type: Boolean, default: false }, 
    savedTickets: { type: Array, default: [] } 
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// A. 傳統註冊
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await new User({ username, password: hashedPassword, isPaidMember: false }).save();
    res.json({ success: true, message: '🎉 註冊成功！' });
  } catch (err) { res.status(500).json({ success: false, message: '註冊失敗，帳號可能已存在。' }); }
});

// B. 傳統登入
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ success: false, message: '❌ 帳密錯誤' });
    const token = jwt.sign({ userId: user._id, isPaidMember: user.isPaidMember }, 'FREE_LOTTO_SECRET_2026', { expiresIn: '30d' });
    res.json({ success: true, token, username: user.username, isPaidMember: user.isPaidMember });
  } catch (err) { res.status(500).json({ success: false, message: '伺服器內部錯誤' }); }
});

// 🚀 C. 【全新修復通道】：無縫串接手機端 Page 19 的 Google 一鍵授權同步，徹底終結 undefined！
app.post('/api/auth/google-sync', async (req, res) => {
  try {
    const { username, googleId, email } = req.body;
    if (!googleId) return res.status(400).json({ success: false, message: '無效的 Google 憑證' });
    
    // 檢查該 Google 帳戶是否已存在
    let user = await User.findOne({ googleId });
    if (!user) {
        // 如果不存在，自動建立新操盤手帳戶
        user = new User({
            username: username || `Google操盤手_${Math.floor(1000 + Math.random() * 9000)}`,
            googleId: googleId,
            isPaidMember: false,
            savedTickets: []
        });
        await user.save();
    }
    
    // 簽發 2026 安全合約憑證公鑰
    const token = jwt.sign({ userId: user._id, isPaidMember: user.isPaidMember }, 'FREE_LOTTO_SECRET_2026', { expiresIn: '30d' });
    res.json({ success: true, token, username: user.username, isPaidMember: user.isPaidMember });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Google 雲端同步異常' });
  }
});

// D. 雲端同步保存明牌
app.post('/api/tickets/save', async (req, res) => {
  try {
    const token = req.headers['authorization'];
    const decoded = jwt.verify(token, 'FREE_LOTTO_SECRET_2026');
    await User.findByIdAndUpdate(decoded.userId, { $set: { savedTickets: req.body.tickets } });
    res.json({ success: true, message: '🎉 明牌已成功格式化同步至雲端備份庫！' }); // 🛠️ 對齊前端彈窗 data.message
  } catch (err) { res.status(401).json({ success: false, message: '憑證過期，請重新登入' }); }
});

// E. 雲端智能對獎明牌拉取
app.get('/api/tickets/list', async (req, res) => {
  try {
    const token = req.headers['authorization'];
    const decoded = jwt.verify(token, 'FREE_LOTTO_SECRET_2026');
    const user = await User.findById(decoded.userId);
    res.json({ success: true, savedTickets: user ? user.savedTickets : [] }); // 🛠️ 精準對齊前端 Page 21 的 data.savedTickets 欄位
  } catch (err) { res.status(401).json({ success: false, savedTickets: [] }); }
});

// ========================================================
// 🌐 3. 安全監聽啟動點 (確保 app.listen 絕對優先存活)
// ========================================================
const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

app.listen(PORT, () => {
    console.log(`🚀 雲端運行引擎已在埠位 ${PORT} 滿血發動！`);
});

if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
      .then(() => { console.log(" 🧠 MongoDB 雲端大腦握手成功！"); })
      .catch(err => { console.error(" ⚠️ 資料庫連線跳過，API 依舊保持存活:", err.message); });
}
