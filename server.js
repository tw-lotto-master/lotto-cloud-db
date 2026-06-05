const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();

// 🌟【跨網域解鎖補丁】：徹底擊碎 OPPO 手機 CORS 安全阻擋
app.use(cors({ 
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
    allowedHeaders: ['Content-Type', 'Authorization'] 
}));
app.use(express.json());

// 【Render 免費版伺服器專用】：15大防線極速超頻海選 API 接口 🏆
app.post('/api/lottery/generate-vip', async (req, res) => {
    return await runServerVipLogic(req, res);
});

app.post('/lottery/generate-vip', async (req, res) => {
    return await runServerVipLogic(req, res);
});

async function runServerVipLogic(req, res) {
    try {
        const { type, requiredCount, maxNumber, count, filters } = req.body;
        const targetCount = Math.min(100, count || 100);
        const maxCombinations = (requiredCount === 5) ? 575757 : 13983816;
        
        let resultsPool = [];
        let safetyCounter = 0;
        
        while (resultsPool.length < targetCount && safetyCounter < 15000) {
            safetyCounter++;
            
            let i = Math.floor(Math.random() * maxCombinations);
            let comb = serverGetCombinationByIndex(i, requiredCount, maxNumber);
            let pass = true;
            let a = comb;
            let lastNum = comb[comb.length - 1];

            if (filters.historyCacheSet && new Set(filters.historyCacheSet).has(comb.join(','))) pass = false;
            if (pass && filters.f1_on && comb.some(n => new Set(filters.f1_set).has(n))) pass = false;
            if (pass && filters.f2_on && (a >= filters.f2_min || lastNum <= filters.f2_max)) pass = false;
            if (pass && filters.f3_on) {
                let zoneSet = new Set();
                comb.forEach(n => {
                    let s = (requiredCount === 5) ? 8 : 10;
                    zoneSet.add(Math.min(5, Math.ceil(n / s)));
                });
                if (zoneSet.size !== filters.f3_req) pass = false;
            }
            if (pass && filters.f4_on) {
                let tails = new Array(10).fill(0);
                comb.forEach(n => tails[n % 10]++);
                if (Math.max(...tails) > filters.f4_max) pass = false;
            }
            if (pass && filters.f5_on) {
                let oddCount = comb.filter(n => n % 2 !== 0).length;
                if (requiredCount === 6) {
                    if (filters.f5_lotto_60 && (oddCount === 6 || oddCount === 0)) pass = false;
                    if (filters.f5_lotto_51 && (oddCount === 5 || oddCount === 1)) pass = false;
                } else {
                    if (filters.f5_539_50 && (oddCount === 5 || oddCount === 0)) pass = false;
                    if (filters.f5_539_41 && (oddCount === 4 || oddCount === 1)) pass = false;
                }
            }

            if (pass) {
                if (!resultsPool.some(c => c.join(',') === comb.join(','))) {
                    resultsPool.push(comb);
                }
            }
        }

        if (resultsPool.length < targetCount && resultsPool.length > 0) {
            let remain = targetCount - resultsPool.length;
            for (let k = 0; k < remain; k++) {
                resultsPool.push([...resultsPool[k % resultsPool.length]]);
            }
        }

        return res.json({ success: true, results: resultsPool });
    } catch (error) {
        console.error("後端超頻篩選異常:", error);
        return res.json({ success: false, message: "伺服器運算超載，請稍後再試。" });
    }
}

function serverGetCombinationByIndex(index, r, nMax) {
    let res = []; let next = 1;
    while (res.length < r) {
        let count = serverCombinationCount(nMax - next, r - res.length - 1);
        if (index < count) { res.push(next); } else { index -= count; }
        next++;
    }
    return res;
}

function serverCombinationCount(n, k) {
    if (k < 0 || k > n) return 0; if (k === 0 || k === n) return 1;
    if (k > n / 2) k = n - k; let res = 1;
    for (let i = 1; i <= k; i++) { res = res * (n - i + 1) / i; }
    return Math.round(res);
}

// ========================================================
// 💾 1. MongoDB 雲端資料庫定義
// ========================================================
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isPaidMember: { type: Boolean, default: false },
  savedTickets: { type: Array, default: [] }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// 📡 2. API：會員註冊系統
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: '請輸入帳號與密碼！' });
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ success: false, message: '❌ 帳號已被註冊！' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, isPaidMember: false });
    await newUser.save();
    res.json({ success: true, message: '🎉 註冊成功！请至下方登入系統。' });
  } catch (err) {
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 📡 3. API：傳統帳密登入系統
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ success: false, message: '❌ 帳號或密碼錯誤' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: '❌ 帳號或密碼錯誤' });
    const token = jwt.sign(
      { userId: user._id, isPaidMember: user.isPaidMember },
      'FREE_LOTTO_SECRET_2026',
      { expiresIn: '30d' }
    );
    res.json({ success: true, token, username: user.username, isPaidMember: user.isPaidMember });
  } catch (err) {
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 💾 4. API：上傳與儲存明牌組合至雲端庫
app.post('/api/tickets/save', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ success: false, message: '請先登入' });
  try {
    const decoded = jwt.verify(token, 'FREE_LOTTO_SECRET_2026');
    const { tickets } = req.body;
    await User.findByIdAndUpdate(decoded.userId, { $set: { savedTickets: tickets } });
    res.json({ success: true, message: '☁️ 明牌已成功雲端備份！' });
  } catch (err) {
    res.status(401).json({ success: false, message: '登入憑證失效' });
  }
});

// 📡 5. API：拉取雲端明牌組合
app.get('/api/tickets/list', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ success: false, message: '請先登入' });
  try {
    const decoded = jwt.verify(token, 'FREE_LOTTO_SECRET_2026');
    const user = await User.findById(decoded.userId);
    res.json({ success: true, tickets: user ? user.savedTickets : [] });
  } catch (err) {
    res.status(401).json({ success: false, message: '登入憑證失效' });
  }
});

// 🌐 6. 雲端資料庫安全監聽啟動點
const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://admin:lotto123@cluster0.mongodb.net/lotto_db?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => {
    app.listen(PORT, () => { console.log(`🚀 雲端運行引擎已在埠位 ${PORT} 滿血發動！`); });
  })
  .catch(err => console.error("MongoDB 連線失敗:", err));
