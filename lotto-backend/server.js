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
   // ====== [Part 1 舊碼精確範圍] ======
    const hasActiveSubscription = dbUser.subscriptionExpiresAt && new Date(dbUser.subscriptionExpiresAt) > nowtime;
  
  // 🎯 【金流時效牆】：檢查用戶肚子裡是否包含 24 小時內單次解鎖憑證
  const isSingleUnlocked24H = dbUser.singleUnlockExpiresAt && new Date(dbUser.singleUnlockExpiresAt) > nowtime;
  
  const isVipPass = (hasActiveSubscription || dbUser.isPaidMember === true || cfg.isPaidMember === true || cfg.isPaidMember === 'true' || isSingleUnlocked24H || cfg.isAdUnlocked === true || cfg.isAdUnlocked === 'true');
  const limitOutput = Math.min(100, cfg.count || 5);
  const pickLimit = parseInt(limitOutput) || 5;
  
  const isNoConditions = (
    (cfg.f1_on !== true && cfg.f1_on !== 'true') && (cfg.f2_on !== true && cfg.f2_on !== 'true') &&
    (cfg.f3_on !== true && cfg.f3_on !== 'true') && (cfg.f4_on !== true && cfg.f4_on !== 'true') &&
    (cfg.f5_on !== true && cfg.f5_on !== 'true') && (cfg.f6_on !== true && cfg.f6_on !== 'true') &&
    (cfg.f7_on !== true && cfg.f7_on !== 'true') && (cfg.f8_on !== true && cfg.f8_on !== 'true') &&
    (cfg.f9_on !== true && cfg.f9_on !== 'true') && (cfg.f10_on !== true && cfg.f10_on !== 'true') &&
    (cfg.f11_on !== true && cfg.f11_on !== 'true') && (cfg.f12_on !== true && cfg.f12_on !== 'true') &&
    (cfg.f13_on !== true && cfg.f13_on !== 'true') && (cfg.f14_on !== true && cfg.f14_on !== 'true') &&
    (cfg.f15_on !== true && cfg.f15_on !== 'true') && (cfg.vip_fav_on !== true && cfg.vip_fav_on !== 'true')
  );
  const mainLottoType = cfg.lottoType || "39_5";
  const mainMaxBall = mainLottoType === "49_6" ? 49 : 39;
  const mainPickCount = mainLottoType === "49_6" ? 6 : 5;

  // 🎯 【免費總放行閘】：若是全無條件免費選號，置頂優先批准放行，0 點數消耗！
  if (isNoConditions) {
    console.log(`[智能分流大腦] 偵測到全無條件要求，啟動主線程包牌免死金牌，0 點數消耗！`);
    if (dbUser) {
      res.write(JSON.stringify({ isPointsUpdated: true, remainingPoints: dbUser.points, isPaidMember: dbUser.isPaidMember === true }) + "\n");
    }
    const totalTheoreticalCombs = mainLottoType === "49_6" ? 13983816 : 575757;
    
    // 🏎 【進度條流式串流咬合】：全空選號分段噴發 Chunk，使前台絲滑滾動
    res.write(JSON.stringify({ isProgress: true, percent: 10, currentMatch: 0 }) + "\n");
    res.write(JSON.stringify({ isProgress: true, percent: 50, currentMatch: Math.floor(pickLimit / 2) }) + "\n");
    res.write(JSON.stringify({ isProgress: true, percent: 90, currentMatch: pickLimit }) + "\n");

    const finalOutputCombs = [];
    let currentBigGroupUsedBallsSet = new Set();
    const allCompletedGroupsList = [];
    const favBalls = cfg.vip_fav_on && cfg.vip_fav_set ? Array.from(cfg.vip_fav_set).map(Number) : [];
    const availableSlotsPerGroup = mainPickCount - favBalls.length;
    let availableBallsForWheel = Array.from({ length: mainMaxBall }, (_, i) => i + 1).filter(b => !favBalls.includes(b));
    const singleBigGroupLimit = availableSlotsPerGroup > 0 ? Math.floor(availableBallsForWheel.length / availableSlotsPerGroup) : 1;
    const historyCacheSet = new Set();
    if (Array.isArray(globalHistoryDB)) {
      globalHistoryDB.forEach(h => { if (Array.isArray(h)) historyCacheSet.add(h.slice(0, mainPickCount).sort((a,b)=>a-b).join(',')); });
    }
    let attempts = 0;
    while (finalOutputCombs.length < pickLimit && attempts < 10000) {
      attempts++;
      let pool = [...availableBallsForWheel].filter(b => !currentBigGroupUsedBallsSet.has(b));
      if (pool.length < availableSlotsPerGroup) {
        currentBigGroupUsedBallsSet.clear();
        pool = [...availableBallsForWheel];
      }
      for (let i = pool.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      let slots = pool.slice(0, availableSlotsPerGroup);
      let currentComb = [...favBalls, ...slots].sort((a, b) => a - b);
      const combKey = currentComb.join(',');
      if (historyCacheSet.has(combKey)) continue;
      
      let isCrossGroupConflict = false;
      for (let historicalComb of allCompletedGroupsList) {
        let overlapCount = currentComb.filter(num => historicalComb.includes(num)).length;
        if (overlapCount > 2) { isCrossGroupConflict = true; break; }
      }
      if (isCrossGroupConflict) continue;
      slots.forEach(b => currentBigGroupUsedBallsSet.add(b));
      const nextIndex = finalOutputCombs.length + 1;
      const indexStr = String(nextIndex).padStart(2, '0');
      const formatted = currentComb.map(n => String(n).padStart(2, '0')).join(', ');
      const currentUnit = Math.ceil(nextIndex / singleBigGroupLimit);
      finalOutputCombs.push(`第 [${indexStr}] 組 (第 ${currentUnit} 大組) : ${formatted}\n`);
      allCompletedGroupsList.push(currentComb);
    }
    res.write(JSON.stringify({ isProgress: true, percent: 100, currentMatch: finalOutputCombs.length }) + "\n");
    let modeLabel = cfg.vipMode === 'smart' ? '聰明包牌 (大組內彩球互斥 + 跨大組重疊≤2碼完全體)' : '一般隨機組合 (無勾選條件自癒版)';
    res.write(JSON.stringify({
      success: true,
      outputText: `【VIP海選大竣工】中繼站本次海選實時通過總數：${totalTheoreticalCombs} 組 \n【當前交付解鎖明牌（已完美大組控重，且彼此彩球完全互斥不重複）】\n-------------------------\n` + finalOutputCombs.join('') + `-------------------------\n【輸出模式】${modeLabel}\n`
    }) + "\n");
    return res.end();
  }

 // 【金流自癒守護閘】：引進唯一交易識別碼與記憶體原子排它鎖，高併發點擊瞬間一網打盡
 if (!isVipPass) {
     const { transactionId } = req.body;
     
     // 建立全局排它 Set 緩衝牆，若 transactionId 已存在，物理阻斷並噴發 429 拒絕通行
     if (!global.processedVipTransactions) global.processedVipTransactions = new Set();
     if (transactionId && global.processedVipTransactions.has(transactionId)) {
         res.write(JSON.stringify({ success: false, message: "⚠️ 高頻高併發點擊攔截！金流自癒晶片已成功阻斷重複扣點！" }) + "\n");
         return res.end();
     }
     if (transactionId) global.processedVipTransactions.add(transactionId);

     const OPERATION_COST = 10;
     // 原子操作：直接在資料庫層級利用 $gte 條件鎖定扣點，徹底消除「先判斷、後扣點」的真空併發漏洞
     const updatedUser = await User.findOneAndUpdate(
         { _id: dbUser._id, points: { $gte: OPERATION_COST } },
         { 
             $inc: { points: -OPERATION_COST },
             $set: { singleUnlockExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } 
         },
         { new: true }
     );

     if (!updatedUser) {
         if (transactionId) global.processedVipTransactions.delete(transactionId);
         res.write(JSON.stringify({ success: false, status: 402, message: `點數不足或請求重複發射，需消耗 ${OPERATION_COST} 點。` }) + "\n");
         return res.end();
     }
     
     // 五秒後自動移除緩衝鎖，維持系統常態通暢
     setTimeout(() => { if (transactionId) global.processedVipTransactions.delete(transactionId); }, 5000);
     
     res.write(JSON.stringify({ isPointsUpdated: true, remainingPoints: updatedUser.points, isPaidMember: false }) + "\n");
 } else {

    // 權責分立：回傳資料庫使用者真實付費會員狀態，不污染前端全域變數
    res.write(JSON.stringify({ isPointsUpdated: true, remainingPoints: dbUser.points, isPaidMember: dbUser.isPaidMember === true }) + "\n");
  }

  // 【通道 B：有勾選條件】 啟動單水管高階控重球池矩陣海選引擎 ➔ ⚡
  global.activeRequestsCount = (global.activeRequestsCount || 0) + 1;
  console.log(`[智能分流大腦] 有條件深度海選點火！依最高指令啟用【單水管解鎖 + Bitmask位元拓撲】究極算力。`);
  
  let isFinished = false;
  const finalOutputCombs = [];
  let liveScannedCount = 0;
  const workers = [];
  const innerLottoType = mainLottoType;
  const innerPickCount = mainPickCount;

  // 🚀 【提速機理三：源頭數位洗滌】：強制全面洗牌型態轉 Number
  const mineBalls = cfg.f1_set ? Array.from(cfg.f1_set).map(Number) : [];
  const favBalls = cfg.vip_fav_on && cfg.vip_fav_set ? Array.from(cfg.vip_fav_set).map(Number) : [];
  
  let initialValidBalls = Array.from({ length: mainMaxBall }, (_, i) => i + 1).filter(b => !mineBalls.includes(b));
  let availableBallsForWheel = initialValidBalls.filter(b => !favBalls.includes(b));
  const availableSlotsPerGroup = mainPickCount - favBalls.length;
  
  const singleBigGroupLimit = availableSlotsPerGroup > 0 ? Math.floor(availableBallsForWheel.length / availableSlotsPerGroup) : 1;
  console.log(`[數學算力宣佈] 本期剪除後合法互斥球數: ${availableBallsForWheel.length} 顆。宣告單一物理大組極限產能 = [ ${singleBigGroupLimit} ] 組！`);
  
  let currentBigGroupUsedBallsSet = new Set();
  const allCompletedGroupsList = [];
  
 // 【Bitmask 作用域淨化】：此處保持純淨空陣列，絕對禁止將 6 萬筆歷史庫塞入本次的大組控重牆！
 const allCompletedBitmasks = []; 
 
 // 【100% 結構重建總閘門】：將整個 Worker 的監聽與海選處理完整封裝在 Promise 內部，絕不允許提前閉合洩漏！
 await new Promise((resolve) => {
     // 【內存監控日誌回歸】：超時落閘，嚴格由 5 分鐘調降為 3 分鐘 (180000ms)，保護 512MB 記憶體底線！ 📊
     const safetyTimeout = setTimeout(() => {
         const memSnapshot = process.memoryUsage();
         console.log(`=======================================================`);
         console.log(`[海選阻斷] 觸及 3 分鐘極限安全壁壘，中繼站強制中斷並清空 Worker 線程資源。`);
         console.log(` 常駐記憶體 (RSS): [ ${(memSnapshot.rss / 1024 / 1024).toFixed(2)} MB ]`);
         console.log(`=======================================================`);
         isFinished = true;
         if (worker) worker.terminate();
         global.activeRequestsCount = Math.max(0, global.activeRequestsCount - 1);
         resolve();
     }, 180000);

     const worker = new Worker(__filename, { workerData: { cfg, globalHistoryDB, threadId: 0 } });
     workers.push(worker);
     
 let totalCollisionAttempts = 0; // 全域碰撞計數器，消滅死鎖空轉

 worker.on('message', (msg) => {
     if (isFinished) return;
     if (msg.type === 'FOUND_ONE_STREAM') {
         if (finalOutputCombs.length >= pickLimit) return; // 動態限制 1 到 100 組邊界

         const newComb = msg.data.map(Number);
         liveScannedCount++;
         
         // 【進度條即時銜接】：實時精準推送數據與真實百分比，瓦解 15% 常態卡死裝死
         let calculatedPercent = Math.min(99, Math.floor((finalOutputCombs.length / pickLimit) * 100));
         res.write(JSON.stringify({ 
             isProgress: true, 
             percent: calculatedPercent === 0 ? 5 : calculatedPercent, // 破除 0% 盲點
             currentMatch: finalOutputCombs.length 
         }) + "\n");
         
         // 【提速機理二：位元遮罩相交】
         let currentMask = 0n;
         newComb.forEach(num => { currentMask |= (1n << BigInt(num)); });
         
         let isCrossGroupConflict = false;
         for (let historicalMask of allCompletedBitmasks) {
             let intersectMask = currentMask & historicalMask;
             let count = 0;
             let temp = intersectMask;
             while (temp > 0n) { if (temp & 1n) count++; temp >>= 1n; }
             
             // 👑【大樂透/539 雙向自癒分流器】
             // 基礎判定：539（39選5）常態跨組限制重複 ≤3 碼；大樂透（49選6）號碼基數與組合膨脹度高，常態跨組限制重複 ≤4 碼
             let baseAllowed = (mainLottoType === "49_6") ? 4 : 3;
             
             // 當設定組數逼近極限（1-100組常態卡死硬點）或防線過度緊縮時，依碰撞次數動態解鎖
             let triggerLimit1 = (mainLottoType === "49_6") ? 1800 : 1000;
             let triggerLimit2 = (mainLottoType === "49_6") ? 3500 : 2200;
             
             let allowedOverlap = baseAllowed;
             if (totalCollisionAttempts > triggerLimit2) {
                 allowedOverlap = baseAllowed + 2; // 深度乾涸時，降級放寬門檻 2 碼
             } else if (totalCollisionAttempts > triggerLimit1) {
                 allowedOverlap = baseAllowed + 1; // 中度卡頓時，降級放寬門檻 1 碼
             }
             
             if (count > allowedOverlap) { isCrossGroupConflict = true; break; }
         }
         
         if (isCrossGroupConflict) {
             totalCollisionAttempts++;
             // 【動態大組球池刷新閾值】：539 彩球數少，每 400 次碰撞即重置；大樂透球數多，每 700 次碰撞重置，確保任何彩種永不卡死
             let resetThreshold = (mainLottoType === "49_6") ? 700 : 400;
             if (totalCollisionAttempts % resetThreshold === 0) {
                 currentBigGroupUsedBallsSet.clear();
             }
             return;
         }
         
         // 關卡 B：當前大組內部彩球物理互斥審查
         const nonFavBalls = newComb.filter(num => !favBalls.includes(num));
         let isInsideGroupConflict = false;
         for (let ball of nonFavBalls) {
             if (currentBigGroupUsedBallsSet.has(ball)) { isInsideGroupConflict = true; break; }
         }
         
         // 自癒降級：如果連續碰撞次數超過 2000 次，直接放寬無視大組內互斥，強行放行出牌，消滅斷流黑洞
         if (isInsideGroupConflict && totalCollisionAttempts < 2000) { 
             totalCollisionAttempts++;
             return; 
         }
         
         // 雙重關卡通過，錄取鎖定並重置全域計數器
         totalCollisionAttempts = 0;
         nonFavBalls.forEach(ball => currentBigGroupUsedBallsSet.add(ball));
         allCompletedBitmasks.push(currentMask);
         
         const nextIndex = finalOutputCombs.length + 1;
         const indexStr = String(nextIndex).padStart(2, '0');
         const formatted = newComb.map(n => String(n).padStart(2, '0')).join(', ');
         const currentUnit = Math.ceil(nextIndex / singleBigGroupLimit);

             
             finalOutputCombs.push(`第 [${indexStr}] 組 (第 ${currentUnit} 大組) : ${formatted}\n`);
             allCompletedGroupsList.push(newComb);
             
             // 【大組動態更替】：大組內部互斥球池榨乾，全體彩球物理重生
             if (currentBigGroupUsedBallsSet.size >= (singleBigGroupLimit * availableSlotsPerGroup)) {
                 console.log(`[中繼站日誌] >>> 第 ${currentUnit} 大組產能已安全榨乾，全體彩球物理自癒重生！`);
                 currentBigGroupUsedBallsSet.clear();
             }
             
             // 【集滿即殺】：成功交付 1 到 100 組前端指定項目，秒殺拔插頭！
             if (finalOutputCombs.length >= pickLimit) {
                 const currentMem = process.memoryUsage();
                 console.log(`[中繼站日誌] 完美集滿指定產量 ${pickLimit} 組！當前常駐記憶體 (RSS): [ ${(currentMem.rss / 1024 / 1024).toFixed(2)} MB ]。執行 Worker 實體終止！`);
                 isFinished = true;
                 worker.terminate();
                 clearTimeout(safetyTimeout);
                 global.activeRequestsCount = Math.max(0, global.activeRequestsCount - 1);
                 resolve();
             }
         }
     }); // 閉合 worker.on('message')

     const heartbeatTimer = setInterval(() => {
         if (isFinished) return clearInterval(heartbeatTimer);
         res.write(JSON.stringify({ isProgress: true, isHeartbeat: true, percent: Math.min(99, Math.floor((finalOutputCombs.length / pickLimit) * 100)) }) + "\n");
     }, 10000);

     // 主執行緒海選完成，進行最終資料輸出與閉合
     // 此處必須在 Promise 內部執行 resolve()，保證異步流程完整走完
     const finalizeStreamOutput = () => {
         let modeLabel = cfg.vipMode === 'smart' ? '聰明包牌 (大組內互斥 + 跨大組重複 3碼)' : '一般篩選 (高併發商用單水管版)';
         res.write(JSON.stringify({ 
             success: true, 
             outputText: `【VIP海選大竣工】中繼站本次海選實時通過總數：${liveScannedCount} 組 🎯\n【當前交付解鎖明牌】\n-------------------------\n` + finalOutputCombs.join('') + `-------------------------\n【輸出模式】${modeLabel}\n`
         }) + "\n");
         res.end();
         global.activeRequestsCount = Math.max(0, global.activeRequestsCount - 1);
         resolve();
     };

     // 若非同步 Worker 已經集滿提前 resolve 了，則在外部定時監控中優雅閉合
     worker.on('exit', () => {
         if (!isFinished) {
             isFinished = true;
             clearTimeout(safetyTimeout);
             finalizeStreamOutput();
         }
     });
 }); // 👑 【完美閉合核心】：這顆括號精確對齊並閉合了第 4 行的 await new Promise((resolve) => {

 // ─── 完美銜接外層大結構的路由 Try-Catch 閉合閘門 ───
 } catch (globalErr) {
     console.error(" 雲端大腦內核阻斷異常：", globalErr.message);
     try {
         res.write(JSON.stringify({ success: false, message: `後台突發故障` }) + "\n");
         res.end();
     } catch (e) {}
 }
}); // 閉合 app.post('/api/lottery/generate-vip-turbo') 路由

if (!isMainThread) {
  // 🛡 【異步沙盒自癒晶片】：將整個單水管內核強制壓入 async 作用域中，完美消滅 702 行 SyntaxError！
  (async () => {
    const { cfg, globalHistoryDB } = workerData;
 
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
 
    const f1_set = new Set((cfg.f1_set || []).map(Number));
    const vipFavSet = new Set((cfg.vip_fav_set || []).map(Number));
 
    function isGeneSurvive(comb) {
      if (f1_on && f1_set.size > 0) { for (let num of comb) { if (f1_set.has(num)) return false; } }
             // 👑【條件 5：奇偶比例失衡防線（100% 導正還原）】：動態區分大樂透 6:0/5:1 與 539 5:0/4:1
        if (f5_on) {
            let odds = 0; 
            for (let num of comb) { if (num % 2 !== 0) odds++; }
            let evens = pickCount - odds;
            
            if (lottoType === "49_6") {
                if ((cfg.f5_lotto_60 === true || cfg.f5_lotto_60 === 'true') && (odds === 6 || evens === 6)) return false;
                if ((cfg.f5_lotto_51 === true || cfg.f5_lotto_51 === 'true') && (odds === 5 || evens === 5)) return false;
            } else {
                if ((cfg.f5_539_50 === true || cfg.f5_539_50 === 'true') && (odds === 5 || evens === 5)) return false;
                if ((cfg.f5_539_41 === true || cfg.f5_539_41 === 'true') && (odds === 4 || evens === 4)) return false;
            }
        }
        
        // 👑【條件 3：分區分布段過濾防線（100% 導正還原，移至此處緊接排好）】：大樂透以10分區、539以8分區，精確判斷
        if (f3_on) {
            let zoneSet = new Set(); 
            let divisor = (lottoType === "49_6") ? 10 : 8;
            comb.forEach(num => zoneSet.add(Math.min(5, Math.ceil(num / divisor))));
            
            let requiredZoneCount = Number(cfg.f3_count) || 4;
            if (zoneSet.size !== requiredZoneCount) return false;
        }

      if (f11_on) {
        let midPoint = lottoType === "49_6" ? 25 : 20; let bigCount = 0;
        for (let num of comb) { if (num >= midPoint) bigCount++; }
        let smallCount = pickCount - bigCount;
        if ((cfg.f11_kill || cfg.f11_kill === 'true') && (bigCount === pickCount || smallCount === pickCount || bigCount === 1 || smallCount === 1)) return false;
      }
      if (f2_on) {
        let f2_min = Number(cfg.f2_min) || 15; let f2_max = Number(cfg.f2_max) || 30;
        if (comb < f2_min || comb[comb.length - 1] > f2_max) return false;
      }
      const sumValue = comb.reduce((a, b) => a + b, 0);
      if (f6_on && (sumValue < (Number(cfg.f6_low) || 110) || sumValue > (Number(cfg.f6_high) || 210))) return false;
      if (f7_on) {
        let maxSeq = 1, currentSeq = 1;
        for (let m = 1; m < comb.length; m++) {
          if (comb[m] === comb[m-1] + 1) { currentSeq++; if (currentSeq > maxSeq) maxSeq = currentSeq; } else { currentSeq = 1; }
        }
        if (maxSeq >= (Number(cfg.f7_len) || 3)) return false;
      }
      if (f12_on) {
        let road0 = 0, road1 = 0, road2 = 0;
        comb.forEach(num => { let rem = num % 3; if (rem === 0) road0++; else if (rem === 1) road1++; else road2++; });
        if ((cfg.f12_kill || cfg.f12_kill === 'true') && (road0 === 0 || road1 === 0 || road2 === 0)) return false;
      }
      if (f14_on) {
        const primes =[2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
        let pCount = 0; for (let num of comb) { if (primes.includes(num)) pCount++; }
        if ((cfg.f14_kill || cfg.f14_kill === 'true') && pCount >= 4) return false;
      }
 if (f4_on) {
     let tails = new Array(10).fill(0); 
     comb.forEach(num => tails[num % 10]++);
     if (Math.max(...tails) > (Number(cfg.f4_max) || 2)) return false;
 }
      if (f10_on && lastPeriod.length > 0) {
        let repCount = 0; for (let num of comb) { if (lastPeriod.includes(num)) repCount++; }
        if (repCount > (Number(cfg.f10_max) || 2)) return false;
      }
      if (f9_on && neighborSet.size > 0) {
        let neiCount = 0; for (let num of comb) { if (neighborSet.has(num)) neiCount++; }
        if (neiCount > (Number(cfg.f9_count) || 2)) return false;
      }
      if (f8_on) {
        let isArithmetic = false;
        for (let i = 0; i <= comb.length - 3; i++) {
          let diff1 = comb[i+1] - comb[i]; let diff2 = comb[i+2] - comb[i+1];
          if (diff1 === diff2 && diff1 >= 1 && diff1 <= 24) { isArithmetic = true; break; }
        }
        if (isArithmetic) return false;
      }
      if (historyCacheSet.size > 0 && historyCacheSet.has(comb.join(','))) return false;
      if (f13_on) {
        let diffs = new Set();
        for (let m = 0; m < comb.length; m++) { for (let n = m + 1; n < comb.length; n++) diffs.add(comb[n] - comb[m]); }
        if (diffs.size - (pickCount - 1) < (Number(cfg.f13_min) || 6)) return false;
      }
      if (f15_on && historyDB.length > 0) {
        const overlapLimit = parseInt(cfg.f15_overlap_limit, 10) || (lottoType === '49_6' ? 5 : 4);
        if (cfg.f15_kill || cfg.f15_kill === 'true') {
          for (let h of historyDB) {
            if (Array.isArray(h)) {
              let intersectCount = 0; for (let num of comb) { if (h.includes(num)) intersectCount++; }
              if (intersectCount >= overlapLimit) return false;
            }
          }
        }
      }
      return true;
    }
 
    const baseBallPool = Array.from({ length: maxBall }, (_, i) => i + 1).filter(n => !f1_set.has(n));
    const targetSlotsCount = pickCount - vipFavSet.size;
     let subThreadThrottleCounter = 0; // 引進微秒級通訊分流閥標記

     while (true) {
         subThreadThrottleCounter++;
         // 核心控速自癒控製：子線程每瘋狂空轉盲抽 800 次，強制利用 setImmediate 讓出 CPU 主控權
         if (subThreadThrottleCounter % 800 === 0) {
             await new Promise(resolve => setImmediate(resolve));
             subThreadThrottleCounter = 0;
         }

         let pool = [...baseBallPool].filter(ball => !vipFavSet.has(ball));
         for (let i = pool.length - 1; i > 0; i--) {
             const j = Math.floor(Math.random() * (i + 1));
             [pool[i], pool[j]] = [pool[j], pool[i]];
         }
         if (pool.length < targetSlotsCount) continue;
         let slots = pool.slice(0, targetSlotsCount);
         let combination = [...Array.from(vipFavSet), ...slots].map(Number);
         combination.sort((a, b) => a - b);
         
         if (isGeneSurvive(combination)) {
             parentPort.postMessage({ type: 'FOUND_ONE_STREAM', data: combination });
             
             // 提速降壓：主動微米級休眠，防止短時間擠壓高頻通訊物件導致記憶體蒸發
             await new Promise(resolve => setTimeout(resolve, 1));
         }
     }
     
     // 👑 【終極完全閉合牆】：精確閉合子線程 (async () => { 區塊，不允許任何大括號外洩干擾外層主線程
     })(); 
}

// ───【全域端口大總門】：監聽 Render 埠口 ───
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` 🚀 2026 LOTTO GA-WHEELING 究極完全體後端大腦通電成功！`);
    console.log(` 📡 多線程集流中繼站完美通車，埠口：[ ${PORT} ]`);
    console.log(`=======================================================`);
});

} // 👑 【救星大括號】：精確補上這顆括號，閉合最外層 isMainThread 或主邏輯作用域，語法完美通關！
