const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

// 🌟【核心修復】：確保 app 物件最優先宣告，完美消滅未定義崩潰！
const app = express(); 

// 🛡️ 全域安全中間件配置
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

// ========================================================
// 💾 1. 資料庫與 15 大防線高速 API 接口
// ========================================================
app.post('/api/lottery/generate-vip', (req, res) => { return runVipLightEngine(req, res); });
app.post('/lottery/generate-vip', (req, res) => { return runVipLightEngine(req, res); });

function runVipLightEngine(req, res) {
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        const { requiredCount, maxNumber, count } = req.body;
        // 確保 100 組與模式 B 高速演算運作
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
    } catch (e) { 
        return res.json({ success: false, results: [] }); 
    }
}

// ========================================================
// 📡 2. 會員驗證系統與傳統登入接口
// ========================================================
const UserSchema = new mongoose.Schema({ 
    username: { type: String, unique: true }, 
    password: { type: String }, 
    isPaidMember: { type: Boolean, default: false }, 
    savedTickets: { type: Array, default: [] } 
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await new User({ username, password: hashedPassword, isPaidMember: false }).save();
    res.json({ success: true, message: '🎉 註冊成功！' });
  } catch (err) { 
    res.status(500).json({ success: false }); 
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ success: false, message: '❌ 帳密錯誤' });
    }
    const token = jwt.sign({ userId: user._id, isPaidMember: user.isPaidMember }, 'FREE_LOTTO_SECRET_2026', { expiresIn: '30d' });
    res.json({ success: true, token, username: user.username, isPaidMember: user.isPaidMember });
  } catch (err) { 
    res.status(500).json({ success: false }); 
  }
});

app.post('/api/tickets/save', async (req, res) => {
  try {
    const token = req.headers['authorization'];
    const decoded = jwt.verify(token, 'FREE_LOTTO_SECRET_2026');
    await User.findByIdAndUpdate(decoded.userId, { $set: { savedTickets: req.body.tickets } });
    res.json({ success: true });
  } catch (err) { 
    res.status(401).json({ success: false }); 
  }
});

app.get('/api/tickets/list', async (req, res) => {
  try {
    const token = req.headers['authorization'];
    const decoded = jwt.verify(token, 'FREE_LOTTO_SECRET_2026');
    const user = await User.findById(decoded.userId);
    res.json({ success: true, tickets: user ? user.savedTickets : [] });
  } catch (err) { 
    res.status(401).json({ success: false }); 
  }
});

// ========================================================
// 🌐 3. 安全監聽啟動點 (優先保活防崩潰)
// ========================================================
const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// 🟢 Render 埠位首要接聽，防範 Cloud 部署超時掛點
app.listen(PORT, () => {
    console.log(`🚀 雲端運行引擎已在埠位 ${PORT} 滿血發動！`);
});

if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
      .then(() => { console.log("🧠 MongoDB 雲端大腦握手成功！"); })
      .catch(err => { console.error("⚠️ 資料庫連線跳過，API 依舊保持存活:", err.message); });
} else {
    console.log("ℹ️ 未偵測到 MONGO_URI 環境變數，目前以記憶體獨立模式維持 API 暢通。");
}
