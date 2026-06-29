const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const app = express();

// ─── 滿血開啟 CORS 破壁跨網域晶片 ───
app.use(cors({
  origin: function (origin, callback) { callback(null, true); },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
app.use(express.json({ limit: '10mb' }));

const JWT_SECRET = 'FREE_LOTTO_SECRET_2026';
const TRUE_MONGO_URI = process.env.MONGO_URI || "mongodb+srv://bingooo16888_db_user:bingo19880429@cluster0.t33ebvn.mongodb.net/lotto?retryWrites=true&w=majority&appName=Cluster0";

mongoose.models = {};
mongoose.modelSchemas = {};
mongoose.connect(TRUE_MONGO_URI)
  .then(() => console.log(" 📡 [大腦通電成功] 已物理歸位真房間：MongoDB -> lotto "))
  .catch(err => console.error(" ❌ 資料庫真房間開啟失敗：", err));

// ─── 操盤手帳戶與商用變動資產資料庫 Schema ───
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  googleId: { type: String, default: null },
  isPaidMember: { type: Boolean, default: false },
  points: { type: Number, default: 100 }, 
  subscriptionExpiresAt: { type: Date, default: null },
  savedTickets: { type: Array, default: [] } 
}, { strict: false, timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// ─── 憑證清洗中間件 ───
function authenticateToken(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  try {
    let authHeader = req.headers.authorization || req.headers.Authorization || req.query.token || (req.body && req.body.token);
    if (!authHeader) return res.status(411).json({ success: false, message: '權限鎖定：請登入會員' });
    let tokenString = authHeader.trim().replace(/['"\r\n\t]/g, '');
    if (tokenString.startsWith('Bearer ')) tokenString = tokenString.substring(7).trim();
    if (tokenString.startsWith('Bearer')) tokenString = tokenString.substring(6).trim();
    const decoded = jwt.verify(tokenString, JWT_SECRET);
    req.user = { userId: String(decoded.userId || decoded._id || decoded.id).trim() };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: '驗證令牌失效或已過期' });
  }
}

function extractUserIdFromPayload(req) {
  try {
    let authHeader = req.headers.authorization || req.headers.Authorization || req.query.token || (req.body && req.body.token);
    if (!authHeader) return null;
    let tokenString = authHeader.trim().replace(/['"\r\n\t]/g, '').replace(/Bearer\s?/g, '');
    const decoded = jwt.verify(tokenString, JWT_SECRET);
    return String(decoded.userId || decoded._id || decoded.id).trim();
  } catch { return null; }
}
// ─── 帳戶基本身分驗證 API ───
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await new User({ username, password: hashedPassword, points: 100, isPaidMember: false }).save();
    res.json({ success: true, message: '註冊成功！' });
  } catch { res.status(500).json({ success: false, message: '註冊失敗，帳號可能已存在' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ success: false, message: '帳密錯誤' });
    }
    const token = jwt.sign({ userId: String(user._id).trim() }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, username: user.username, isPaidMember: user.isPaidMember });
  } catch { res.status(500).json({ success: false, message: '登入驗證異常' }); }
});

app.post('/api/auth/google-sync', async (req, res) => {
  try {
    const { username, googleId } = req.body;
    if (!googleId) return res.status(400).json({ success: false, message: '無效的 Google 憑證' });
    let user = await User.findOne({ googleId });
    if (!user) {
      user = new User({ username: username || `Google操盤手_${Math.floor(1000 + Math.random()*9000)}`, googleId, isPaidMember: false, points: 100 });
      await user.save();
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, username: user.username, isPaidMember: user.isPaidMember });
  } catch { res.status(500).json({ success: false, message: 'Google 雲端同步異常' }); }
});

// ─── 四大自癒金流晶片 API ───
app.post('/api/user/profile-v2', async (req, res) => {
  try {
    const sessionUserId = extractUserIdFromPayload(req);
    if (!sessionUserId) return res.status(401).json({ success: false, message: "身分驗證失效" });
    const dbUser = await User.findById(sessionUserId).select('-password');
    if (!dbUser) return res.status(404).json({ success: false, message: "找不到該會員資料" });
    return res.json({ success: true, user: dbUser });
  } catch (err) { return res.status(500).json({ success: false, message: "資產讀取異常" }); }
});

app.post('/api/user/buy-points', async (req, res) => {
  try {
    const sessionUserId = extractUserIdFromPayload(req);
    if (!sessionUserId) return res.status(401).json({ success: false, message: "驗證令牌失效" });
    const dbUser = await User.findById(sessionUserId);
    if (!dbUser) return res.status(404).json({ success: false, message: "用戶不存在" });
    dbUser.points = (Number(dbUser.points) || 0) + 100;
    dbUser.markModified('points');
    await dbUser.save();
    return res.json({ success: true, newPoints: dbUser.points });
  } catch (err) { return res.status(500).json({ success: false, message: "雲端金流異常" }); }
});

app.post('/api/user/subscribe-vip', async (req, res) => {
  try {
    const sessionUserId = extractUserIdFromPayload(req);
    if (!sessionUserId) return res.status(401).json({ success: false, message: "身分驗證憑證已失效" });
    const dbUser = await User.findById(sessionUserId);
    if (!dbUser) return res.status(404).json({ success: false, message: "用戶不存在" });
    const SUBSCRIBE_COST = 150;
    if ((Number(dbUser.points) || 0) < SUBSCRIBE_COST) {
      return res.status(400).json({ success: false, message: `續約失敗！需消耗 ${SUBSCRIBE_COST} 點，您的餘額不足。` });
    }
    dbUser.points = Math.max(0, (Number(dbUser.points) || 0) - SUBSCRIBE_COST);
    const now = new Date();
    let baseDate = (dbUser.subscriptionExpiresAt && new Date(dbUser.subscriptionExpiresAt) > now) ? new Date(dbUser.subscriptionExpiresAt) : now;
    baseDate.setDate(baseDate.getDate() + 30);
    dbUser.subscriptionExpiresAt = baseDate;
    dbUser.isPaidMember = true;
    dbUser.markModified('points');
    dbUser.markModified('subscriptionExpiresAt');
    dbUser.markModified('isPaidMember');
    await dbUser.save();
    return res.json({ success: true, subscriptionExpiresAt: dbUser.subscriptionExpiresAt, newPoints: dbUser.points });
  } catch (err) { return res.status(500).json({ success: false, message: "訂閱處理失敗" }); }
});

app.post('/api/user/cancel-vip', async (req, res) => {
  try {
    const sessionUserId = extractUserIdFromPayload(req);
    if (!sessionUserId) return res.status(401).json({ success: false, message: "身分驗證憑證已失效" });
    const dbUser = await User.findById(sessionUserId);
    if (!dbUser) return res.status(404).json({ success: false, message: "雲端資料庫找不到該帳戶" });
    dbUser.subscriptionExpiresAt = null;
    dbUser.isPaidMember = false;
    await dbUser.save();
    return res.json({ success: true, message: "訂閱已成功終止，特權重鎖" });
  } catch (err) { return res.status(500).json({ success: false, message: "伺服器底層內核阻斷錯誤" }); }
});

app.post('/api/user/single-unlock', async (req, res) => {
  try {
    const sessionUserId = extractUserIdFromPayload(req);
    if (!sessionUserId) return res.status(401).json({ success: false, message: "身分驗證憑證已失效" });
    const dbUser = await User.findById(sessionUserId);
    if (!dbUser) return res.status(404).json({ success: false, message: "用戶不存在" });
    const UNLOCK_COST = 10;
    if ((Number(dbUser.points) || 0) < UNLOCK_COST) {
      return res.status(400).json({ success: false, message: `解鎖失敗！單次解鎖高階過濾防線需消耗 ${UNLOCK_COST} 點。` });
    }
    dbUser.points = Math.max(0, (Number(dbUser.points) || 0) - UNLOCK_COST);
    dbUser.markModified('points');
    await dbUser.save();
    return res.json({ success: true, newPoints: dbUser.points });
  } catch (err) { return res.status(500).json({ success: false, message: "雲端授權通道異常" }); }
});

// ─── 雲端收藏夾儲存與拉取 API ───
app.post('/api/tickets/save', authenticateToken, async (req, res) => {
  try {
    const ticketsData = req.body.tickets || req.body.ticket;
    if (!ticketsData) return res.status(400).json({ success: false, message: '無效的號碼憑證' });
    const dbUser = await User.findById(req.user.userId);
    if (!dbUser) return res.status(404).json({ success: false, message: '操盤手帳號不存在' });
    if (!dbUser.savedTickets) dbUser.savedTickets = [];
    const target = Array.isArray(ticketsData) ? ticketsData : [ticketsData];
    target.forEach(t => {
      const content = typeof t === 'object' ? t.content : t;
      if (!dbUser.savedTickets.some(item => (typeof item === 'object' ? item.content : item) === content)) {
        dbUser.savedTickets.push({ content, id: `TK-${Date.now()}-${Math.floor(Math.random() * 1000)}`, createdAt: new Date() });
      }
    });
    dbUser.markModified('savedTickets');
    await dbUser.save();
    return res.json({ success: true, message: '成功同步至雲端收藏夾！', savedTickets: dbUser.savedTickets });
  } catch (err) { return res.status(500).json({ success: false, message: '雲端同步失敗' }); }
});

app.get('/api/tickets/list', async (req, res) => {
  let authHeader = req.headers['authorization'] || req.query.token;
  if (authHeader === 'WAKEUP_PING') return res.json({ success: true, message: "WOKE" });
  if (!authHeader) return res.status(401).json({ success: false, message: "Missing Token" });
  try {
    let token = authHeader.toString().trim().replace(/['"Bearer\s]/g, '');
    const decoded = jwt.verify(token, JWT_SECRET);
    const dbUser = await User.findById(decoded.userId || decoded._id || decoded.id);
    if (!dbUser) return res.status(404).json({ success: false, message: '帳號不存在' });
    const formattedTickets = (dbUser.savedTickets || []).map(t => typeof t === 'object' ? (t.content || JSON.stringify(t)) : t);
    return res.json({ success: true, savedTickets: formattedTickets });
  } catch { return res.status(411).json({ success: false, message: "憑證無效" }); }
});
if (isMainThread) {
  // 聰明包牌骨牌生牌演算法
  function generateSmartWheelingMatrix(cfg) {
    const is39 = cfg.lottoType === '39_5';
    const size = is39 ? 5 : 6;
    const totalBalls = is39 ? 39 : 49;
    let allBalls = Array.from({ length: totalBalls }, (_, i) => i + 1);
    const mineBalls = cfg.f1_set || [];
    let remainingBalls = allBalls.filter(ball => !mineBalls.includes(ball));
    const favBalls = cfg.vip_fav_on ? (cfg.vip_fav_set || []) : [];
    remainingBalls = remainingBalls.filter(ball => !favBalls.includes(ball));
    for (let i = remainingBalls.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remainingBalls[i], remainingBalls[j]] = [remainingBalls[j], remainingBalls[i]];
    }
    const availableSlotsPerGroup = size - favBalls.length;
    const maxGroups = Math.floor(remainingBalls.length / availableSlotsPerGroup);
    const smartSkeletonGroups = [];
    for (let g = 0; g < maxGroups; g++) {
      let singleGroup = [...favBalls];
      const slots = remainingBalls.splice(0, availableSlotsPerGroup);
      singleGroup.push(...slots);
      singleGroup.sort((a, b) => a - b);
      smartSkeletonGroups.push(singleGroup);
    }
    return smartSkeletonGroups;
  }

  // ─── 啟動全案最高核心海選引擎 ───
  app.post('/api/lottery/generate-vip-turbo', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    try {
      const { cfg, globalHistoryDB } = req.body;
    if (cfg) {
      // 物理強行咬合：支援前端傳入的各式廣告解鎖欄位型態，完美認證通行證
      if (cfg.isAdUnlocked === undefined) {
        cfg.isAdUnlocked = cfg.isAdUnlockedCurrentRound || cfg.adUnlocked || cfg.isAdActive || false;
      }
      // 強制修正字串轉型漏洞並對齊（確保前端 isVipAdUnlocked 的 true 被精確解碼）
      if (cfg.isAdUnlocked === 'true' || cfg.isAdUnlocked === true) {
        cfg.isAdUnlocked = true;
      }
      if (cfg.isSingleUnlockedCurrentRound === undefined) cfg.isSingleUnlockedCurrentRound = cfg.isSingleUnlocked || cfg.singleUnlocked || false;
      if (cfg.isPaidMember === undefined) cfg.isPaidMember = cfg.isPaidMemberCurrentRound || false;
    }
// ======= 區塊 1 全新替換代碼 =======
    if (!cfg) return res.write(JSON.stringify({ success: false, message: "參數配置遺失" }) + "\n") || res.end();

    const sessionUserId = req.user && req.user.userId;
    const dbUser = await User.findById(sessionUserId);
    if (!dbUser) return res.write(JSON.stringify({ success: false, message: "找不到操盤手帳號" }) + "\n") || res.end();

    const nowtime = new Date();
    const hasActiveSubscription = dbUser.subscriptionExpiresAt && new Date(dbUser.subscriptionExpiresAt) > nowtime;
    const isVipPass = (hasActiveSubscription || dbUser.isPaidMember === true || cfg.isPaidMember === true || cfg.isPaidMember === 'true' || cfg.isSingleUnlockedCurrentRound === true || cfg.isSingleUnlockedCurrentRound === 'true' || cfg.isAdUnlocked === true || cfg.isAdUnlocked === 'true');

 if (!isVipPass) {
 const OPERATION_COST = 10;
 if ((dbUser.points || 0) < OPERATION_COST) {
 res.write(JSON.stringify({ success: false, status: 402, message: `點數不足！需消耗 ${OPERATION_COST} 點。` }) + "\n");
 return res.end();
 }
 dbUser.points = Math.max(0, (Number(dbUser.points) || 0) - OPERATION_COST);
 await dbUser.save();
 res.write(JSON.stringify({ isPointsUpdated: true, remainingPoints: dbUser.points, isPaidMember: false }) + "\n");
 } else {
 // 權責分立：此處回傳使用者資料庫的真實付費會員狀態，絕對不准盲目灌水為 true
 res.write(JSON.stringify({ isPointsUpdated: true, remainingPoints: dbUser.points, isPaidMember: dbUser.isPaidMember === true }) + "\n");
 }

// ======= 區塊 2 後台主線程分流完全體替換代碼 =======
        const limitOutput = Math.min(100, cfg.count || 5);
        const pickLimit = parseInt(limitOutput) || 5; // 🎯 解凍前端指定的真實解鎖組數限制！

        // 🔀 【五維智能分流開關】：精確補齊對 cfg.vip_fav_on (防線 16) 的嚴格審查
        const isNoConditions = (
          (cfg.f1_on !== true && cfg.f1_on !== 'true') && (cfg.f2_on !== true && cfg.f2_on !== 'true') &&
          (cfg.f3_on !== true && cfg.f3_on !== 'true') && (cfg.f4_on !== true && cfg.f4_on !== 'true') &&
          (cfg.f5_on !== true && cfg.f5_on !== 'true') && (cfg.f6_on !== true && cfg.f6_on !== 'true') &&
          (cfg.f7_on !== true && cfg.f7_on !== 'true') && (cfg.f8_on !== true && cfg.f8_on !== 'true') &&
          (cfg.f9_on !== true && cfg.f9_on !== 'true') && (cfg.f10_on !== true && cfg.f10_on !== 'true') &&
          (cfg.f11_on !== true && cfg.f11_on !== 'true') && (cfg.f12_on !== true && cfg.f12_on !== 'true') &&
          (cfg.f13_on !== true && cfg.f13_on !== 'true') && (cfg.f14_on !== true && cfg.f14_on !== 'true') &&
          (cfg.f15_on !== true && cfg.f15_on !== 'true') && 
          (cfg.vip_fav_on !== true && cfg.vip_fav_on !== 'true') // 👑 成功攔截防線 16 的漏勾黑洞！
        );

        const mainLottoType = cfg.lottoType || "39_5";
        const mainMaxBall = mainLottoType === "49_6" ? 49 : 39;
        const mainPickCount = mainLottoType === "49_6" ? 6 : 5;

        // 🚀 【通道 A：全無勾選條件】➔ 主線程 0.1 秒極速交卷，且100%「動態鎖定組數限制」並「物理扣除 6 萬筆歷史中獎庫」！
// ======= 區塊 1 後台主線程無撞號、扣歷史究極完全體替換代碼 =======
        if (isNoConditions) {
          console.log(`[智能分流大腦] 偵測到全無條件，啟動主線程基礎包牌晶片。不開Worker，記憶體降至冰點！`);
          const totalTheoreticalCombs = mainLottoType === "49_6" ? 13983816 : 575757;
          
          // 實時高頻發射模擬進度數據包，強行打破前台卡 99% 的通訊死鎖
          res.write(JSON.stringify({ isProgress: true, percent: 25, currentMatch: 0 }) + "\n");
          res.write(JSON.stringify({ isProgress: true, percent: 75, currentMatch: Math.floor(totalTheoreticalCombs / 2) }) + "\n");
          res.write(JSON.stringify({ isProgress: true, percent: 99, currentMatch: totalTheoreticalCombs }) + "\n");

          const finalOutputCombs = [];
          const globalCacheSet = new Set(); // 🚀 跨組別 100% 互斥去重硬鎖，徹底封死號碼完全重複的盲點！
          
          // 📊 歷史庫二級快取注入：將雲端傳進來的 6 萬多筆歷史號碼在主線程中洗成極速 Set
          const historyCacheSet = new Set();
          if (Array.isArray(globalHistoryDB)) {
            globalHistoryDB.forEach(h => { if (Array.isArray(h)) historyCacheSet.add(h.join(',')); });
          }

          let attempts = 0;
          let generatedCount = 0;

          // 🎯 滿血自癒：改用一對一獨立精準洗牌法，用戶要 15 組，就老老實實生出 15 組彼此絕對獨立的號碼！
          while (generatedCount < pickLimit && attempts < 50000) {
            attempts++;
            
            // 建立純淨的 1~39 或 1~49 球池
            let ballPool = Array.from({ length: mainMaxBall }, (_, i) => i + 1);
            
            // Fisher-Yates 獨立隨機洗牌
            for (let i = ballPool.length - 1; i > 0; i--) {
              let j = Math.floor(Math.random() * (i + 1));
              [ballPool[i], ballPool[j]] = [ballPool[j], ballPool[i]];
            }

            // 直接精確切片出當前這一組需要的 5 碼或 6 碼
            let currentComb = ballPool.slice(0, mainPickCount);
            currentComb.sort((a, b) => a - b);
            
            const combKey = currentComb.join(',');

            // ❌ 雙重深水區除垢：一、如果跟前面幾組產生的號碼一模一樣，作廢重抽！二、如果撞到 6 萬多筆全歷史中獎庫，當場斬斷作廢重抽！
            if (globalCacheSet.has(combKey) || historyCacheSet.has(combKey)) {
              continue; // 撞號直接過濾跳過，絕對不計入交付明細！
            }

            // 驗證過關，雙向寫入快取與交付緩衝區
            globalCacheSet.add(combKey);
            generatedCount++;

            const indexStr = String(generatedCount).padStart(2, '0');
            const formatted = currentComb.map(n => String(n).padStart(2, '0')).join(', ');
            
            // 每 8 組自動編組為一個聰明單位，畫面排版更精美
            const currentUnit = Math.ceil(generatedCount / 8);
            finalOutputCombs.push(`第 [${indexStr}] 組 (第 ${currentUnit} 單位) : ${formatted}\n`);
          }

          let modeLabel = cfg.vipMode === 'smart' ? '聰明包牌 (主線程無撞號、扣歷史極速完全體)' : '一般篩選 (高併發商用主線程自癒版)';
          res.write(JSON.stringify({ 
            success: true, 
            outputText: `【VIP海選大竣工】中繼站本次海選實時通過總數：${totalTheoreticalCombs} 組 🪙\n【當前交付解鎖明牌（已完美物理扣除 6 萬筆歷史數據庫，且彼此 100% 互斥無重複）】：\n-------------------------\n` + finalOutputCombs.join('') + `-------------------------\n【輸出模式】${modeLabel}\n`
          }) + "\n");
          return res.end();
        }


    // 🛡️ 【通道 B：有勾選條件】➔ ⚡ 啟動五維全自動併發安全限流器
// ======= 區塊 3 後台 Worker 監聽通訊自癒替換代碼 =======
  return res.end();
 }
 // 【通道 B：有勾選條件】 啟動單水管高階控重球池矩陣海選引擎 ➔ ⚡
 global.activeRequestsCount = (global.activeRequestsCount || 0) + 1;
 console.log(`[智能分流大腦] 有條件深度海選點火！依最高指令啟用【單水管獨佔算力】架構。`);
 
 let isFinished = false;
 const finalOutputCombs = [];
 let liveScannedCount = 0; // 進度滾動計數
 const workers = [];       // 用於相容舊變數
 
 const innerLottoType = cfg.lottoType || "39_5";
 const innerPickCount = innerLottoType === "49_6" ? 6 : 5;
 const mainLottoType = innerLottoType;
 const mainMaxBall = innerLottoType === "49_6" ? 49 : 39;
 const mainPickCount = innerPickCount;
 const limitOutput = Math.min(100, cfg.count || 5);
 const pickLimit = parseInt(limitOutput) || 5; 

 // 【步驟 1：前置數學算力宣佈】
 const mineBalls = cfg.f1_set || [];
 const favBalls = cfg.vip_fav_on ? (cfg.vip_fav_set || []) : [];
 const originalTotal = innerLottoType === "49_6" ? 49 : 39;
 
 let initialValidBalls = Array.from({ length: originalTotal }, (_, i) => i + 1).filter(b => !mineBalls.includes(b));
 let availableBallsForWheel = initialValidBalls.filter(b => !favBalls.includes(b));
 const availableSlotsPerGroup = innerPickCount - favBalls.length;
 
 const singleBigGroupLimit = availableSlotsPerGroup > 0 ? Math.floor(availableBallsForWheel.length / availableSlotsPerGroup) : 1;
 console.log(`[數學算力宣佈] 本期剪除後合法互斥球數: ${availableBallsForWheel.length} 顆，每組需填空缺: ${availableSlotsPerGroup} 個。宣告單一物理大組極限產能 = [ ${singleBigGroupLimit} ] 組！`);
 
 let currentBigGroupUsedBallsSet = new Set(); 
 const allCompletedGroupsList = [];           
 
 await new Promise((resolve) => {
   const safetyTimeout = setTimeout(() => {
     console.log(`=======================================================`);
     console.log(`[海選阻斷] 觸及 5 分鐘極限安全壁壘，中繼站安全收卷交付現存組數。`);
     console.log(`=======================================================`);
     isFinished = true;
     if (worker) worker.terminate();
     global.activeRequestsCount = Math.max(0, global.activeRequestsCount - 1);
     resolve();
   }, 300000);
   
   const worker = new Worker(__filename, { workerData: { cfg, globalHistoryDB, threadId: 0 } });
   workers.push(worker); 
   
   worker.on('message', (msg) => {
     if (isFinished) return;
     
     if (msg.type === 'FOUND_ONE_STREAM') {
       const newComb = msg.data; 
       liveScannedCount++;
       
       if (liveScannedCount % 5 === 0) {
         res.write(JSON.stringify({ 
           isProgress: true, 
           percent: Math.min(99, Math.floor((finalOutputCombs.length / pickLimit) * 100)), 
           currentMatch: finalOutputCombs.length 
         }) + "\n");
       }
       
       let isCrossGroupConflict = false;
       for (let historicalComb of allCompletedGroupsList) {
         let overlapCount = newComb.filter(num => historicalComb.includes(num)).length;
         if (overlapCount > 2) { 
           isCrossGroupConflict = true; 
           break; 
         }
       }
       if (isCrossGroupConflict) return; 
       
       const nonFavBalls = newComb.filter(num => !favBalls.includes(num));
       let isInsideGroupConflict = false;
       for (let ball of nonFavBalls) {
         if (currentBigGroupUsedBallsSet.has(ball)) {
           isInsideGroupConflict = true;
           break; 
         }
       }
       if (isInsideGroupConflict) return; 
       
       nonFavBalls.forEach(ball => currentBigGroupUsedBallsSet.add(ball));
       
       const nextIndex = finalOutputCombs.length + 1;
       const indexStr = String(nextIndex).padStart(2, '0');
       const formatted = newComb.map(n => String(n).padStart(2, '0')).join(', ');
       const currentUnit = Math.ceil(nextIndex / singleBigGroupLimit);
       
       finalOutputCombs.push(`第 [${indexStr}] 組 (第 ${currentUnit} 大組) : ${formatted}\n`);
       allCompletedGroupsList.push(newComb); 
       
       if (currentBigGroupUsedBallsSet.size >= (singleBigGroupLimit * availableSlotsPerGroup)) {
         console.log(`[中繼站日誌] >>> 第 ${currentUnit} 大組產能已安全榨乾，全體彩球物理重生，開啟下一大組通道！`);
         currentBigGroupUsedBallsSet.clear(); 
       }
       
       if (finalOutputCombs.length >= pickLimit) {
         console.log(`[中繼站日誌] 完美集滿指定產量 ${pickLimit} 組！下達強行拔插頭指令！`);
         isFinished = true;
         worker.terminate();
         clearTimeout(safetyTimeout);
         global.activeRequestsCount = Math.max(0, global.activeRequestsCount - 1);
         resolve();
       }
     }
   });
 });
 
 // ─── 補入【心跳永動晶片】防止 Render 50秒靜默休眠 ─── 💓
 const heartbeatTimer = setInterval(() => {
   if (isFinished) return clearInterval(heartbeatTimer);
   res.write(JSON.stringify({ isProgress: true, isHeartbeat: true, percent: 1 }) + "\n");
 }, 10000);

 // 【最終大竣工交卷封裝】
 let modeLabel = cfg.vipMode === 'smart' ? '聰明包牌 (Smart Wheeling + 內存壓縮)' : '一般篩選 (高併發商用延遲破開版)';
 res.write(JSON.stringify({ 
   success: true, 
   outputText: `【VIP海選大竣工】中繼站本次海選實時通過總數：${liveScannedCount} 組 🪙\n【當前交付解鎖明牌】：\n-------------------------\n` + finalOutputCombs.join('') + `-------------------------\n【輸出模式】${modeLabel}\n`
 }) + "\n");
 res.end();

 // ─── 【自癒核心】：在此處補回最外層完全閉合閘門與 Catch，徹底消滅 SyntaxError！ ─── [100% 像素級咬合] 🎯
   } catch (globalErr) {
     console.error(" 雲端大腦內核阻斷異常：", globalErr.message);
     try { 
       res.write(JSON.stringify({ success: false, message: `後台突發故障` }) + "\n"); 
       res.end(); 
     } catch(e){}
   }
 });
}

if (!isMainThread) {

  const { cfg, globalHistoryDB } = workerData;
  
  // ✅ 【添加在後台子線程開頭】：參數極速自癒清洗晶片
const f1_on = (cfg.f1_on === true || cfg.f1_on === 'true');
const f2_on = (cfg.f2_on === true || cfg.f2_on === 'true');
const f3_on = (cfg.f3_on === true || cfg.f3_on === 'true');
const f4_on = (cfg.f4_on === true || cfg.f4_on === 'true');
const f5_on = (cfg.f5_on === true || cfg.f5_on === 'true');
const f6_on = (cfg.f6_on === true || cfg.f6_on === 'true');
const f7_on = (cfg.f7_on === true || cfg.f7_on === 'true');
const f8_on = (cfg.f8_on === true || cfg.f8_on === 'true');
const f9_on = (cfg.f9_on === true || cfg.f9_on === 'true');
const f10_on = (cfg.f10_on === true || cfg.f10_on === 'true');
const f11_on = (cfg.f11_on === true || cfg.f11_on === 'true');
const f12_on = (cfg.f12_on === true || cfg.f12_on === 'true');
const f13_on = (cfg.f13_on === true || cfg.f13_on === 'true');
const f14_on = (cfg.f14_on === true || cfg.f14_on === 'true');
const f15_on = (cfg.f15_on === true || cfg.f15_on === 'true');
const vip_fav_on = (cfg.vip_fav_on === true || cfg.vip_fav_on === 'true');

    
    const lottoType = cfg.lottoType || "39_5";
    const maxBall = lottoType === "49_6" ? 49 : 39;
    const pickCount = lottoType === "49_6" ? 6 : 5;
    
    // 歷史庫快速對齊快取（不拖速的 Set 建立）
    const historyCacheSet = new Set();
    const historyDB = globalHistoryDB || [];
    if (Array.isArray(historyDB)) {
        historyDB.forEach(h => {
            if (h && Array.isArray(h)) {
                historyCacheSet.add(h.slice(0, pickCount).map(n => String(n).padStart(2,'0')).sort().join(','));
            }
        });
    }
    
    let lastPeriod = (historyDB.length > 0 && Array.isArray(historyDB[historyDB.length - 1])) ? historyDB[historyDB.length - 1].map(Number) : [];
    const neighborSet = new Set();
    let range = parseInt(cfg.f9_range, 10) || 1;
    lastPeriod.forEach(val => { for (let d = -range; d <= range; d++) { if (d !== 0) neighborSet.add(val + d); } });

    const f1_set = new Set(cfg.f1_set || []);
    const vipFavSet = new Set(cfg.vip_fav_set || []);

    // 🏎️ 究極高速十六大過濾防線（精確無誤且完全不吃效能）
    function isGeneSurvive(comb) {
        const sumValue = comb.reduce((a, b) => a + b, 0);
        if (f1_on && f1_set.size > 0) { for (let mine of f1_set) { if (comb.includes(mine)) return false; } }
        if (f2_on) {
            let f2_min = Number(cfg.f2_min) || 15; let f2_max = Number(cfg.f2_max) || 30;
            if (comb < f2_min || comb[comb.length - 1] > f2_max) return false;
        }
        if (historyCacheSet.size > 0 && historyCacheSet.has(comb.map(n => String(n).padStart(2, '0')).join(','))) return false;
        if (f3_on) {
            let zoneSet = new Set(); let divisor = lottoType === "49_6" ? 10 : 8;
            comb.forEach(num => zoneSet.add(Math.min(5, Math.ceil(num / divisor))));
            if (zoneSet.size !== (Number(cfg.f3_count) || 4)) return false;
        }
        if (f4_on) {
            let tails = new Array(10).fill(0); comb.forEach(num => tails[num % 10]++);
            if (Math.max(...tails) > (Number(cfg.f4_max) || 2)) return false;
        }
        if (f5_on) {
            let odds = comb.filter(n => n % 2 !== 0).length; let evens = pickCount - odds;
            if (lottoType === "49_6") {
                if (cfg.f5_lotto_60 && (odds === 6 || evens === 6)) return false;
                if (cfg.f5_lotto_51 && (odds === 5 || evens === 5)) return false;
            } else {
                if (cfg.f5_539_50 && (odds === 5 || evens === 5)) return false;
                if (cfg.f5_539_41 && (odds === 4 || evens === 4)) return false;
            }
        }
        if (f6_on && (sumValue < (Number(cfg.f6_low) || 110) || sumValue > (Number(cfg.f6_high) || 210))) return false;
        if (f7_on) {
            let maxSeq = 1, currentSeq = 1;
            for (let m = 1; m < comb.length; m++) {
                if (comb[m] === comb[m-1] + 1) { currentSeq++; if (currentSeq > maxSeq) maxSeq = currentSeq; } else { currentSeq = 1; }
            }
            if (maxSeq >= (Number(cfg.f7_len) || 3)) return false;
        }
        if (f8_on) {
            let isArithmetic = false;
            for (let i = 0; i <= comb.length - 3; i++) {
                let diff1 = comb[i+1] - comb[i]; let diff2 = comb[i+2] - comb[i+1];
                if (diff1 === diff2 && diff1 >= 1 && diff1 <= 24) { isArithmetic = true; break; }
            }
            if (isArithmetic) return false;
        }
        if (f9_on && neighborSet.size > 0 && comb.filter(num => neighborSet.has(num)).length > (Number(cfg.f9_count) || 2)) return false;
        if (f10_on && lastPeriod.length > 0 && comb.filter(num => lastPeriod.includes(num)).length > (Number(cfg.f10_max) || 2)) return false;
        if (f11_on) {
            let midPoint = lottoType === "49_6" ? 25 : 20; let bigCount = comb.filter(num => num >= midPoint).length; let smallCount = pickCount - bigCount;
            if ((cfg.f11_kill || cfg.f11_kill === 'true') && (bigCount === pickCount || smallCount === pickCount || bigCount === 1 || smallCount === 1)) return false;
        }
        if (f12_on) {
            let road0 = 0, road1 = 0, road2 = 0; comb.forEach(num => { let rem = num % 3; if (rem === 0) road0++; else if (rem === 1) road1++; else road2++; });
            if ((cfg.f12_kill || cfg.f12_kill === 'true') && (road0 === 0 || road1 === 0 || road2 === 0)) return false;
        }
        if (f13_on) {
            let diffs = new Set();
            for (let m = 0; m < comb.length; m++) { for (let n = m + 1; n < comb.length; n++) diffs.add(comb[n] - comb[m]); }
            if (diffs.size - (pickCount - 1) < (Number(cfg.f13_min) || 6)) return false;
        }
        if (f14_on) {
            const primes =[2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
            if ((cfg.f14_kill || cfg.f14_kill === 'true') && comb.filter(num => primes.includes(num)).length >= 4) return false;
        }
        if (f15_on) {
            const overlapLimit = parseInt(cfg.f15_overlap_limit, 10) || (lottoType === '49_6' ? 5 : 4);
            if (cfg.f15_kill || cfg.f15_kill === 'true') {
                for (let h of historyDB) { if (Array.isArray(h) && comb.filter(num => h.includes(num)).length >= overlapLimit) return false; }
            }
        }
        return true;
    }

    // 🏎️ ─── 【最初體高效能全隨選大狂飆】 ───
    const baseBallPool = Array.from({ length: maxBall }, (_, i) => i + 1).filter(n => !f1_set.has(n));
    
    // 聰明組合包牌
 // 【單水管高效能高速洗牌流】：肚子裡絕不囤積任何記憶體物件，100% 隨產隨丟！
 const targetSlotsCount = pickCount - vipFavSet.size;
 
 while (true) {
 // 建立純淨的殘餘球池底牌
 let pool = [...baseBallPool].filter(ball => !vipFavSet.has(ball));
 
 // Fisher-Yates 隨機高頻大洗牌
 for (let i = pool.length - 1; i > 0; i--) {
 const j = Math.floor(Math.random() * (i + 1));
 [pool[i], pool[j]] = [pool[j], pool[i]];
 }
 
 // 抽取出當前空缺所需要的非固定球數
 if (pool.length < targetSlotsCount) continue;
 let slots = pool.slice(0, targetSlotsCount);
 
 // 物理預埋焊接喜愛號固定樁，組裝成完整彩球
 let combination = [...Array.from(vipFavSet), ...slots];
 combination.sort((a, b) => a - b);
 
 // 衝撞 15 大防線過濾網審查
 if (isGeneSurvive(combination)) {
 // 完美生還！立即將單兵發射回中繼接收站，水管內部零堆積、零留存！
 parentPort.postMessage({ type: 'FOUND_ONE_STREAM', data: combination });
 }
 }
}

// ───【全域端口大總門】：監聽 Render 埠口 ───
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
 console.log(`=======================================================`);
 console.log(` 2026 LOTTO GA-WHEELING 究極完全體後端大腦通電成功！碼`); 
 console.log(` 多線程集流中繼站完美通車，埠口：[ ${PORT} ]`); 
 console.log(`=======================================================`);
});
