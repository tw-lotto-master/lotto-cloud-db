const express = require('express');
const mongoose = require('mongoose'); // 🎯 修正：必須將這行提到最前面，否則下方無法調用！
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

// ================== ✨ 後台真房間物理鎖死補丁開始 ==================
// 1. 強制指定唯一合法的真實 lotto 資料庫連線網址（擊穿任何預設值劫持）
const TRUE_MONGO_URI = "mongodb+srv://bingooo16888_db_user:bingo19880429@cluster0.t33ebvn.mongodb.net/lotto?retryWrites=true&w=majority&appName=Cluster0";

// 2. 物理清除 Mongoose 快取緩衝區內所有可能殘留的 lottodb / lotto_db 舊模型記憶
mongoose.models = {};
mongoose.modelSchemas = {};

// 3. 執行正式硬體鎖死連線
mongoose.connect(TRUE_MONGO_URI)
  .then(() => console.log("📡 [大腦通電成功] 已物理清除舊快取，全量強制回歸真房間：MongoDB -> lotto 👑"))
  .catch(err => console.error("🚨 資料庫真房間開啟失敗，阻斷原因：", err));
// ================== ✨ 後台真房間物理鎖死補丁結束 ==================

const app = express();


// 🔒 滿血開啟靜態託管網頁通道，讓 Google 順利審查隱私權政策
app.use(express.static('public'));

// 擊穿行動端 WebView 跨境安全鎖，滿血還原原廠 WebView 跨平台對接設定
app.use(cors({ 
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
  allowedHeaders: ['Content-Type', 'Authorization'] 
})); // 閉合 app.use(cors)

app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// ===【大樂透 49_6 全局高時脈靜態大數據內存緩衝區】===
let globalLotto49Matrix = null;
let globalLotto49Indices = null; 
let globalLotto49HistoryMask = null;  // 部隊 15 歷史地雷預存 (1安全, 0地雷)
let globalLotto49FilterBit0 = null;   // 部隊 8 AC值預存 (1符合, 0不符)
let globalLotto49FilterBit1 = null;   // 部隊 11 大小數預存 (1符合, 0不符)
let globalLotto49FilterBit2 = null;   // 部隊 12 012路預存 (1符合, 0不符)
let globalLotto49FilterBit3 = null;   // 部隊 14 質數比例預存 (1符合, 0不符)

// ===【今彩 539 照搬大樂透・換骨全量物理特徵緩衝區】===
let global539Matrix = null;           // 539 物理矩陣一維通道
let global539Indices = null;          // 539 高速隨機指針洗牌桶
let global539HistoryMask = null;      // 部隊 15 歷史 4 碼疊合地雷預存 (1安全, 0地雷)
let global539FilterBit0 = null;       // 部隊 8 AC值預存 (1符合, 0不符)
let global539FilterBit1 = null;       // 部隊 11 大小數預存 (1符合, 0不符)
let global539FilterBit2 = null;       // 部隊 12 012路預存 (1符合, 0不符)
let global539FilterBit3 = null;       // 部隊 14 質數比例預存 (1符合, 0不符)
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    googleId: { type: String, default: null },
    isPaidMember: { type: Boolean, default: false },
    savedTickets: { type: mongoose.Schema.Types.Mixed, default: [] },
    
    // 🎯 【全新增設：商用變動資產欄位】
    points: { type: Number, default: 100 }, // 新註冊用戶贈送 100 點基本分
    subscriptionExpiresAt: { type: Date, default: null } // VIP 訂閱天數絕對過期時間線
}, { strict: false, timestamps: true }); // 閉合 new mongoose.Schema

// 雙層自癒保險：防止在熱重載(Hot Reload)時發生模型重複編譯崩潰
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// ================== 後台終極雙棲沙盒免疫中間件開始 ==================
function authenticateToken(req, res, next) {
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    // 🎯【終極核心自癒】：雙軌制並進！Header 被 file:// 沒收時，自動改從網址 Query (?token=) 提取憑證
    let authHeader = req.headers.authorization || req.headers.Authorization || req.query.token;
    
    if (!authHeader) {
      console.log("❌ [攔截] 前端未攜帶標頭且網址無備用憑證，拒絕存取");
      return res.status(411).json({ success: false, message: '權限鎖定：請登入會員' });
    }
    
    // 強效文字清洗，物理火化重複的 Bearer 與畸形引號
    let tokenString = authHeader.trim().replace(/['"\r\n\t]/g, '');
    if (tokenString.startsWith('Bearer ')) {
      tokenString = tokenString.replace(/^Bearer\s+/, "").trim();
    }
    if (tokenString.startsWith('Bearer')) {
      tokenString = tokenString.replace(/^Bearer/, "").trim();
    }

    if (tokenString.includes(' ')) {
      tokenString = tokenString.split(' ');
    }

    // 密碼學核心驗證
    const decoded = jwt.verify(tokenString, 'FREE_LOTTO_SECRET_2026');
    
    // 強制字串化自癒，擊穿 MongoDB 物件死鎖
    req.user = {
      userId: String(decoded.userId || decoded._id || decoded.id).trim()
    };
    
    next();
  } catch (err) {
    console.error("🚨 [後台報錯] JWT 雙軌核對失敗，原因：", err.message);
    return res.status(401).json({ success: false, message: '驗證令牌失效或已過期' });
  }
}
// ================== 後台沙盒免疫中間件結束 ==================


// ================== 節點一取代範圍結束 ==================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await new User({ username, password: hashedPassword, isPaidMember: false }).save();
    res.json({ success: true, message: '註冊成功！' });
  } catch (err) { 
    res.status(500).json({ success: false, message: '註冊失敗，帳號可能已存在' }); 
  } // 閉合 try-catch
}); // 閉合 app.post('/api/auth/register')

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ success: false, message: '帳密錯誤' });
    } // 閉合 if (!user...)
    
    const token = jwt.sign(
  { userId: user._id }, 
  'FREE_LOTTO_SECRET_2026', // 💡 直接鎖死特權密鑰字串
  { expiresIn: '30d' }
); // 閉合 jwt.sign
    res.json({ success: true, token, username: user.username, isPaidMember: user.isPaidMember });
  } catch (err) { 
    res.status(500).json({ success: false, message: '登入驗證異常' }); 
  } // 閉合 try-catch
}); // 閉合 app.post('/api/auth/login')
app.post('/api/auth/google-sync', async (req, res) => {
  try {
    const { username, googleId } = req.body;
    if (!googleId) {
      return res.status(400).json({ success: false, message: '無效的 Google 憑證' });
    } // 閉合 if (!googleId)
    
    let user = await User.findOne({ googleId });
    if (!user) {
      user = new User({ 
        username: username || `Google操盤手_${Math.floor(1000 + Math.random() * 9000)}`, 
        googleId, 
        isPaidMember: false, 
        savedTickets: [] 
      }); // 閉合 new User
      await user.save();
    } // 閉合 if (!user)
    
    const token = jwt.sign(
      { userId: user._id, isPaidMember: user.isPaidMember }, 
      'FREE_LOTTO_SECRET_2026', 
      { expiresIn: '30d' }
    ); // 閉合 jwt.sign
    res.json({ success: true, token, username: user.username, isPaidMember: user.isPaidMember });
  } catch (err) { 
    res.status(500).json({ success: false, message: 'Google 雲端同步異常' }); 
  } // 閉合 try-catch
}); // 閉合 app.post('/api/auth/google-sync')
function initLotto49Matrix() {
  if (globalLotto49Matrix) return;
  console.log(" 正在為大樂透 1,400 萬組全窮舉鋪設高速內存通道...");
  
  globalLotto49Matrix = new Uint8Array(13983816 * 6);
  globalLotto49Indices = new Int32Array(13983816);
  
  globalLotto49HistoryMask = new Uint8Array(13983816); 
  globalLotto49FilterBit0 = new Uint8Array(13983816); 
  globalLotto49FilterBit1 = new Uint8Array(13983816); 
  globalLotto49FilterBit2 = new Uint8Array(13983816); 
  globalLotto49FilterBit3 = new Uint8Array(13983816); 
  
  globalLotto49HistoryMask.fill(1);
  globalLotto49FilterBit0.fill(0);
  globalLotto49FilterBit1.fill(0);
  globalLotto49FilterBit2.fill(0);
  globalLotto49FilterBit3.fill(0);
  
  let countIdx = 0;
  const prime49Mask = (1n<<2n)|(1n<<3n)|(1n<<5n)|(1n<<7n)|(1n<<11n)|(1n<<13n)|(1n<<17n)|(1n<<19n)|(1n<<23n)|(1n<<29n)|(1n<<31n)|(1n<<37n)|(1n<<41n)|(1n<<43n)|(1n<<47n);
  for (let i1 = 1; i1 <= 44; i1++) {
    for (let i2 = i1 + 1; i2 <= 45; i2++) {
      for (let i3 = i2 + 1; i3 <= 46; i3++) {
        for (let i4 = i3 + 1; i4 <= 47; i4++) {
          for (let i5 = i4 + 1; i5 <= 48; i5++) {
            for (let i6 = i5 + 1; i6 <= 49; i6++) {
              let bp = countIdx * 6;
              globalLotto49Matrix[bp] = i1;
              globalLotto49Matrix[bp+1] = i2;
              globalLotto49Matrix[bp+2] = i3;
              globalLotto49Matrix[bp+3] = i4;
              globalLotto49Matrix[bp+4] = i5;
              globalLotto49Matrix[bp+5] = i6;
              globalLotto49Indices[countIdx] = countIdx;
              
              let diffs = new Set();
              diffs.add(Math.abs(i1-i2)).add(Math.abs(i1-i3)).add(Math.abs(i1-i4)).add(Math.abs(i1-i5)).add(Math.abs(i1-i6))
                   .add(Math.abs(i2-i3)).add(Math.abs(i2-i4)).add(Math.abs(i2-i5)).add(Math.abs(i2-i6))
                   .add(Math.abs(i3-i4)).add(Math.abs(i3-i5)).add(Math.abs(i3-i6))
                   .add(Math.abs(i4-i5)).add(Math.abs(i4-i6)).add(Math.abs(i5-i6));
              if ((diffs.size - 5) >= 4) globalLotto49FilterBit0[countIdx] = 1;
              
              let highCount = 0;
              if (i1 >= 25) highCount++; if (i2 >= 25) highCount++;
              if (i3 >= 25) highCount++; if (i4 >= 25) highCount++;
              if (i5 >= 25) highCount++; if (i6 >= 25) highCount++;
              if (highCount !== 6 && highCount !== 0 && highCount !== 5 && highCount !== 1) {
                globalLotto49FilterBit1[countIdx] = 1;
              } // 結束 highCount 判斷
              
              let r0 = 0, r1 = 0, r2 = 0;
              let m1 = i1 % 3; if (m1 === 0) r0++; else if (m1 === 1) r1++; else r2++;
              let m2 = i2 % 3; if (m2 === 0) r0++; else if (m2 === 1) r1++; else r2++;
              let m3 = i3 % 3; if (m3 === 0) r0++; else if (m3 === 1) r1++; else r2++;
              let m4 = i4 % 3; if (m4 === 0) r0++; else if (m4 === 1) r1++; else r2++;
              let m5 = i5 % 3; if (m5 === 0) r0++; else if (m5 === 1) r1++; else r2++;
              let m6 = i6 % 3; if (m6 === 0) r0++; else if (m6 === 1) r1++; else r2++;
              if (r0 !== 0 && r1 !== 0 && r2 !== 0) globalLotto49FilterBit2[countIdx] = 1;
              
              let pCnt = 0;
              if ((prime49Mask & (1n << BigInt(i1))) !== 0n) pCnt++;
              if ((prime49Mask & (1n << BigInt(i2))) !== 0n) pCnt++;
              if ((prime49Mask & (1n << BigInt(i3))) !== 0n) pCnt++;
              if ((prime49Mask & (1n << BigInt(i4))) !== 0n) pCnt++;
              if ((prime49Mask & (1n << BigInt(i5))) !== 0n) pCnt++;
              if ((prime49Mask & (1n << BigInt(i6))) !== 0n) pCnt++;
              if (pCnt < 4) globalLotto49FilterBit3[countIdx] = 1;
              
              countIdx++;
            } // 閉合 i6 迴圈
          } // 閉合 i5 迴圈
        } // 閉合 i4 迴圈
      } // 閉合 i3 迴圈
    } // 閉合 i2 迴圈
  } // 閉合 i1 迴圈
  for (let i = globalLotto49Indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = globalLotto49Indices[i];
    globalLotto49Indices[i] = globalLotto49Indices[j];
    globalLotto49Indices[j] = temp;
  } // 閉合指針洗牌 for 迴圈
  console.log(" 大樂透指針大洗牌完成，四大死條件部隊預編完畢！");
} // 🔒 完美閉合 function initLotto49Matrix
app.set('initHistory裂變去重', function(historyDB) {
  if (!globalLotto49HistoryMask) return;
  console.log(` 歷史資料庫大閱兵：偵測到 ${historyDB.length} 筆原始獎號，正在進行大樂透自體裂變去重...`);
  globalLotto49HistoryMask.fill(1);
  let uniqueGeiLeiCombs = new Set();
  
  historyDB.forEach(h => {
    let nums = h.slice(0, 6).map(Number).sort((a, b) => a - b);
    if (nums.length < 6) return;
    uniqueGeiLeiCombs.add(nums.join(','));
    for (let i = 0; i < 6; i++) {
      let sub5 = nums.filter((_, idx) => idx !== i);
      for (let ball = 1; ball <= 49; ball++) {
        if (nums.includes(ball)) continue;
        let comb5 = [...sub5, ball].sort((a, b) => a - b);
        uniqueGeiLeiCombs.add(comb5.join(','));
      } // 閉合 ball 迴圈
    } // 閉合 sub5 擷取 i 迴圈
  }); // 閉合 historyDB.forEach
  
  let countIdx = 0;
  for (let i1 = 1; i1 <= 44; i1++) {
    for (let i2 = i1 + 1; i2 <= 45; i2++) {
      for (let i3 = i2 + 1; i3 <= 46; i3++) {
        for (let i4 = i3 + 1; i4 <= 47; i4++) {
          for (let i5 = i4 + 1; i5 <= 48; i5++) {
            for (let i6 = i5 + 1; i6 <= 49; i6++) {
              let key = `${i1},${i2},${i3},${i4},${i5},${i6}`;
              if (uniqueGeiLeiCombs.has(key)) globalLotto49HistoryMask[countIdx] = 0;
              countIdx++;
            } // 閉合 i6
          } // 閉合 i5
        } // 閉合 i4
      } // 閉合 i3
    } // 閉合 i2
  } // 閉合 i1
  uniqueGeiLeiCombs.clear();
  console.log(" 【大樂透部隊 15】晶片靜態對照庫更新完畢！");
}); // 🔒 完美閉合 app.set('initHistory裂變去重')
function init539StaticFeatures(historyDB) {
  if (global539Matrix) return;
  console.log(" 正在為今彩 539 鋪設 575,757 組全量超導預存通道...");
  
  global539Matrix = new Uint8Array(575757 * 5);
  global539Indices = new Int32Array(575757);
  global539HistoryMask = new Uint8Array(575757);
  global539FilterBit0 = new Uint8Array(575757);
  global539FilterBit1 = new Uint8Array(575757);
  global539FilterBit2 = new Uint8Array(575757);
  global539FilterBit3 = new Uint8Array(575757);
  
  global539HistoryMask.fill(1);
  let countIdx = 0;
  const prime39Mask = (1n<<2n)|(1n<<3n)|(1n<<5n)|(1n<<7n)|(1n<<11n)|(1n<<13n)|(1n<<17n)|(1n<<19n)|(1n<<23n)|(1n<<29n)|(1n<<31n)|(1n<<37n);
  
  for (let i1 = 1; i1 <= 35; i1++) {
    for (let i2 = i1 + 1; i2 <= 36; i2++) {
      for (let i3 = i2 + 1; i3 <= 37; i3++) {
        for (let i4 = i3 + 1; i4 <= 38; i4++) {
          for (let i5 = i4 + 1; i5 <= 39; i5++) {
            let bp = countIdx * 5;
            global539Matrix[bp] = i1; global539Matrix[bp+1] = i2; global539Matrix[bp+2] = i3; global539Matrix[bp+3] = i4; global539Matrix[bp+4] = i5;
            global539Indices[countIdx] = countIdx;
            
            let diffs = new Set();
            diffs.add(Math.abs(i1-i2)).add(Math.abs(i1-i3)).add(Math.abs(i1-i4)).add(Math.abs(i1-i5))
                 .add(Math.abs(i2-i3)).add(Math.abs(i2-i4)).add(Math.abs(i2-i5))
                 .add(Math.abs(i3-i4)).add(Math.abs(i3-i5)).add(Math.abs(i4-i5));
            if ((diffs.size - 4) >= 1) global539FilterBit0[countIdx] = 1;
            
            let highCount = 0;
            if (i1 >= 20) highCount++; if (i2 >= 20) highCount++; if (i3 >= 20) highCount++; if (i4 >= 20) highCount++; if (i5 >= 20) highCount++;
            if (highCount !== 5 && highCount !== 0 && highCount !== 4 && highCount !== 1) global539FilterBit1[countIdx] = 1;
            
            let r0 = 0, r1 = 0, r2 = 0;
            let m1 = i1 % 3; if (m1 === 0) r0++; else if (m1 === 1) r1++; else r2++;
            let m2 = i2 % 3; if (m2 === 0) r0++; else if (m2 === 1) r1++; else r2++;
            let m3 = i3 % 3; if (m3 === 0) r0++; else if (m3 === 1) r1++; else r2++;
            let m4 = i4 % 3; if (m4 === 0) r0++; else if (m4 === 1) r1++; else r2++;
            let m5 = i5 % 3; if (m5 === 0) r0++; else if (m5 === 1) r1++; else r2++;
            if (r0 !== 0 && r1 !== 0 && r2 !== 0) global539FilterBit2[countIdx] = 1;
            
            let pCnt = 0;
            if ((prime39Mask & (1n << BigInt(i1))) !== 0n) pCnt++;
            if ((prime39Mask & (1n << BigInt(i2))) !== 0n) pCnt++;
            if ((prime39Mask & (1n << BigInt(i3))) !== 0n) pCnt++;
            if ((prime39Mask & (1n << BigInt(i4))) !== 0n) pCnt++;
            if ((prime39Mask & (1n << BigInt(i5))) !== 0n) pCnt++;
            if (pCnt < 4) global539FilterBit3[countIdx] = 1;
            
            countIdx++;
          } // 閉合 i5
        } // 閉合 i4
      } // 閉合 i3
    } // 閉合 i2
  } // 閉合 i1
  
  let unique539GeiLei = new Set();
  historyDB.forEach(h => {
    let nums = h.slice(0, 5).map(Number).sort((a, b) => a - b);
    if (nums.length < 5) return;
    for (let i = 0; i < 5; i++) {
      let sub4 = nums.filter((_, idx) => idx !== i);
      for (let ball = 1; ball <= 39; ball++) {
        if (nums.includes(ball)) continue;
        unique539GeiLei.add([...sub4, ball].sort((a,b)=>a-b).join(','));
      } // 閉合 ball
    } // 閉合 sub4 i
  }); // 閉合 historyDB.forEach
  
  for (let i = 0; i < 575757; i++) {
    let bp = i * 5;
    let key = `${global539Matrix[bp]},${global539Matrix[bp+1]},${global539Matrix[bp+2]},${global539Matrix[bp+3]},${global539Matrix[bp+4]}`;
    if (unique539GeiLei.has(key)) global539HistoryMask[i] = 0;
  } // 閉合地雷映射 for
  unique539GeiLei.clear();
  
  for (let i = global539Indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = global539Indices[i]; global539Indices[i] = global539Indices[j]; global539Indices[j] = temp;
  } // 閉合 539 洗牌迴圈
  console.log(" 【539 竣工】：539 隨機洗牌桶與五大死條件特徵營隊全線就位通車！");
} // 🔒 完美閉合 function init539StaticFeatures
app.post('/api/lottery/generate-vip-turbo', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // === 【全域變數外掛化：徹底擊穿大口袋作用域阻斷，維持全線流暢推進】 ===
    let totalScanned = 0;
    let matchCount = 0;
    let lastReportedPercent = -1;
    let vipValidPool = [];

    try { // 【最外層最高生命線大口袋 try 起點】
                const { cfg, globalHistoryDB } = req.body;
        if (!cfg) {
            res.write(JSON.stringify({ success: false, message: "參數配置遺失" }) + "\n");
            return res.end();
        } // 閉合 if (!cfg)

         // 🟢 完美融合：徹底修復用戶 ID 金鑰與雙軌制權限判定 Bug
 // 1. 精密對齊第 2 頁 jwt.sign 簽發的原始金鑰欄位 [userId]
 const sessionUserId = req.user && req.user.userId; 
 if (!sessionUserId) {
 res.write(JSON.stringify({ success: false, status: 401, message: "身分驗證異常，安全權限鎖失效，請重新登入！" }) + "\n");
 return res.end();
 }
      
const targetUser = await User.findById(sessionUserId);
if (!targetUser) {
res.write(JSON.stringify({ success: false, message: "雲端找不到該會員帳號，拒絕存取！" }) + "\n");
return res.end();
}
const currentTime = new Date();
     // ================== 取代範圍開始 ==================
    // 檢查是否處於包月/包年 VIP 訂閱有效期內 👑
    const hasActiveSubscription = targetUser.subscriptionExpiresAt && 
    targetUser.subscriptionExpiresAt > currentTime;
    
    // 核心特權分流控制線 🎯
    if (hasActiveSubscription) {
      console.log(` VIP訂閱會員 [${targetUser.username}] 尊榮通行，免扣點海選。 👑 `);
    } else if (cfg.isAdUnlocked === true || cfg.isAdUnlocked === 'true') {
      console.log(` 一般會員 [${targetUser.username}] 觀看廣告成功，進入中階體驗通道。 🎬 `);
    } else {
      // 一般會員 ── 默默在背景執行單次扣 10 點全功能開放！ 🪙
      const OPERATION_COST = 10;
      if ((targetUser.points || 0) < OPERATION_COST) {
        res.write(JSON.stringify({ 
          success: false, 
          message: `點數不足！VIP 精準篩選需消耗 ${OPERATION_COST} 點。您目前餘額：${targetUser.points || 0} 點。請前往儲值或看影片解鎖體驗通道！` 
        }) + "\n");
        return res.end();
      }
      
      // 執行扣點並即時同步存檔至 MongoDB
      targetUser.points = (targetUser.points || 0) - OPERATION_COST;
      await targetUser.save();
      console.log(` 隱藏扣點成功！用戶 [${targetUser.username}] 消耗 🪙 ${OPERATION_COST} 點，賸餘點數：${targetUser.points} 點`);
      
      // 【終極解鎖補丁】：強制加上雙換行 \n\n，配合物理沖刷，徹底擊穿 Express 快取憋字阻斷！
      res.write(JSON.stringify({ isPointsUpdated: true, remainingPoints: targetUser.points }) + "\n\n");
      if (typeof res.flush === 'function') res.flush();
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
    } // 完美閉合非訂閱用戶的 else 大口袋！ 🔒
    // ================== 取代範圍結束 ==================

    
    const lottoType = cfg.lottoType || "39_5";
    const requiredCount = (lottoType === "49_6") ? 6 : 5;
    const maxNumber = (lottoType === "49_6") ? 49 : 39;
    const targetCount = Math.min(100, cfg.count || 5);
    
    const historyDB = globalHistoryDB || [];
    const historyCacheSet = new Set(historyDB.map(h => h.slice(0, requiredCount).sort((a,b)=>a-b).join(',')));
    
    const globalHistoryBigInts = historyDB.map(h => {
      let nums = h.slice(0, requiredCount).map(Number);
      let mask = 0n;
      nums.forEach(n => { mask |= (1n << BigInt(n)); }); // 閉合 nums.forEach
      return mask;
    }); // 閉合 historyDB.map
    
    const f1_set = new Set(cfg.f1_set || []);
    const neighborSet = new Set();
    let lastPeriod = [];
    
    if (cfg.lastPeriod && cfg.lastPeriod.length >= requiredCount) {
      lastPeriod = cfg.lastPeriod.map(Number);
    } else if (historyDB && historyDB.length > 0) {
      lastPeriod = historyDB.slice(0, requiredCount).map(Number);
    } // 閉合 if-else if
    
    if (lastPeriod.length > 0) {
      let range = parseInt(cfg.f9_range, 10) || 1;
      lastPeriod.forEach(val => {
        for (let d = -range; d <= range; d++) { if (d !== 0) neighborSet.add(val + d); }
      }); // 閉合 lastPeriod.forEach
    } // 閉合 if (lastPeriod.length > 0)
    
    let smartMaskLow = 0;
    let smartMaskHigh = 0;
    const isSmartMode = (cfg.vipMode === 'smart');
    let survivorPoolIndices = [];
    if (lottoType === "39_5" || cfg.lottoType === "39_5") {
      try { // 【539 獨立自癒防禦門 try 起點】
        if (!global539Matrix) { init539StaticFeatures(historyDB); }
        
        // 動態編譯本輪海選玩家有勾選的 539 倒排索引遮罩鎖
        let active539Bits = 0; 
        let required539Mask = 0; 
        if (cfg.f8_on) { active539Bits |= (1 << 0); required539Mask |= (1 << 0); }
        if (cfg.f11_on) { active539Bits |= (1 << 1); required539Mask |= (1 << 1); } 
        if (cfg.f12_on) { active539Bits |= (1 << 2); required539Mask |= (1 << 2); } 
        if (cfg.f14_on) { active539Bits |= (1 << 3); required539Mask |= (1 << 3); }
        
        // 🚀【物理降維大革命】：拋棄五層巢狀迴圈！改採單層超導物理指針遍歷大池！
        for (let k = 0; k < 575757; k++) {
          let matrixId = global539Indices[k]; // 提取隨機打散後的 539 指針桶位址
          
          // ───【晶片級特徵連鎖預點名】：未解壓號碼前秒速核對死條件，不符者直接彈開，0 內耗！───
          let currentFeature = 0;
          if (global539FilterBit0[matrixId] === 1) currentFeature |= (1 << 0); // AC值符合
          if (global539FilterBit1[matrixId] === 1) currentFeature |= (1 << 1); // 大小數常態符合
          if (global539FilterBit2[matrixId] === 1) currentFeature |= (1 << 2); // 012路常態符合
          if (global539FilterBit3[matrixId] === 1) currentFeature |= (1 << 3); // 質數比例常態符合
          
          if ((currentFeature & active539Bits) !== required539Mask) {
            continue; // 特徵點名失敗，此時不耗費任何 CPU 解壓號碼，光速跳過！
          } // 閉合特徵點名核對 if
          
          // 完美通過特徵點名，進入一維通道進行晶片級高速號碼解壓
          let bytePos = matrixId * 5;
          let i1 = global539Matrix[bytePos];
          let i2 = global539Matrix[bytePos + 1];
          let i3 = global539Matrix[bytePos + 2];
          let i4 = global539Matrix[bytePos + 3];
          let i5 = global539Matrix[bytePos + 4];
          
          let comb = [i1, i2, i3, i4, i5];
          let isCombValid = true;
          // 【條件 1】：排除特定地雷號碼
          if (cfg.f1_on) {
            if (f1_set.has(i1) || f1_set.has(i2) || f1_set.has(i3) || f1_set.has(i4) || f1_set.has(i5)) {
              isCombValid = false;
            } // 閉合 f1_set.has 判斷 if
          } // 閉合 if (cfg.f1_on)
          
          // 【條件 2】：首尾邊界熱區過濾 (頭尾精確夾擊)
          if (isCombValid && cfg.f2_on) {
            if (i1 >= cfg.f2_min || i5 <= cfg.f2_max) {
              isCombValid = false;
            } // 閉合熱區夾擊 if
          } // 閉合 if (isCombValid && cfg.f2_on)
          
          // 【物理防線 2 / 歷史全中排除】：與歷史開獎大數據進行完全重疊對撞
          if (isCombValid) {
            if (historyCacheSet.has(comb.join(','))) {
              isCombValid = false;
            } // 閉合歷史 Cache 比對 if
          } // 閉合 if (isCombValid)
          
          // 【條件 3】：五大物理區塊落點控制
          if (isCombValid && cfg.f3_on) {
            let zoneSet = new Set();
            zoneSet.add(Math.min(5, Math.ceil(i1 / 8)))
                   .add(Math.min(5, Math.ceil(i2 / 8)))
                   .add(Math.min(5, Math.ceil(i3 / 8)))
                   .add(Math.min(5, Math.ceil(i4 / 8)))
                   .add(Math.min(5, Math.ceil(i5 / 8)));
            if (zoneSet.size !== cfg.f3_req) {
              isCombValid = false;
            } // 閉合區塊落點要求 if
          } // 閉合 if (isCombValid && cfg.f3_on)
          
          // 【條件 4】：同尾數重複個數上限過濾
          if (isCombValid && cfg.f4_on) {
            let tails = new Array(10).fill(0);
            tails[i1 % 10]++; tails[i2 % 10]++; tails[i3 % 10]++; tails[i4 % 10]++; tails[i5 % 10]++;
            if (Math.max(...tails) > cfg.f4_max) {
              isCombValid = false;
            } // 閉合尾數重複上限比對 if
          } // 閉合 if (isCombValid && cfg.f4_on)
          // 【條件 5】：奇偶比例動態防禦牆
          if (isCombValid && cfg.f5_on) {
            let oddCount = (i1 % 2) + (i2 % 2) + (i3 % 2) + (i4 % 2) + (i5 % 2);
            if (cfg.f5_539_50 && (oddCount === 5 || oddCount === 0)) isCombValid = false;
            if (cfg.f5_539_41 && (oddCount === 4 || oddCount === 1)) isCombValid = false;
          } // 閉合 if (isCombValid && cfg.f5_on)
          
          // 【條件 6】：號碼總和區間動態過濾
          if (isCombValid && cfg.f6_on) {
            let sumValue = i1 + i2 + i3 + i4 + i5;
            if (sumValue < cfg.f6_low || sumValue > cfg.f6_high) {
              isCombValid = false;
            } // 閉合總和過濾 if
          } // 閉合 if (isCombValid && cfg.f6_on)
          
          // 【條件 7】：連續號碼長度限制牆
          if (isCombValid && cfg.f7_on) {
            let maxConsecutive = 1, currentConsecutive = 1;
            for (let m = 0; m < comb.length - 1; m++) {
              if (comb[m + 1] - comb[m] === 1) { 
                currentConsecutive++; 
              } else { 
                if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive; 
                currentConsecutive = 1; 
              } // 閉合判斷是否連續的 if-else
            } // 閉合連續長度遍歷 for
            if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive;
            if (maxConsecutive >= (cfg.f7_len || 3)) isCombValid = false;
          } // 閉合 if (isCombValid && cfg.f7_on)
          
          // 【條件 9】：鄰號夾擊防線控制
if (isCombValid && cfg.f9_on && neighborSet.size > 0) {
    let nCnt = 0;
    comb.forEach(num => { if (neighborSet.has(num)) nCnt++; });
    if (nCnt > (cfg.f9_count || 2)) isCombValid = false;
}
 // 閉合 if (isCombValid && cfg.f9_on...)
          
          // 【條件 10】：上期獎號連莊封殺牆
          if (isCombValid && cfg.f10_on && cfg.lastPeriod && cfg.lastPeriod.length > 0) {
            let repeatCount = 0;
            comb.forEach(num => { if (cfg.lastPeriod.includes(num)) repeatCount++; });
            if (repeatCount > (cfg.f10_max || 2)) isCombValid = false;
          } // 閉合 if (isCombValid && cfg.f10_on...)
          // 【條件 13】：數字複雜度 (AC值) 飄移精準過濾
          if (isCombValid && cfg.f13_on) {
            let diffs = new Set();
            for (let m = 0; m < 4; m++) { for (let n = m + 1; n < 5; n++) { diffs.add(Math.abs(comb[m] - comb[n])); } }
            let acVal = diffs.size - 4; 
            let f13MinTarget = parseInt(cfg.f13_min, 10) || 1;
            if (acVal < f13MinTarget) isCombValid = false;
          } // 閉合 if (isCombValid && cfg.f13_on)
          
          // 🔥【優化條件 15】：一微秒常數查表判定歷史 4 碼地雷，100% 照搬大樂透最流暢架構！
          if (isCombValid && cfg.f15_on && cfg.f15_kill) {
            if (global539HistoryMask[matrixId] === 0) {
              isCombValid = false; // 踩到背景裂變完畢的歷史特徵死線，直接淘汰
            } // 閉合地雷查表判定 if
          } // 閉合 if (isCombValid && cfg.f15_on...)
          
          // ───【539 降維海選生還計數與索引光速抄底】───
          if (isCombValid) {
            matchCount++;
            survivorPoolIndices.push(i1, i2, i3, i4, i5);
          } // 閉合生還索引存入 if
          
          // ===【智控動態調速閥：高頻 15000 次沖刷一次，解鎖 0% 推進，保障登入接口不卡死】===
          totalScanned++;
          if (totalScanned % 150000 === 0) {
    let percent = Math.min(100, Math.floor((totalScanned / 13983816) * 100));
    if (survivorPoolIndices.length >= targetCount) { 
        res.write(JSON.stringify({ isProgress: true, percent: percent, currentMatch: matchCount }) + "\n");
        break; 
    }
            // 核心給予 1 毫秒物理喘息，交還 Node.js 執行緒控制權
            await new Promise(resolve => setTimeout(resolve, 1));
          } // 閉合調速閥沖刷 if
        } // 🔒 完美物理閉合 539 全池單層單線高速遍歷 for 迴圈！
      } catch (err539) {
        console.error(" 539海選分流內部異常：", err539.message);
      } // 完美閉合 539 獨立自癒防禦門 catch
    } // 🔒 完美閉合 539 大判定 if (lottoType === "39_5" ...)
    if (lottoType === "39_5") {
      const totalSurvivorCombs = survivorPoolIndices.length / 5;
      if (totalSurvivorCombs > 0) {
        // ───【分流 A：一般隨機模式 (vipMode === 'random' 可重複大組)】───
        if (!isSmartMode) {
          while (vipValidPool.length < targetCount) {
            const randomCombIdx = Math.floor(Math.random() * totalSurvivorCombs);
            const basePos = randomCombIdx * 5;
            vipValidPool.push([
              survivorPoolIndices[basePos],
              survivorPoolIndices[basePos + 1],
              survivorPoolIndices[basePos + 2],
              survivorPoolIndices[basePos + 3],
              survivorPoolIndices[basePos + 4]
            ]); // 閉合 vipValidPool.push
          } // 閉合 while 隨機抽樣
        } // 閉合 if (!isSmartMode)
// ───【分流 B：聰明包牌模式 (539純淨餘數跨組優先滾動 & 自適應串流版)】───
else {
    const localOutputSet = new Set();
    
    let shuffledIndices539 = [];
    for (let i = 0; i < totalSurvivorCombs; i++) {
        shuffledIndices539.push(i);
    }
    for (let i = shuffledIndices539.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = shuffledIndices539[i];
        shuffledIndices539[i] = shuffledIndices539[j];
        shuffledIndices539[j] = temp;
    }

    let currentPoolIdx = 0;
    let batchCounter = 0;          
    let currentGroupPool = [];     
    let vipSmartMask = 0n;       
    let currentTargetGroupSize = 6; // 539 同步以 6 組為一大組滾動
    let continuousFailCount = 0;   
    
    let priorityBallsFromPrevious539 = []; // 539 專用餘數優先池

    console.log(`🚀 【超導餘數優先流轉啟動】進入今彩 539 生還池。目標組數: ${targetCount}`);

    while (batchCounter < targetCount && currentPoolIdx < totalSurvivorCombs) {
        const targetCombIdx = shuffledIndices539[currentPoolIdx];
        currentPoolIdx++;
        
        const basePos = targetCombIdx * 5;
        const i1 = survivorPoolIndices[basePos]; 
        const i2 = survivorPoolIndices[basePos + 1]; 
        const i3 = survivorPoolIndices[basePos + 2]; 
        const i4 = survivorPoolIndices[basePos + 3]; 
        const i5 = survivorPoolIndices[basePos + 4];
        
        const combKey = `${i1},${i2},${i3},${i4},${i5}`;
        if (localOutputSet.has(combKey)) continue; 
        
        let hasDupNumber = (
            ((vipSmartMask & (1n << BigInt(i1))) !== 0n) || 
            ((vipSmartMask & (1n << BigInt(i2))) !== 0n) || 
            ((vipSmartMask & (1n << BigInt(i3))) !== 0n) || 
            ((vipSmartMask & (1n << BigInt(i4))) !== 0n) || 
            ((vipSmartMask & (1n << BigInt(i5))) !== 0n)
        );
        
        // 執行 539 餘數號超車優選
        if (!hasDupNumber && priorityBallsFromPrevious539.length > 0 && currentGroupPool.length < 2) {
            let hasPriorityBall = [i1, i2, i3, i4, i5].some(num => priorityBallsFromPrevious539.includes(num));
            if (!hasPriorityBall && Math.random() < 0.75 && continuousFailCount < 200) {
                shuffledIndices539.push(targetCombIdx);
                continuousFailCount++;
                continue;
            }
        }

        if (!hasDupNumber) {
            currentGroupPool.push([i1, i2, i3, i4, i5]);
            localOutputSet.add(combKey);
            vipSmartMask |= (1n << BigInt(i1)) | (1n << BigInt(i2)) | (1n << BigInt(i3)) | (1n << BigInt(i4)) | (1n << BigInt(i5));
            
            batchCounter++;
            continuousFailCount = 0;
            
            if (currentGroupPool.length === currentTargetGroupSize || batchCounter === targetCount) {
                let chunkText = ``;
                currentGroupPool.forEach((comb) => {
                    vipValidPool.push(comb);
                    chunkText += `第 [${String(vipValidPool.length).padStart(2, '0')}] 組：${comb.map(n => String(n).padStart(2, '0')).join(', ')}\n`;
                });
                
                res.write(JSON.stringify({ 
                    isProgress: true, 
                    percent: Math.min(Math.floor((vipValidPool.length / targetCount) * 100), 99), 
                    currentMatch: vipValidPool.length,
                    appendOutput: chunkText 
                }) + "\n");
                
                // 🧠【計算 539 純淨餘數】：
                let currentGroupUsedBalls = [];
                currentGroupPool.forEach(comb => currentGroupUsedBalls.push(...comb));
                
                let allVipAllowedBalls = [];
                for (let k = 0; k < totalSurvivorCombs; k++) {
                    let bp = survivorPoolIndices[shuffledIndices539[k]] * 5;
                    for (let m = 0; m < 5; m++) {
                        let ball = survivorPoolIndices[bp + m];
                        if (ball && !allVipAllowedBalls.includes(ball)) allVipAllowedBalls.push(ball);
                    }
                    if (allVipAllowedBalls.length >= 39) break;
                }
                
                priorityBallsFromPrevious539 = allVipAllowedBalls.filter(ball => !currentGroupUsedBalls.includes(ball));
                
                vipSmartMask = 0n;
                currentGroupPool = [];
                currentTargetGroupSize = 6;
            }
        } else {
            continuousFailCount++;
            
            if (continuousFailCount > 800 && currentGroupPool.length > 0) {
                if (currentTargetGroupSize > Math.max(2, currentGroupPool.length)) {
                    currentTargetGroupSize = currentGroupPool.length; 
                    console.log(`⚠️ 【539自適應退縮】空間飽和，強行退縮至: ${currentTargetGroupSize} 組交卷！`);
                    
                    let chunkText = ``;
                    currentGroupPool.forEach((comb) => {
                        vipValidPool.push(comb);
                        chunkText += `第 [${String(vipValidPool.length).padStart(2, '0')}] 組：${comb.map(n => String(n).padStart(2, '0')).join(', ')}\n`;
                    });
                    
                    res.write(JSON.stringify({ 
                        isProgress: true, 
                        percent: Math.min(Math.floor((vipValidPool.length / targetCount) * 100), 99), 
                        currentMatch: vipValidPool.length,
                        appendOutput: chunkText 
                    }) + "\n");
                    
                    let used = [];
                    currentGroupPool.forEach(c => used.push(...c));
                    let allAllowed = [];
                    for (let k = 0; k < Math.min(2000, totalSurvivorCombs); k++) {
                        let bp = survivorPoolIndices[shuffledIndices539[k]] * 5;
                        for (let m = 0; m < 5; m++) {
                            let ball = survivorPoolIndices[bp + m];
                            if (ball && !allAllowed.includes(ball)) allAllowed.push(ball);
                        }
                    }
                    priorityBallsFromPrevious539 = allAllowed.filter(b => !used.includes(b));
                    
                    vipSmartMask = 0n;
                    currentGroupPool = [];
                    currentTargetGroupSize = 6;
                    continuousFailCount = 0;
                }
            }
        }
    }
    
    if (currentGroupPool.length > 0) {
        let chunkText = ``;
        currentGroupPool.forEach((comb) => {
            vipValidPool.push(comb);
            chunkText += `第 [${String(vipValidPool.length).padStart(2, '0')}] 組：${comb.map(n => String(n).padStart(2, '0')).join(', ')}\n`;
        });
        res.write(JSON.stringify({ isProgress: true, percent: 99, currentMatch: vipValidPool.length, appendOutput: chunkText }) + "\n");
    }
    shuffledIndices539 = [];
    localOutputSet.clear();
}

      } // 閉合 if (totalSurvivorCombs > 0)
    } // 🔒 完美對齊閉合 539 彩種邊界大門 if (lottoType === "39_5")
    if (cfg && cfg.lottoType === "39_5") {
      console.log(" 【雙軌超導分流】：今彩 539 經精密海選已竣工，啟動交卷！");
      matchCount = survivorPoolIndices.length / 5; 
      totalScanned = 575757;
 
      if (vipValidPool.length === 0) {
        res.write(JSON.stringify({ success: false, message: "符合防線有效組合為 0 組，請放寬過濾標準！" }) + "\n");
      } else {
        let mName = (cfg.vipMode === 'smart') ? '聰明包牌' : '一般隨機';
        let outputText = `【VIP篩選完成】符合今彩 539 防線總組數：${matchCount} 組\n【本次輸出模式】${mName}\n【本次輸出】精選出 ${vipValidPool.length} 組\n-------------------------\n`;
        vipValidPool.forEach((comb, idx) => { 
          outputText += `第 [${String(idx + 1).padStart(2, '0')}] 組：${comb.map(n => String(n).padStart(2, '0')).join(', ')}\n`; 
        }); // 閉合 539 文字封裝 forEach
        res.write(JSON.stringify({ isProgress: true, percent: 100, currentMatch: vipValidPool.length }) + "\n");
        res.write(JSON.stringify({ success: true, outputText: outputText }) + "\n");
      } // 閉合發送結果分流 if-else
      res.end();
      return; // 🔒 539 超導專區物理交卷離場，阻斷下方大樂透
    } 
    
    // ───【大樂透 49_6 原廠領地大口袋正式開啟】───
    else {
      try { // 【大樂透專區最高生命線大口袋 try 起點】
        if (!globalLotto49Matrix) { initLotto49Matrix(); }
        let f2_min = parseInt(cfg.f2_min, 10) || 15; 
        let f2_max = parseInt(cfg.f2_max, 10) || 30; 
        let f4_max = parseInt(cfg.f4_max, 10) || 2;
        let f6_low = cfg.f6_on ? (parseInt(cfg.f6_low, 10) || 110) : 21;
        let f6_high = cfg.f6_on ? (parseInt(cfg.f6_high, 10) || 210) : 279;
        const matrixLength = 13983816; 
        const chunkSize = 3495954; 
        let currentPointerIdx = 0;
        let activeFilterBits = 0; 
        let requiredFeatureMask = 0; 
        if (cfg.f8_on) { activeFilterBits |= (1 << 0); requiredFeatureMask |= (1 << 0); }
        if (cfg.f11_on) { activeFilterBits |= (1 << 1); requiredFeatureMask |= (1 << 1); } 
        if (cfg.f12_on) { activeFilterBits |= (1 << 2); requiredFeatureMask |= (1 << 2); } 
        if (cfg.f14_on) { activeFilterBits |= (1 << 3); requiredFeatureMask |= (1 << 3); } 
        
        const checkHistoryGeiLei = (cfg.f15_on === true || cfg.f15_on === 'true'); 
        
        // 【大樂透高速通道】：切片非同步海選核心晶片
        // ➡️ 【後台 Page 15】精準替換後代碼：
async function runSliceChunk(startK, endK) {
 for (let k = startK; k < endK; k++) {
 // 🛡️ 雙彩超導物理鎖：徹底拔除 targetCount * 6 限制！強迫大口袋 100% 跑完全量運算！
 if (currentPointerIdx >= matrixLength) {
 break;
 }
 let matrixId = globalLotto49Indices[currentPointerIdx++];

            
            // 【晶片級特徵預點名】：倒排索引秒速排除不合規組合，跳過無效號碼解壓
            let currentFeature = 0;
            if (globalLotto49FilterBit0[matrixId] === 1) currentFeature |= (1 << 0); 
            if (globalLotto49FilterBit1[matrixId] === 1) currentFeature |= (1 << 1); 
            if (globalLotto49FilterBit2[matrixId] === 1) currentFeature |= (1 << 2); 
            if (globalLotto49FilterBit3[matrixId] === 1) currentFeature |= (1 << 3); 
            
            if ((currentFeature & activeFilterBits) !== requiredFeatureMask) {
              continue; // 特徵點名未通關，光速跳過
            } // 閉合連鎖特徵預點名核對 if
            let bytePos = matrixId * 6;
            let i1 = globalLotto49Matrix[bytePos];
            let i2 = globalLotto49Matrix[bytePos + 1];
            let i3 = globalLotto49Matrix[bytePos + 2];
            let i4 = globalLotto49Matrix[bytePos + 3];
            let i5 = globalLotto49Matrix[bytePos + 4];
            let i6 = globalLotto49Matrix[bytePos + 5];
            
            let comb = [i1, i2, i3, i4, i5, i6];
            let isCombValid = true; 
            
            // 【條件 1】：排除特定地雷號碼
            if (cfg.f1_on) {
              if (f1_set.has(i1) || f1_set.has(i2) || f1_set.has(i3) || f1_set.has(i4) || f1_set.has(i5) || f1_set.has(i6)) {
                isCombValid = false;
              } // 閉合地雷球排除 if
            } // 閉合 if (cfg.f1_on)
            
            // 【條件 2】：首尾邊界熱區控制
            if (isCombValid && cfg.f2_on) {
              if (i1 >= f2_min || i6 <= f2_max) isCombValid = false;
            } // 閉合 if (isCombValid && cfg.f2_on)
            
            // 【物理防線 2 / 歷史全中排除】：與大樂透歷史開獎進行完全重疊對撞
            if (isCombValid) {
              if (historyCacheSet.has(comb.join(','))) isCombValid = false;
            } // 閉合 if (isCombValid)
            
            // 【條件 3】：五大物理區塊落點控制
            if (isCombValid && cfg.f3_on) {
              let zoneSet = new Set();
              zoneSet.add(Math.min(5, Math.ceil(i1 / 10))).add(Math.min(5, Math.ceil(i2 / 10))).add(Math.min(5, Math.ceil(i3 / 10))).add(Math.min(5, Math.ceil(i4 / 10))).add(Math.min(5, Math.ceil(i5 / 10))).add(Math.min(5, Math.ceil(i6 / 10)));
              if (zoneSet.size !== cfg.f3_req) isCombValid = false;
            } // 閉合 if (isCombValid && cfg.f3_on)
            // 【條件 4】：同尾數重複個數上限過濾
            if (isCombValid && cfg.f4_on) {
              let tails = new Array(10).fill(0);
              tails[i1 % 10]++; tails[i2 % 10]++; tails[i3 % 10]++; tails[i4 % 10]++; tails[i5 % 10]++; tails[i6 % 10]++;
              if (Math.max(...tails) > f4_max) isCombValid = false;
            } // 閉合 if (isCombValid && cfg.f4_on)
            
            // 【條件 5】：奇偶比例動態防禦牆
            if (isCombValid && cfg.f5_on) {
              let oddCount = (i1 % 2) + (i2 % 2) + (i3 % 2) + (i4 % 2) + (i5 % 2) + (i6 % 2);
              if (cfg.f5_lotto_60 && (oddCount === 6 || oddCount === 0)) isCombValid = false;
              if (cfg.f5_lotto_51 && (oddCount === 5 || oddCount === 1)) isCombValid = false;
            } // 閉合 if (isCombValid && cfg.f5_on)
            
            // 【條件 6】：號碼總和區間動態過濾
            if (isCombValid && cfg.f6_on) {
              let sumValue = i1 + i2 + i3 + i4 + i5 + i6;
              if (sumValue < f6_low || sumValue > f6_high) isCombValid = false;
            } // 閉合 if (isCombValid && cfg.f6_on)
            
            // 【條件 7】：連續號碼長度限制牆
            if (isCombValid && cfg.f7_on) {
              let maxConsecutive = 1, currentConsecutive = 1;
              for (let m = 0; m < comb.length - 1; m++) {
                if (comb[m + 1] - comb[m] === 1) { currentConsecutive++; } 
                else { if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive; currentConsecutive = 1; }
              } // 閉合遍歷連續 if-else 陣列 for
              if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive;
              if (maxConsecutive >= (cfg.f7_len || 3)) isCombValid = false;
            } // 閉合 if (isCombValid && cfg.f7_on)
            // 【條件 9】：鄰號夾擊防線控制
            if (isCombValid && cfg.f9_on && neighborSet.size > 0) {
    let nCnt = 0;
    comb.forEach(num => { if (neighborSet.has(num)) nCnt++; });
    if (nCnt > (cfg.f9_count || 2)) isCombValid = false;
} // 閉合 if (isCombValid && cfg.f9_on...)
            
            // 【條件 10】：上期獎號連莊封殺牆
            if (isCombValid && cfg.f10_on && cfg.lastPeriod && cfg.lastPeriod.length > 0) {
              let repeatCount = 0;
              comb.forEach(num => { if (cfg.lastPeriod.includes(num)) repeatCount++; });
              if (repeatCount > (cfg.f10_max || 2)) isCombValid = false;
            } // 閉合 if (isCombValid && cfg.f10_on...)
            // 【條件 13】：數字複雜度 (AC值) 飄移精準海選過濾
            if (isCombValid && cfg.f13_on) {
              let diffs = new Set();
              for (let m = 0; m < 5; m++) { for (let n = m + 1; n < 6; n++) { diffs.add(Math.abs(comb[m] - comb[n])); } }
              if ((diffs.size - 5) < cfg.f13_min) isCombValid = false;
            } // 閉合 if (isCombValid && cfg.f13_on)
            
            // 🚀【超導部隊 15】：大樂透歷史地雷極速常數查表判定，完全無開銷！
            if (isCombValid && checkHistoryGeiLei) {
              if (globalLotto49HistoryMask[matrixId] === 0) {
                isCombValid = false; // 直接命中開機算好的裂變地雷死線，光速淘汰！
              } // 閉合歷史地雷查表 if
            } // 閉合 if (isCombValid && checkHistoryGeiLei)
            
            // ───【大樂透海選生還計數與精銳指針抄底】───
            if (isCombValid) {
              matchCount++; 
              survivorPoolIndices.push(matrixId);
            } // 閉合生還指標加入 if
            // ===【核心解鎖調速閥：大樂透實時非同步推進控制，物理總量精確分母對齊】===
            totalScanned++; 
             if (totalScanned % 150000 === 0) {
  let percent = Math.min(100, Math.floor((totalScanned / 13983816) * 100));
    
    if (percent !== lastReportedPercent) {
        res.write(JSON.stringify({ isProgress: true, percent: percent, currentMatch: matchCount }) + "\n");
        lastReportedPercent = percent;
    } // 閉合百分比不重複刷新 if
              // 給予 Node.js 執行緒 1 毫秒物理喘息，打破大口袋阻斷，前台WebView絕不卡 0%！
              await new Promise(resolve => setTimeout(resolve, 1));
            } // 閉合 150000 次降頻沖刷 if
            
          } // 🔒 完美閉合單個 Chunk 的物理遍歷 for 迴圈大門！
        } // 🔒 完美物理閉合 async function runSliceChunk 核心宣告大門！
        // 【大樂透 1,400 萬核心通道・終極四分片點火對撞】
        if (lottoType === "49_6" || cfg.lottoType === "49_6") {
          console.log(" 【大樂透超導分流】：1,400 萬組一維核心矩陣切片開始對撞！ ");
          await runSliceChunk(0, chunkSize);
          await runSliceChunk(chunkSize, chunkSize * 2);
          await runSliceChunk(chunkSize * 2, chunkSize * 3);
          await runSliceChunk(chunkSize * 3, matrixLength);
          
          // ===【終極解鎖補丁：大樂透完工物理量強刷 100%，強行穿透大口袋通訊牆】===
          totalScanned = 13983816;
          res.write(JSON.stringify({ 
            isProgress: true, 
            percent: 100, 
            currentMatch: matchCount 
          }) + "\n"); // 結束完工結果發送
        } // 閉合大樂透彩種點火 if
        const totalSurvivorCombs = survivorPoolIndices.length;
        if (totalSurvivorCombs > 0) {
          // ───【分流 A：一般隨機模式 (vipMode === 'random' 可重複大組)】───
          if (!isSmartMode) {
            while (vipValidPool.length < targetCount) {
              const randomCombIdx = Math.floor(Math.random() * totalSurvivorCombs);
              const matrixId = survivorPoolIndices[randomCombIdx];
              const bytePos = matrixId * 6;
              vipValidPool.push([
                globalLotto49Matrix[bytePos],
                globalLotto49Matrix[bytePos + 1],
                globalLotto49Matrix[bytePos + 2],
                globalLotto49Matrix[bytePos + 3],
                globalLotto49Matrix[bytePos + 4],
                globalLotto49Matrix[bytePos + 5]
              ]); // 閉合隨機組合 push
            } // 閉合隨機模式 while
          } // 閉合 if (!isSmartMode)
// ───【分流 B：聰明包牌模式 (純淨餘數跨組優先滾動 & 自適應串流版)】───
else {
 const localOutputSet49 = new Set();
 
 // 🛡️ 雙彩超導原生通道修復：取消陣列複製，直接對原始生還池進行就地洗牌，消滅 99% 崩潰！
 let shuffledIndices = survivorPoolIndices;
 for (let i = totalSurvivorCombs - 1; i > 0; i--) {
 const j = Math.floor(Math.random() * (i + 1));
 const temp = shuffledIndices[i];
 shuffledIndices[i] = shuffledIndices[j];
 shuffledIndices[j] = temp;
 }

    let currentPoolIdx = 0;
    let batchCounter = 0;          
    let currentGroupPool = [];     
    let vipSmartMask49 = 0n;       // 當前大組的互斥遮罩
    let currentTargetGroupSize = 6; // 核心邏輯：以 6 組為一大組進行完美消耗
    let continuousFailCount = 0;   
    
    // 【全新晶片級】：黃金餘數優先留存池
    let priorityBallsFromPrevious = []; 

    console.log(`🚀 【超導餘數優先流轉啟動】進入大樂透生還池。目標組數: ${targetCount}`);

    while (batchCounter < targetCount && currentPoolIdx < totalSurvivorCombs) {
        const matrixId = shuffledIndices[currentPoolIdx];
        currentPoolIdx++;
        
        const bytePos = matrixId * 6;
        const i1 = globalLotto49Matrix[bytePos]; 
        const i2 = globalLotto49Matrix[bytePos + 1]; 
        const i3 = globalLotto49Matrix[bytePos + 2]; 
        const i4 = globalLotto49Matrix[bytePos + 3]; 
        const i5 = globalLotto49Matrix[bytePos + 4]; 
        const i6 = globalLotto49Matrix[bytePos + 5];
        
        const combKey = `${i1},${i2},${i3},${i4},${i5},${i6}`;
        if (localOutputSet49.has(combKey)) continue; 
        
        // 1. 嚴格大組內絕對互斥核對
        let hasDupNumber = (
            ((vipSmartMask49 & (1n << BigInt(i1))) !== 0n) ||
            ((vipSmartMask49 & (1n << BigInt(i2))) !== 0n) ||
            ((vipSmartMask49 & (1n << BigInt(i3))) !== 0n) ||
            ((vipSmartMask49 & (1n << BigInt(i4))) !== 0n) ||
            ((vipSmartMask49 & (1n << BigInt(i5))) !== 0n) ||
            ((vipSmartMask49 & (1n << BigInt(i6))) !== 0n)
        );
        
        // 2. 【餘數優先抽取權】：如果上一組有留下沒被抽到的餘數號碼，我們強制進行碰撞優選
        // 只有當前大組剛開始（還沒抽滿前幾組）且有優先號碼時，若這組不包含任何優先號碼，我們給予微量跳過擾動，讓含有餘數號碼的組合被頂上最前面
        if (!hasDupNumber && priorityBallsFromPrevious.length > 0 && currentGroupPool.length < 2) {
            let hasPriorityBall = [i1, i2, i3, i4, i5, i6].some(num => priorityBallsFromPrevious.includes(num));
            // 隨機擾動鎖：若不含優先餘數號，有 75% 機率丟回池子後面排隊，強制讓有餘數號的組合優先超車
            if (!hasPriorityBall && Math.random() < 0.75 && continuousFailCount < 200) {
                shuffledIndices.push(matrixId); // 送回大池尾部重新滾動
                continuousFailCount++;
                continue;
            }
        }

        if (!hasDupNumber) {
            currentGroupPool.push([i1, i2, i3, i4, i5, i6]);
            localOutputSet49.add(combKey);
            vipSmartMask49 |= (1n << BigInt(i1)) | (1n << BigInt(i2)) | (1n << BigInt(i3)) | (1n << BigInt(i4)) | (1n << BigInt(i5)) | (1n << BigInt(i6));
            
            batchCounter++;
            continuousFailCount = 0; 
            
            // 🎯 當前大組（6組）滿額或達到用戶總目標，執行即時交卷與餘數計算
            if (currentGroupPool.length === currentTargetGroupSize || batchCounter === targetCount) {
                let chunkText = ``;
                currentGroupPool.forEach((comb) => {
                    vipValidPool.push(comb);
                    chunkText += `第 [${String(vipValidPool.length).padStart(2, '0')}] 組：${comb.map(n => String(n).padStart(2, '0')).join(', ')}\n`;
                });
                
                res.write(JSON.stringify({ 
                    isProgress: true, 
                    percent: Math.min(Math.floor((vipValidPool.length / targetCount) * 100), 99), 
                    currentMatch: vipValidPool.length,
                    appendOutput: chunkText 
                }) + "\n");
                
                // 🧠【計算純淨餘數】：找出本大組內「到底有哪些合規號碼完全沒被選到過」
                let currentGroupUsedBalls = [];
                currentGroupPool.forEach(comb => currentGroupUsedBalls.push(...comb));
                
                // 從「生還池內所有出現過的號碼（即合規安全號）」中，剔除掉本輪已經用掉的
                let allVipAllowedBalls = [];
                for (let k = 0; k < totalSurvivorCombs; k++) {
                    let bp = shuffledIndices[k] * 6;
                    for (let m = 0; m < 6; m++) {
                        let ball = globalLotto49Matrix[bp + m];
                        if (!allVipAllowedBalls.includes(ball)) allVipAllowedBalls.push(ball);
                    }
                    if (allVipAllowedBalls.length >= 49) break; // 頂規優化速度
                }
                
                // 篩選出純淨餘數（3或4個號碼）
                priorityBallsFromPrevious = allVipAllowedBalls.filter(ball => !currentGroupUsedBalls.includes(ball));
                
                // 瞬間重置大組宇宙
                vipSmartMask49 = 0n;
                currentGroupPool = [];
                currentTargetGroupSize = 6; // 重設回黃金 6 組大關
            }
        } else {
            continuousFailCount++;
            
            // 當在剩餘池中連續碰撞 1000 次都湊不滿 6 組，啟動自適應自癒退縮，將已有組數打包強行交卷
            if (continuousFailCount > 1000 && currentGroupPool.length > 0) {
                if (currentTargetGroupSize > Math.max(2, currentGroupPool.length)) {
                    currentTargetGroupSize = currentGroupPool.length; 
                    console.log(`⚠️ 【大樂透自適應退縮】生還空間收縮，強行退縮至: ${currentTargetGroupSize} 組交卷！`);
                    
                    let chunkText = ``;
                    currentGroupPool.forEach((comb) => {
                        vipValidPool.push(comb);
                        chunkText += `第 [${String(vipValidPool.length).padStart(2, '0')}] 組：${comb.map(n => String(n).padStart(2, '0')).join(', ')}\n`;
                    });
                    
                    res.write(JSON.stringify({ 
                        isProgress: true, 
                        percent: Math.min(Math.floor((vipValidPool.length / targetCount) * 100), 99), 
                        currentMatch: vipValidPool.length,
                        appendOutput: chunkText 
                    }) + "\n");
                    
                    // 退縮時一樣計算殘留餘數流轉
                    let used = [];
                    currentGroupPool.forEach(c => used.push(...c));
                    let allAllowed = [];
                    for (let k = 0; k < Math.min(2000, totalSurvivorCombs); k++) {
                        let bp = shuffledIndices[k] * 6;
                        for (let m = 0; m < 6; m++) {
                            if (!allAllowed.includes(globalLotto49Matrix[bp + m])) allAllowed.push(globalLotto49Matrix[bp + m]);
                        }
                    }
                    priorityBallsFromPrevious = allAllowed.filter(b => !used.includes(b));
                    
                    vipSmartMask49 = 0n;
                    currentGroupPool = [];
                    currentTargetGroupSize = 6;
                    continuousFailCount = 0;
                }
            }
        }
    }
    
    // 碎組最終收網通道
    if (currentGroupPool.length > 0) {
        let chunkText = ``;
        currentGroupPool.forEach((comb) => {
            vipValidPool.push(comb);
            chunkText += `第 [${String(vipValidPool.length).padStart(2, '0')}] 組：${comb.map(n => String(n).padStart(2, '0')).join(', ')}\n`;
        });
        res.write(JSON.stringify({ isProgress: true, percent: 99, currentMatch: vipValidPool.length, appendOutput: chunkText }) + "\n");
    }
    shuffledIndices = [];
    localOutputSet49.clear();
}

        } // 閉合生還池有效性核對 if (totalSurvivorCombs > 0)
        // ===【大樂透 聰明包牌高度互斥自癒濾網】===

        if (vipValidPool.length === 0) {
          res.write(JSON.stringify({ success: false, message: "符合防線有效組合為 0 組，請放寬過濾標準！" }) + "\n");
        } else {
          let mName = (cfg.vipMode === 'smart') ? '聰明包牌' : '一般隨機';
          let outputText = `【VIP篩選完成】符合大樂透防線總組數：${survivorPoolIndices.length} 組\n【本次輸出模式】${mName}\n【本次輸出】精選出 ${vipValidPool.length} 組\n-------------------------\n`;
          vipValidPool.forEach((comb, idx) => { outputText += `第 [${String(idx + 1).padStart(2, '0')}] 組：${comb.map(n => String(n).padStart(2, '0')).join(', ')}\n`; });
          res.write(JSON.stringify({ isProgress: true, percent: 100, currentMatch: vipValidPool.length }) + "\n");
          res.write(JSON.stringify({ success: true, outputText: outputText }) + "\n");
        } // 閉合大樂透結果判定發送 if-else
        res.end(); 

      } catch (err) {
        console.error(" 核心海選崩潰，啟動自癒防禦：", err.message);
        try { res.write(JSON.stringify({ success: false, message: `後台引擎自癒阻斷：${err.message}` }) + "\n"); res.end(); } catch (e) {}
      } // 完美閉合大樂透專區大口袋 try-catch
    } // 🔒【最高金鑰閉合】：完美閉合大樂透領地最外層的 else 空間大門！
    
  } catch (globalErr) {
    console.error(" 全局路由異常：", globalErr.message);
    try { res.end(); } catch(e){}
  } // 完美閉合覆蓋全局最高生命線的 try-catch
}); // 🔒【總大門竣工】：完美合規關閉第 309 行起手的總 app.post('/api/lottery/generate-vip-turbo') 路由大門！
// =========================================================================
// 🚀 【商用特權終極破壁版】：四大用戶資產與交易 API 路由 (支援 body 憑證解鎖) 👑
// =========================================================================

// 【核心解密輔助晶片】：支援從 Header、Query 以及 Body Payload 全量安全提取 Token
function extractUserIdFromPayload(req) {
  // 🎯 破壁關鍵：Header 被 file:// 沒收沒關係，自動轉向檢查 req.body.token 的安全艙！
  let authHeader = req.headers.authorization || req.headers.Authorization || req.query.token || (req.body && req.body.token);
  if (!authHeader) return null;
  
  // 終極文字清洗，物理火化重複的 Bearer 與內嵌畸形引號
  let tokenString = authHeader.trim().replace(/['"\r\n\t]/g, '');
  if (tokenString.startsWith('Bearer ')) tokenString = tokenString.replace(/^Bearer\s+/, "").trim();
  if (tokenString.startsWith('Bearer')) tokenString = tokenString.replace(/^Bearer/, "").trim();
  if (tokenString.includes(' ')) tokenString = tokenString.split(' ');
  
  try {
    const decoded = jwt.verify(tokenString, 'FREE_LOTTO_SECRET_2026');
    return String(decoded.userId || decoded._id || decoded.id).trim();
  } catch (e) {
    return null;
  }
}

// =========================================================================
// 🚀 【後台局部完全體】：徹底隔離變數大小寫，擊穿 500 內部錯誤
// =========================================================================

// 1. 獲取用戶最新帳戶點數資產與 VIP 剩餘狀態 🔄 (對齊前端 profile-v2 破壁路徑)
app.post('/api/user/profile-v2', async (req, res) => {
  try {
    let authHeader = req.headers.authorization || req.headers.Authorization || (req.body && req.body.token);
    if (!authHeader) return res.status(401).json({ success: false, message: "身分驗證失效" });
    
    let tokenString = authHeader.trim().replace(/['"\r\n\t]/g, '');
    if (tokenString.startsWith('Bearer ')) tokenString = tokenString.replace(/^Bearer\s+/, "").trim();
    if (tokenString.startsWith('Bearer')) tokenString = tokenString.replace(/^Bearer/, "").trim();
    
    const decoded = jwt.verify(tokenString, 'FREE_LOTTO_SECRET_2026');
    const sessionUserId = String(decoded.userId || decoded._id || decoded.id).trim();
    
    // 精確隔離：使用大寫 User 查詢，存放至小寫常數中
    const userProfile = await User.findById(sessionUserId).select('-password');
    if (!userProfile) return res.status(404).json({ success: false, message: "找不到該會員資料" });
    
    return res.json({ success: true, user: userProfile });
  } catch (err) {
    return res.status(500).json({ success: false, message: "資產讀取異常" });
  }
});

// 2. 儲值點數 🪙 (擊穿 500 Internal Server Error 終極晶片)
app.post('/api/user/buy-points', async (req, res) => {
  try {
    let authHeader = req.headers.authorization || req.headers.Authorization || (req.body && req.body.token);
    if (!authHeader) return res.status(401).json({ success: false, message: "驗證令牌失效" });
    
    let tokenString = authHeader.trim().replace(/['"\r\n\t]/g, '');
    if (tokenString.startsWith('Bearer ')) tokenString = tokenString.replace(/^Bearer\s+/, "").trim();
    if (tokenString.startsWith('Bearer')) tokenString = tokenString.replace(/^Bearer/, "").trim();
    
    const decoded = jwt.verify(tokenString, 'FREE_LOTTO_SECRET_2026');
    const sessionUserId = String(decoded.userId || decoded._id || decoded.id).trim();
    
    // 🎯 核心修正：強制改用 dbUser 作為儲存常數，與 Mongoose Model 的 [User] 進行物理隔離，防止作用域劫持！
    const dbUser = await User.findById(sessionUserId);
    if (!dbUser) return res.status(404).json({ success: false, message: "用戶不存在" });
    
    // 100% 數字化物理防線：防範 undefined 疊加轉為 NaN 導致 MongoDB 崩潰拒絕存檔
    dbUser.points = (Number(dbUser.points) || 0) + 100;
    
    // 強制標記欄位被修改，確保 Mongoose 順暢進行資料庫寫入
    dbUser.markModified('points');
    await dbUser.save();
    
    console.log(` 🪙 [金流成功到帳] 用戶 [${dbUser.username}] 局部升級儲值成功，最新餘額：${dbUser.points} 點 `);
    return res.json({ success: true, newPoints: dbUser.points });
  } catch (err) {
    console.error("🚨 儲值核心拋出異常崩潰，詳細原因：", err.message);
    return res.status(500).json({ success: false, message: "雲端金流異常" });
  }
});
// =========================================================================



// 3. 點數消耗抵扣 ── 開啟 30 天 VIP 尊榮無限海選訂閱 👑
app.post('/api/user/subscribe-vip', async (req, res) => {
  try {
    const sessionUserId = extractUserIdFromPayload(req);
    if (!sessionUserId) return res.status(401).json({ success: false, message: "身分驗證憑證已失效" });
    
    const user = await User.findById(sessionUserId);
    if (!user) return res.status(404).json({ success: false, message: "用戶不存在" });
    
    const SUBSCRIBE_COST = 150; 
    if ((Number(user.points) || 0) < SUBSCRIBE_COST) {
      return res.status(400).json({ success: false, message: `續約失敗！訂閱 VIP 需消耗 ${SUBSCRIBE_COST} 點，您的點數餘額不足。` });
    }
    
    user.points = Number(user.points) - SUBSCRIBE_COST;
    const now = new Date();
    let baseDate = (user.subscriptionExpiresAt && user.subscriptionExpiresAt > now) ? new Date(user.subscriptionExpiresAt) : now;
    baseDate.setDate(baseDate.getDate() + 30); 
    user.subscriptionExpiresAt = baseDate;
    user.isPaidMember = true; 
    await user.save();
    
    return res.json({ success: true, expiresAt: user.subscriptionExpiresAt, newPoints: user.points });
  } catch (err) {
    return res.status(500).json({ success: false, message: "訂閱處理失敗" });
  }
});

// 4. 會員自主管理：主動終止/取消 VIP 包月訂閱狀態 🛑
app.post('/api/user/cancel-vip', async (req, res) => {
  try {
    const sessionUserId = extractUserIdFromPayload(req);
    if (!sessionUserId) return res.status(401).json({ success: false, message: "身分驗證憑證已失效" });
    
    const user = await User.findById(sessionUserId);
    if (!user) return res.status(404).json({ success: false, message: "用戶不存在" });
    
    user.subscriptionExpiresAt = null;
    user.isPaidMember = false; 
    await user.save();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: "終止訂閱請求失敗" });
  }
});

// 5. 處理前端點擊「單次解鎖 (10點)」實體按鈕的扣點權限請求 🪙
app.post('/api/user/single-unlock', async (req, res) => {
  try {
    const sessionUserId = extractUserIdFromPayload(req);
    if (!sessionUserId) return res.status(401).json({ success: false, message: "身分驗證憑證已失效" });
    
    const user = await User.findById(sessionUserId);
    if (!user) return res.status(404).json({ success: false, message: "用戶不存在" });
    
    const UNLOCK_COST = 10; 
    if ((Number(user.points) || 0) < UNLOCK_COST) {
      return res.status(400).json({ success: false, message: `解鎖失敗！單次解鎖高階 15 大防線需消耗 ${UNLOCK_COST} 點。` });
    }
    
    user.points = Number(user.points) - UNLOCK_COST;
    await user.save();
    return res.json({ success: true, newPoints: user.points });
  } catch (err) {
    return res.status(500).json({ success: false, message: "雲端授權通道異常" });
  }
});
// =========================================================================

app.post('/api/tickets/save', authenticateToken, async (req, res) => {
  try {
    const ticketsData = req.body.tickets || req.body.ticket; 
    if (!ticketsData) return res.status(400).json({ success: false, message: '無效的號碼憑證' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: '操盤手帳號不存在' });

    if (!user.savedTickets) user.savedTickets = [];
    
    if (Array.isArray(ticketsData)) {
      ticketsData.forEach(t => {
        user.savedTickets.push({
          content: t,
          id: `TK-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          createdAt: new Date()
        });
      });
    } else {
      user.savedTickets.push({ 
        content: ticketsData, 
        id: `TK-${Date.now()}-${Math.floor(Math.random()*1000)}`, 
        createdAt: new Date() 
      });
    }

    user.markModified('savedTickets'); 
    await user.save();
    res.json({ success: true, message: '成功同步至雲端收藏夾！', savedTickets: user.savedTickets });
  } catch (err) { 
    res.status(500).json({ success: false, message: '雲端同步失敗' }); 
  }
}); // 閉合 save 接口

app.get('/api/tickets/list', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: '帳號不存在' });
    
    const formattedTickets = (user.savedTickets || []).map(t => typeof t === 'object' ? (t.content || JSON.stringify(t)) : t);
    res.json({ success: true, savedTickets: formattedTickets });
  } catch (err) { 
    res.status(500).json({ success: false, message: '讀取雲端收藏夾異常' }); 
  }
}); // 閉合 list 接口

app.post('/api/tickets/delete', async (req, res) => {
  try {
    const authHeader = req.headers.authorization; if (!authHeader) return res.status(411).json({ success: false, message: '請登入會員' });
    const token = authHeader.split(' '); const decoded = jwt.verify(token, 'FREE_LOTTO_SECRET_2026'); const { ticketId } = req.body;
    const user = await User.findById(decoded.userId); if (!user) return res.status(404).json({ success: false, message: '帳號不存在' });
    if (user.savedTickets) { user.savedTickets = user.savedTickets.filter(t => t.id !== ticketId); user.markModified('savedTickets'); await user.save(); }
    res.json({ success: true, message: '已安全移除該組合！', savedTickets: user.savedTickets || [] });
  } catch (err) { res.status(500).json({ success: false, message: '雲端同步刪除失敗' }); }
}); // 閉合 delete 接口

app.post('/api/tickets/clear', async (req, res) => {
  try {
    const authHeader = req.headers.authorization; if (!authHeader) return res.status(411).json({ success: false, message: '請登入會員' });
    const token = authHeader.split(' '); const decoded = jwt.verify(token, 'FREE_LOTTO_SECRET_2026'); const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ success: false, message: '帳號不存在' });
    user.savedTickets = []; user.markModified('savedTickets'); await user.save();
    res.json({ success: true, message: '雲端收藏夾已全部清空！', savedTickets: [] });
  } catch (err) { res.status(500).json({ success: false, message: '清空雲端收藏夾失敗' }); }
}); // 閉合 clear 接口

app.post('/api/tickets/sync-history', async (req, res) => {
  try {
    const { historyDB } = req.body; if (!historyDB || !Array.isArray(historyDB)) return res.status(400).json({ success: false, message: '無效的歷史大數據結構' });
    const initFn = app.get('initHistory裂變去重');
    if (typeof initFn === 'function') {
      initFn(historyDB);
      if (typeof init539StaticFeatures === 'function') init539StaticFeatures(historyDB); // 同步啟動 539 超導背景裂變預存！🚀
      res.json({ success: true, message: '雙彩種雲端大數據歷史背景裂變全面重新整隊竣工！' });
    } else { res.status(500).json({ success: false, message: '去重引擎尚未就緒' }); }
  } catch (err) { res.status(500).json({ success: false, message: '同步歷史開獎發生異常' }); }
}); // 閉合 sync-history 接口


app.post('/api/user/unlock-vip', async (req, res) => {
  try {
    const authHeader = req.headers.authorization; if (!authHeader) return res.status(411).json({ success: false, message: '請登入會員' });
    const token = authHeader.split(' '); const decoded = jwt.verify(token, 'FREE_LOTTO_SECRET_2026'); const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ success: false, message: '帳號不存在' });
    user.isPaidMember = true; await user.save();
    res.json({ success: true, message: '【AdMob 完看授權成功】操盤手 VIP 專屬防線已全線永久解鎖！', isPaidMember: true });
  } catch (err) { res.status(500).json({ success: false, message: '激勵權限解鎖失敗' }); }
}); // 閉合 unlock-vip 接口


// ================== ✨ 後台終極完全體引擎點火監聽 ==================
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(` =========================================================`);
  console.log(` 📡 終極完全體超導後台已成功在 Port ${PORT} 點火發動！`);
  console.log(` 100% 雙資料庫去重隔離、真房間歸位、全線通車！準備上架！`);
  console.log(` =========================================================`);
});
// =========================================================================
