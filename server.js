const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();

// 【解說】：必須開啟 JSON 解析與 CORS 跨網域存取。
// 因為手機 App 封裝後，本質上是一個獨立的原生殼（Origin 為 file:// 或 localhost），
// 後端必須開啟 CORS，否則手機端發送的登入請求會被網頁瀏覽器安全機制全面封殺。
app.use(express.json());
app.use(cors());

// 🔗 1. 連線至您剛剛申請的 MongoDB Atlas 永久免費雲端資料庫
// 請將下方字串替換為您在 Atlas 複製的真實連線字串，並把 <password> 換成您的資料庫密碼
// ⚡ 核心優化：優先讀取 Render 後台環境變數，徹底拔除寫死範例的死穴
const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://bingooo16888_db_user:bingo19880429@cluster0.t33ebvn.mongodb.net/lotto?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(MONGO_URI)
  .then(() => console.log('☁️ 永久免費 MongoDB Atlas 雲端資料庫連線成功！'))
  .catch(err => console.error('❌ 資料庫連線失敗', err));

// 📊 2. 定義用戶在雲端的核心數據欄位
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true }, // 帳號唯一值
  password: { type: String, required: true },               // 加密後的密碼
  isPaidMember: { type: Boolean, default: false },          // 鑽石付費會員標記
  savedTickets: { type: [String], default: [] }             // 該會員同步在雲端的對獎明牌組合
});
const User = mongoose.model('User', UserSchema);

// 🔐 3. API：會員註冊
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: '請輸入完整帳密' });

    // 【解說】：絕對不可在資料庫存明文密碼（防駭客與個資法）。
    // 使用 bcrypt 進行 10 次雜湊加鹽加密，確保密碼即使外洩也無法被反向破譯。
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    
    res.status(201).json({ success: true, message: '🎉 註冊成功！請直接點擊登入。' });
  } catch (error) {
    res.status(400).json({ success: false, message: '❌ 帳號已被佔用，請換一個名字。' });
  }
});

// 🔐 4. API：會員登入並簽發數位通行證 (JWT)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ success: false, message: '❌ 帳號或密碼錯誤' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ success: false, message: '❌ 帳號或密碼錯誤' });

  // 【解說】：JWT (JSON Web Token) 是不需伺服器儲存快取的數位通行證。
  // 我們把用戶 ID 與 VIP 權限打包進加密字串，有效期限 30 天，發給手機端。
  // 手機 App 收到後存在本地，之後每次過濾選號或對獎，都出示這張通行證即可，極省流量。
  const token = jwt.sign(
    { userId: user._id, isPaidMember: user.isPaidMember },
    'FREE_LOTTO_SECRET_2026', // 自訂密鑰
    { expiresIn: '30d' }
  );

  res.json({
    success: true,
    token,
    username: user.username,
    isPaidMember: user.isPaidMember
  });
});

// 💾 5. API：上傳與儲存明牌組合至雲端庫 (供智能對獎永久備份)
app.post('/api/tickets/save', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ success: false, message: '請先登入' });

  try {
    const decoded = jwt.verify(token, 'FREE_LOTTO_SECRET_2026');
    const { tickets } = req.body; // 接收前端提煉出的明牌陣列
    
    await User.findByIdAndUpdate(decoded.userId, { $set: { savedTickets: tickets } });
    res.json({ success: true, message: '☁️ 明牌已成功雲端備份！換手機也不會弄丟。' });
  } catch (err) {
    res.status(401).json({ success: false, message: '登入憑證失效' });
  }
});

// 📡 6. API：拉取雲端明牌組合 (供智能對獎面板動態對比)
app.get('/api/tickets/list', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ success: false, message: '請先登入' });

  try {
    const decoded = jwt.verify(token, 'FREE_LOTTO_SECRET_2026');
    const user = await User.findById(decoded.userId);
    res.json({ success: true, savedTickets: user.savedTickets });
  } catch (err) {
    res.status(401).json({ success: false, message: '憑證失效' });
  }
});

// 使用環境變數定義端口，方便免費雲端平台上線佈署
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 後端服務正常運作中，端口：${PORT}`));
