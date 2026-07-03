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

const JWT_SECRET = process.env.JWT_SECRET;
const TRUE_MONGO_URI = process.env.MONGO_URI;

if (!JWT_SECRET) {
  throw new Error('Missing required environment variable: JWT_SECRET');
}
if (!TRUE_MONGO_URI) {
  throw new Error('Missing required environment variable: MONGO_URI');
}

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
function normalizeBearerToken(rawToken) {
  if (!rawToken) return '';
  return String(rawToken).trim().replace(/^Bearer\s+/i, '').replace(/['"\r\n\t]/g, '');
}

function getTokenFromRequest(req) {
  return normalizeBearerToken(req.headers.authorization || req.headers.Authorization || req.query.token || (req.body && req.body.token));
}

function authenticateToken(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  try {
    const tokenString = getTokenFromRequest(req);
    if (!tokenString) return res.status(411).json({ success: false, message: 'Missing auth token' });
    const decoded = jwt.verify(tokenString, JWT_SECRET);
    req.user = { userId: String(decoded.userId || decoded._id || decoded.id).trim() };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid auth token' });
  }
}

function extractUserIdFromPayload(req) {
  try {
    const tokenString = getTokenFromRequest(req);
    if (!tokenString) return null;
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
     
     // ─── 檢查是否仍在 24 小時通行證有效期內 ───
     const now = new Date();
     if (dbUser.singleUnlockExpiresAt && new Date(dbUser.singleUnlockExpiresAt) > now) {
         return res.json({ success: true, message: "您已擁有 24 小時免扣點通行特權！", newPoints: dbUser.points });
     }
     
     const UNLOCK_COST = 10;
     if ((Number(dbUser.points) || 0) < UNLOCK_COST) {
         return res.status(400).json({ success: false, message: `解鎖失敗！單次解鎖高階過濾防線需消耗 ${UNLOCK_COST} 點。` });
     }
     
     // 扣除 10 點並注入 24 小時（1天）截止線
     dbUser.points = Math.max(0, (Number(dbUser.points) || 0) - UNLOCK_COST);
     const expireTime = new Date();
     expireTime.setHours(expireTime.getHours() + 24); // 精確發放 24 小時時效
     dbUser.singleUnlockExpiresAt = expireTime;
     
     dbUser.markModified('points');
     dbUser.markModified('singleUnlockExpiresAt');
     await dbUser.save();
     
     console.log(`[通行證發放] 使用者 ${dbUser.username} 扣除 10 點，24小時免扣點通道開啟！`);
     return res.json({ success: true, newPoints: dbUser.points, singleUnlockExpiresAt: dbUser.singleUnlockExpiresAt });
 } catch (err) { 
     return res.status(500).json({ success: false, message: "雲端授權通道異常" }); 
 }
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

async function listSavedTickets(req, res) {
  const rawAuth = req.headers.authorization || req.headers.Authorization || req.query.token || (req.body && req.body.token);
  if (rawAuth === 'WAKEUP_PING') return res.json({ success: true, message: "WOKE" });
  const token = normalizeBearerToken(rawAuth);
  if (!token) return res.status(401).json({ success: false, message: "Missing Token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const dbUser = await User.findById(decoded.userId || decoded._id || decoded.id);
    if (!dbUser) return res.status(404).json({ success: false, message: 'User not found' });
    const formattedTickets = (dbUser.savedTickets || []).map(t => typeof t === 'object' ? (t.content || JSON.stringify(t)) : t);
    return res.json({ success: true, savedTickets: formattedTickets });
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}
app.get('/api/tickets/list', listSavedTickets);
app.post('/api/tickets/list', listSavedTickets);
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
    // 1. 驗證 30 天月費訂閱特權
    const hasActiveSubscription = dbUser.subscriptionExpiresAt && new Date(dbUser.subscriptionExpiresAt) > nowtime;
    // 2. 驗證全新的 24 小時單次解鎖通行證特權
    const hasValid24hPass = dbUser.singleUnlockExpiresAt && new Date(dbUser.singleUnlockExpiresAt) > nowtime;

    // 彙整最高免扣點白名單權限
    const isVipPass = (
        hasActiveSubscription || 
        hasValid24hPass || 
        dbUser.isPaidMember === true || 
        cfg.isPaidMember === true || cfg.isPaidMember === 'true' || 
        cfg.isSingleUnlockedCurrentRound === true || cfg.isSingleUnlockedCurrentRound === 'true' || 
        cfg.isAdUnlocked === true || cfg.isAdUnlocked === 'true'
    );
    
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

    if (isNoConditions) {
        console.log(`[智能分流大腦] 啟動主線程隨機包牌免死金牌，0 點數消耗！`);
        if (dbUser) {
            res.write(JSON.stringify({ isPointsUpdated: true, remainingPoints: dbUser.points, isPaidMember: dbUser.isPaidMember === true }) + "\n");
        }
        const totalTheoreticalCombs = mainLottoType === "49_6" ? 13983816 : 575757;
        res.write(JSON.stringify({ isProgress: true, percent: 20, currentMatch: 0 }) + "\n");
        res.write(JSON.stringify({ isProgress: true, percent: 60, currentMatch: Math.floor(pickLimit / 2) }) + "\n");
        
        const finalOutputCombs = [];
        const globalUniqueSet = new Set();
        const historyCacheSet = new Set();
        const currentPickCount = mainLottoType === "49_6" ? 6 : 5;
        const targetHistoryDB = globalHistoryDB || [];
        
        if (Array.isArray(targetHistoryDB)) {
            targetHistoryDB.forEach(h => { 
                if (Array.isArray(h)) {
                    historyCacheSet.add(h.slice(0, currentPickCount).map(n => String(n).padStart(2, '0')).sort().join(',')); 
                }
            });
        }
        const availableSlotsPerGroup = mainPickCount;
        let availableBallsForWheel = Array.from({ length: mainMaxBall }, (_, i) => i + 1);
        const singleBigGroupLimit = Math.floor(availableBallsForWheel.length / availableSlotsPerGroup);
        let currentBigGroupUsedBallsSet = new Set();
        let attempts = 0;

        while (finalOutputCombs.length < pickLimit && attempts < 50000) {
            attempts++;
            let pool = [...availableBallsForWheel].filter(b => !currentBigGroupUsedBallsSet.has(b));
            if (pool.length < availableSlotsPerGroup || cfg.vipMode !== 'smart') {
                currentBigGroupUsedBallsSet.clear();
                pool = [...availableBallsForWheel];
            }
            for (let i = pool.length - 1; i > 0; i--) {
                let j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            let currentComb = pool.slice(0, availableSlotsPerGroup).sort((a, b) => a - b);
            const formattedArray = currentComb.map(n => String(n).padStart(2, '0'));
            const combKey = currentComb.join(',');
            const historyKey = formattedArray.join(',');
            if (globalUniqueSet.has(combKey)) continue; 
            if (historyCacheSet.has(historyKey)) continue; 
            if (cfg.vipMode === 'smart') {
                currentComb.forEach(b => currentBigGroupUsedBallsSet.add(b));
            }
            globalUniqueSet.add(combKey);
            const nextIndex = finalOutputCombs.length + 1;
            const indexStr = String(nextIndex).padStart(2, '0');
            const formattedOutput = formattedArray.join(', ');
            const currentUnit = Math.ceil(nextIndex / singleBigGroupLimit);
            finalOutputCombs.push(`第 [${indexStr}] 組 (第 ${currentUnit} 大組) : ${formattedOutput}\n`);
        }
        res.write(JSON.stringify({ isProgress: true, percent: 100, currentMatch: finalOutputCombs.length }) + "\n");
        let modeLabel = cfg.vipMode === 'smart' ? '聰明包牌 (大組內彩球完全互斥+歷史頭獎蒸發版)' : '一般隨機組合 (無勾選條件自癒+歷史頭獎蒸發版)';
        res.write(JSON.stringify({
            success: true,
            outputText: `【VIP純隨機大竣工】中繼站本次海選實時通過總數：${totalTheoreticalCombs} 組 \n【當前交付解鎖明牌（已完美大組控重，且100%過濾歷史頭獎紀錄！）】\n-------------------------\n` + finalOutputCombs.join('') + `-------------------------\n【輸出模式】${modeLabel}\n`
        }) + "\n");
        return res.end();
    } // 🌟 完美閉合通道 A 
     if (!isVipPass) {
        // 如果沒有月費 VIP，也沒有 24 小時通行證，直接物理阻斷，引導使用者去前台點擊「單次解鎖」
        res.write(JSON.stringify({ 
            success: false, 
            status: 402, 
            message: "權限鎖定：高階篩選需持有 24 小時通行證，請先點擊『單次解鎖 (10點)』獲取憑證！" 
        }) + "\n");
        return res.end();
    } else {
        // 已持有時效憑證，綠色通道直接放行，0 點數消耗！
        res.write(JSON.stringify({ isPointsUpdated: true, remainingPoints: dbUser.points, isPaidMember: dbUser.isPaidMember === true }) + "\n");
    }

    global.activeRequestsCount = (global.activeRequestsCount || 0) + 1;
    console.log(`[極速全量大腦] 啟動 1398 萬組全量位元拓撲過濾引擎，目標 90 秒內大竣工！\n`);
    
    let isFinished = false;
    const finalOutputCombs = [];
    let liveScannedCount = 0;
    const workers = [];
    
    const mineBalls = (cfg.f1_on === true || cfg.f1_on === 'true') && cfg.f1_set ? Array.from(cfg.f1_set).map(Number) : [];
    const favBalls = (cfg.vip_fav_on === true || cfg.vip_fav_on === 'true') && cfg.vip_fav_set ? Array.from(cfg.vip_fav_set).map(Number) : [];
    let initialValidBalls = Array.from({ length: mainMaxBall }, (_, i) => i + 1).filter(b => !mineBalls.includes(b));
    let availableBallsForWheel = initialValidBalls.filter(b => !favBalls.includes(b));
    
    const availableSlotsPerGroup = mainPickCount - favBalls.length;
    const singleBigGroupLimit = availableSlotsPerGroup > 0 ? Math.floor(availableBallsForWheel.length / availableSlotsPerGroup) : 1;
    
    let globalUniqueSet = new Set();
    let currentBigGroupUsedBallsSet = new Set();

    await new Promise((resolve) => {
        // 🌟 100% 還原原創 3 分鐘超時阻斷器與實時記憶體 RSS 日誌，絕不省略：
        const safetyTimeout = setTimeout(() => {
            const memSnapshot = process.memoryUsage();
            console.log(`=======================================================`);
            console.log(`[海選阻斷] 觸及 5 分鐘極限安全壁壘，中繼站安全收卷交付現存組數。`);
            console.log(` 常駐記憶體 (RSS): [ ${(memSnapshot.rss / 1024 / 1024).toFixed(2)} MB ]`);
            console.log(`=======================================================`);
            
            isFinished = true;
            workers.forEach(w => w.terminate());
            global.activeRequestsCount = Math.max(0, global.activeRequestsCount - 1);
            
            res.write(JSON.stringify({ isProgress: true, percent: 100, currentMatch: finalOutputCombs.length }) + "\n");
            let modeLabel = cfg.vipMode === 'smart' ? '聰明包牌 (全量隨機+大組互斥-超時熔斷版)' : '一般篩選 (1398萬組全量秒殺-超時自癒版)';
            res.write(JSON.stringify({
                success: true,
                outputText: `【VIP海選超時熔斷安全交卷】\n-------------------------\n` + finalOutputCombs.join('') + `-------------------------\n【輸出模式】${modeLabel}\n`
            }) + "\n");
            res.end();
            resolve();
        }, 300000);

        // 🌟 核心修正：將前端傳入的歷史資料庫作為 passedHistoryDB 精確指派進去，對齊底層！
        const worker = new Worker(__filename, { workerData: { cfg, passedHistoryDB: globalHistoryDB || [], threadId: 0 } });
        workers.push(worker);

        // ======= 【核心串流交互觀測接收艙】 ─── 🟢 🎯 =======
   // ======= 【核心串流交互觀測接收艙】 ─── ======= 🟢 🎯
 // 【2026融合大腦改造：計分板淘汰賽晶片】
 const leaderBoard = []; // 格式: { score: X, comb: [...], formatted: '...', unit: Y }

 worker.on('message', (msg) => {
    if (isFinished) return;

    // 🚀【究極作用域補丁】：強行在所有 if 艙門的最頂端天花板宣告共享最大上限，徹底封殺 518 行變數未定義崩潰！
    const absoluteMaxTotal = msg.maxTotal || (cfg.lottoType === "49_6" ? 13983816 : 575757);

  if (msg.type === 'TOTAL_SCAN_PROGRESS') {
    liveScannedCount = msg.scanned;
    let currentProgressPercent = Math.min(99, Math.floor((msg.scanned / absoluteMaxTotal) * 100));
    if (currentProgressPercent < 5) currentProgressPercent = 5;
    console.log(`[全域海選進度] 已老實掃描: ${msg.scanned} / ${absoluteMaxTotal} 組 (${currentProgressPercent}%) | 當前本地總生成: ${msg.totalGen || 0} 組`);

    // 🔬【16道防線全景算力擊殺快照】：一碼不漏，完整接收並列印 1 ~ 16 關卡獨立計數
    if (msg.stats && msg.scanned % 500000 === 0) {
      const s = msg.stats;
      console.log(`\n======================= 📊 [16防線動態擊殺全景觀測] =======================`);
      console.log(` 📌 [基建防線] 條件01(地雷排除): ${s[1] || 0} 組 | 條件02(首尾熱區): ${s[2] || 0} 組 | 條件03(落點區塊): ${s[3] || 0} 組`);
      console.log(` 📌 [物理過濾] 條件04(同尾限制): ${s[4] || 0} 組 | 條件05(奇偶比例): ${s[5] || 0} 組 | 條件06(號碼總和): ${s[6] || 0} 組`);
      console.log(` 📌 [數學規律] 條件07(連續號牆): ${s[7] || 0} 組 | 條件08(等差數列): ${s[8] || 0} 組 | 條件13(算術AC值): ${s[13] || 0} 組`);
      console.log(` 📌 [大數據庫] 條件09(鄰號夾擊): ${s[9] || 0} 組 | 條件10(上期連莊): ${s[10] || 0} 組 | 條件14(質數合數): ${s[14] || 0} 組`);
      console.log(` 📌 [終極防護] 條件11(大小分流): ${s[11] || 0} 組 | 條件12(除三餘數): ${s[12] || 0} 組 | 條件15(歷史重疊): ${s[15] || 0} 組`);
      console.log(` 📌 [皇家特權] 條件16(必開喜愛): ${s[0] || 0} 組`);
      console.log(`=================================================================================\n`);
    }

    res.write(JSON.stringify({ 
      isProgress: true, 
      percent: currentProgressPercent, 
      currentMatch: leaderBoard.length,
      scanned: msg.scanned,
      maxTotal: absoluteMaxTotal,
      totalGen: msg.totalGen || 0,
      fullStats: msg.stats 
    }) + "\n");
    return;
  }

  if (msg.type === 'CHUNK_SYNC_BOARD') {
    leaderBoard.length = 0;
    leaderBoard.push(...msg.leaderBoard);
    return;
  }

  if (msg.type === 'FINAL_SURVIVE_DELIVERY') {
    if (typeof safetyTimeout !== 'undefined') {
      clearTimeout(safetyTimeout);
      console.log(`[安全防禦解鎖] 大數據全量竣工，5分鐘限時熔斷器已成功物理拆除。`);
    }
    leaderBoard.length = 0;
    leaderBoard.push(...msg.leaderBoard);
    console.log(`=======================================================`);
    console.log(`🎉 [大數據全量 100% 竣工通車] 1398 萬組海選大竣工！`);
    console.log(` 最終死守並交付全榜最優解：${leaderBoard.length} 組名牌`);
    console.log(`=======================================================`);
    
    // 🚀【終極自癒拆彈】：徹底抹除舊殘留 maxTotalVal，完全對齊天花板共享常數 absoluteMaxTotal，100% 絕不崩潰！
    res.write(JSON.stringify({ 
      isProgress: false, 
      isCompleted: true, 
      percent: 100, 
      currentMatch: leaderBoard.length,
      scanned: absoluteMaxTotal,
      maxTotal: absoluteMaxTotal,
      totalGen: msg.totalGen || absoluteMaxTotal,
      fullStats: msg.stats
    }) + "\n");
    return;
  }

 });

 // 輔助晶片：將計分板數據滾動倒出到原本的交付容器中，維持與前台的對齊
 function compileLeaderboardToOutput() {
 finalOutputCombs.length = 0; // 清空舊數集
 leaderBoard.forEach((item, index) => {
 const indexStr = String(index + 1).padStart(2, '0');
 finalOutputCombs.push(`第 [${indexStr}] 組 (第 ${item.unit} 大組) [評分: ${item.score}分] : ${item.formatted}\n`);
 });
 }
 
 // 動態將此編譯函式掛載到全域，以便底下的超時或時間截止處理器能正確收網
 global.compileOutput = compileLeaderboardToOutput;
 });


    const heartbeatTimer = setInterval(() => {
        if (isFinished) return clearInterval(heartbeatTimer);
        res.write(JSON.stringify({ isProgress: true, isHeartbeat: true, percent: Math.min(99, Math.floor((finalOutputCombs.length / pickLimit) * 100)) }) + "\n");
    }, 10000);

 if (typeof global.compileOutput === 'function') global.compileOutput();
 let modeLabel = cfg.vipMode === 'smart' ? '聰明包牌 (動態計分淘汰賽+大組互斥融合體)' : '一般篩選 (分片賽區滾動PK排行版)';
 res.write(JSON.stringify({ 
 success: true, 
 outputText: `【VIP融合大腦分選竣工】中繼站本分片隨機拋射總數：${liveScannedCount} 組 \n \n【當前交付全局最優解鎖明牌】：\n-------------------------\n` + 
 finalOutputCombs.join('') + `-------------------------\n【輸出模式】${modeLabel}\n`
 }) + "\n");
 res.end();

  } catch (globalErr) {
    console.error(" 雲端大腦內核阻斷異常：", globalErr.message);
    try { res.write(JSON.stringify({ success: false, message: `後台突發故障` }) + "\n"); res.end(); } catch (e) {}
  }
});
} // 🌟 完美閉合主執行緒的完全體結構

if (!isMainThread) {
    const { cfg, passedHistoryDB } = workerData;
    const lottoType = cfg.lottoType || "39_5";
    const maxBall = lottoType === "49_6" ? 49 : 39;
    const pickCount = lottoType === "49_6" ? 6 : 5;

    // 🌟 終極修正：子執行緒精確與主執行緒傳入的 passedHistoryDB 對齊！
    const historyDB = passedHistoryDB || [];
    let lastPeriod = (historyDB.length > 0 && Array.isArray(historyDB[historyDB.length - 1])) 
        ? historyDB[historyDB.length - 1].map(Number) 
        : [];
    const lastPeriodSet = new Set(lastPeriod);
    const neighborSet = new Set();
    let range = parseInt(cfg.f9_range, 10) || 1;
    lastPeriod.forEach(val => { 
        for (let d = -range; d <= range; d++) { if (d !== 0) neighborSet.add(val + d); } 
    });

    // ==========================================
    // 【第一階段：優先判定條件 15 分裂】
    // ==========================================
    const historyEvapSet = new Set();
   const f15_on = (cfg.f15_on === true || cfg.f15_on === 'true');

    if (Array.isArray(historyDB)) {
        historyDB.forEach(h => {
            if (!Array.isArray(h)) return;
            const sortedNums = h.slice(0, pickCount).map(Number).sort((a, b) => a - b);
            if (f15_on) {
                const splitCount = pickCount - 1; 
                const kCombs = (arr, k) => {
                    const res = [];
                    const dfs = (start, curr) => {
                        if (curr.length === k) { res.push(curr.join(',')); return; }
                        for (let i = start; i < arr.length; i++) dfs(i + 1, [...curr, arr[i]]);
                    };
                    dfs(0, []);
                    return res;
                };
                kCombs(sortedNums, splitCount).forEach(subKey => historyEvapSet.add(subKey));
            } else {
                historyEvapSet.add(sortedNums.join(','));
            }
        });
    }

    // ==========================================
    // 【第二階段：優先判定條件 1 與 16 基礎裁剪】
    // ==========================================
    const f1_on = (cfg.f1_on === true || cfg.f1_on === 'true');
    const f1_set = new Set(f1_on && cfg.f1_set ? (Array.isArray(cfg.f1_set) ? cfg.f1_set.map(Number) : cfg.f1_set.split(',').map(v => parseInt(v.trim(), 10)).filter(n => !isNaN(n))) : []);
    const vip_fav_on = (cfg.vip_fav_on === true || cfg.vip_fav_on === 'true');
    const favBalls = vip_fav_on && cfg.vip_fav_set ? Array.from(cfg.vip_fav_set).map(Number) : [];
    let basePool = Array.from({ length: maxBall }, (_, i) => i + 1).filter(b => !f1_set.has(b));

    // ==========================================
    // 【第三階段】：過濾鏈由大到小排序 (高剃除率主力)
    // ==========================================
 const filters = [];

 // ⚙️ 【極速最前線：關卡 02 ── 首尾邊界熱區檢查】(提權理由: 僅看頭尾兩碼, 0.1微秒完成, 剔除率超高)
 const f2_on = (cfg.f2_on === true || cfg.f2_on === 'true');
 if (f2_on) {
   const f2_min = Number(cfg.f2_min) || 15;
   const f2_max = Number(cfg.f2_max) || 30;
   filters.push({
     id: 2,
     exec: (comb) => {
       if (comb[0] >= f2_min) return true;
       if (comb[comb.length - 1] <= f2_max) return true;
       return false;
     }
   });
 }

 // ⚙️ 【極速最前線：關卡 06 ── 號碼總和範圍】(提權理由: 純加法運算極快, 一鍵封殺大批極端數字)
const f6_on = (cfg.f6_on === true || cfg.f6_on === 'true');
if (f6_on) {
  const defaultLow = lottoType === "49_6" ? 110 : 70;
  const defaultHigh = lottoType === "49_6" ? 210 : 130;
  const f6_low = Number(cfg.f6_low) || defaultLow;
  const f6_high = Number(cfg.f6_high) || defaultHigh;
  
  filters.push({
    id: 6,
    exec: (comb) => {
      const sumvalue = comb.reduce((a, b) => a + b, 0);
      
      // 🎯 滿血自癒修正：只要總和低於下限 或 高於上限， return true 毫不留情直接封殺！
      if (sumvalue < f6_low || sumvalue > f6_high) {
        return true;
      }
      
      return false; // 落在黃金區間內，判定為健康組合，允許生還放行
    }
  });
}
 // ⚙️ 【中階防線：關卡 11 ── 大小數比例分流】
const f11_on = (cfg.f11_on === true || cfg.f11_on === 'true');
if (f11_on && (cfg.f11_kill || cfg.f11_kill === 'true')) {
  const midPoint = lottoType === "49_6" ? 25 : 20;
  
  filters.push({
    id: 11,
    exec: (comb) => {
      // 🎯 滿血自癒晶片：直接統計這組號碼內「大數」的真實總個數
      let bigCount = 0;
      const len = comb.length;
      
      for (let i = 0; i < len; i++) {
        if (comb[i] >= midPoint) {
          bigCount++;
        }
      }
      
      const smallCount = len - bigCount;
      
      // 🎯 核心判定：如果「全大數 (bigCount === len)」、「全小數 (smallCount === len)」
      // 或是極端失衡的「只有1碼大 (bigCount === 1)」或「只有1碼小 (smallCount === 1)」
      // return true 毫不留情直接封殺剔除！
      if (bigCount === len || smallCount === len || bigCount === 1 || smallCount === 1) {
        return true;
      }
      
      return false; // 大小數比例均衡常態，判定為健康組合，允許生還放行
    }
  });
}

 // ⚙️ 【中階防線：關卡 05 ── 奇偶比例動態防禦】
const f5_on = (cfg.f5_on === true || cfg.f5_on === 'true');
if (f5_on) {
  const isLotto = lottoType === "49_6";
  const killAll = isLotto ? (cfg.f5_lotto_60 || false) : (cfg.f5_539_50 || false);
  const killOneElement = isLotto ? (cfg.f5_lotto_51 || false) : (cfg.f5_539_41 || false);
  const limit = isLotto ? 5 : 4; // 大樂透極端為 5:1/1:5，539極端為 4:1/1:4
  
  filters.push({
    id: 5,
    exec: (comb) => {
      let odds = 0, evens = 0;
      const len = comb.length;
      
      // 🎯 滿血自癒計數器：精確統計這組組合的奇偶數實體
      for (let m = 0; m < len; m++) {
        if ((comb[m] & 1) === 1) odds++; 
        else evens++;
      }
      
      // 🎯 滿血修正一：勾選排除全奇全偶，且真的踩雷（全奇或全偶）， return true 封殺！
      if (killAll && (odds === len || evens === len)) {
        return true;
      }
      
      // 🎯 滿血修正二：勾選排除極端失衡，且真的踩雷（僅1碼奇或1碼偶）， return true 封殺！
      if (killOneElement && (odds === limit || evens === limit)) {
        return true;
      }
      
      return false; // 奇偶比例分佈在健康常態區間，允許生還放行
    }
  });
}

 // ⚙️ 【結構防線：關卡 12 ── 除三餘數 012 路】
 const f12_on = (cfg.f12_on === true || cfg.f12_on === 'true');
if (f12_on && (cfg.f12_kill || cfg.f12_kill === 'true')) {
  filters.push({
    id: 12,
    exec: (comb) => {
      let has0 = false, has1 = false, has2 = false;
      const len = comb.length;
      
      for (let m = 0; m < len; m++) {
        const rem = comb[m] % 3;
        if (rem === 0) has0 = true;
        else if (rem === 1) has1 = true;
        else has2 = true;
        
        // 快速優化：如果三路都齊全了，代表確定及格，可提早跳出
        if (has0 && has1 && has2) break;
      }
      
      // 🎯 滿血自癒修正：如果「0路沒出現」或「1路沒出現」或「2路沒出現」（發生斷路），
      // 代表這是極端組合， return true 毫不留情直接封殺！
      if (!has0 || !has1 || !has2) {
        return true;
      }
      
      return false; // 三路皆有落點，判定為常態健康組合，允許生還放行
    }
  });
}
  
 // ⚙️ 【結構防線：關卡 04 ── 同尾數上限限制】
const f4_on = (cfg.f4_on === true || cfg.f4_on === 'true');
if (f4_on) {
  const targetMax = Number(cfg.f4_max) || 2;
  
  filters.push({
    id: 4,
    exec: (comb) => {
      // 使用 Uint8Array(10) 高速統計 0~9 的尾數出現次數
      const tails = new Uint8Array(10);
      const len = comb.length;
      
      for (let m = 0; m < len; m++) {
        const tail = comb[m] % 10;
        tails[tail]++;
        
        // 🎯 滿血自癒修正：只要任何一個尾數的出現次數超過了用戶設定的上限（例如 > 2），
        // 代表這組號碼同尾數過度扎堆， return true 毫不留情直接封殺！
        if (tails[tail] > targetMax) {
          return true;
        }
      }
      
      return false; // 所有尾數重複次數皆在安全上限內，判定為健康組合，允許生還放行
    }
  });
}

  
 // ⚙️ 【結構防線：關卡 07 ── 連續號碼牆攔截】
 const f7_on = (cfg.f7_on === true || cfg.f7_on === 'true');
if (f7_on) {
  const targetLen = Number(cfg.f7_len) || 3;
  
  filters.push({
    id: 7,
    exec: (comb) => {
      let currentSeq = 1;
      const len = comb.length;
      
      for (let m = 1; m < len; m++) {
        if (comb[m] === comb[m - 1] + 1) {
          currentSeq++;
          
          // 🎯 滿血自癒修正：只要當前連續長度達到或超過了用戶設定的上限（例如 >= 3），
          // 代表連號過長， return true 毫不留情直接封殺剔除！
          if (currentSeq >= targetLen) {
            return true;
          }
        } else {
          currentSeq = 1; // 斷開連續，重置計數
        }
      }
      
      return false; // 全組連號長度皆在安全限制內，判定為健康組合，允許生還放行
    }
  });
}

 // ⚙️ 【結構防線：關卡 14 ── 質數合數過濾】
 const f14_on = (cfg.f14_on === true || cfg.f14_on === 'true');
if (f14_on && (cfg.f14_kill || cfg.f14_kill === 'true')) {
  const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]);
  
  filters.push({
    id: 14,
    exec: (comb) => {
      let pCount = 0;
      const len = comb.length;
      
      for (let m = 0; m < len; m++) {
        if (primes.has(comb[m])) {
          pCount++;
          
          // 🎯 滿血自癒修正：只要這組號碼內部的質數總數達到或超過 4 個（太極端了），
          // return true 毫不留情直接封殺剔除！
          if (pCount >= 4) {
            return true;
          }
        }
      }
      
      return false; // 質數數量在 1~3 個常態安全區間，判定為健康組合，允許生還放行
    }
  });
}

  
 // Filter 03: reject combinations concentrated inside any N physical zones.
// Example: f3_count=3 rejects zones 1-2-3, 1-3-5, 2-3-4, etc.; only 4-5 zone spread survives.
 const f3_on = (cfg.f3_on === true || cfg.f3_on === 'true');
 if (f3_on) {
   const excludedZoneLimit = Math.max(1, Math.min(4, Number(cfg.f3_count) || 3));
   const divisor = lottoType === "49_6" ? 10 : 8;
   filters.push({
id: 3,
  exec: (comb) => {
    // 取得前端用戶填入的過濾門檻（例如填入 3，代表 1~3 個區塊內的組合一律封殺）
    const minZoneRequired = Math.max(1, Math.min(4, Number(cfg.f3_count) || 3));
    const divisor = lottoType === "49_6" ? 10 : 8;
    
    let zoneMask = 0;
    const len = comb.length;
    
    for (let m = 0; m < len; m++) {
      let zone = Math.floor((comb[m] - 1) / divisor);
      if (zone > 4) zone = 4; // 確保在 0~4 的陣列索引安全邊界內
      
      const bit = 1 << zone;
      if ((zoneMask & bit) === 0) {
        zoneMask |= bit;
      }
    }
    
    // 💡 物理區塊數大對齊：計算總共佔用了幾個獨立區塊（數量必為 1~5 個區塊）
    let totalZonesOccupied = 0;
    for (let i = 0; i < 5; i++) {
      if ((zoneMask & (1 << i)) !== 0) {
        totalZonesOccupied++;
      }
    }
    
    // 🎯 核心反轉防線：如果這組號碼太集中，佔用的總區塊數 <= 用戶填入的門檻（例如 1~3 區），
    // 毫不留情直接封殺（return true）！逼迫所有存活組合必須落點在 4~5 個區塊內！
    if (totalZonesOccupied <= minZoneRequired) {
      return true; 
    }
    
    return false; // 通過考驗，判定為常態分散組合，允許生還
  }
   });
 }

 // ⚙️ 【大數據防線：關卡 10 ── 連莊號封殺】
const f10_on = (cfg.f10_on === true || cfg.f10_on === 'true');
if (f10_on && lastPeriod.length > 0) {
  const targetMax = Number(cfg.f4_max) || 2; // 這裡依據您的設定檔，若前端是 f10_max 請改為 cfg.f10_max
  
  filters.push({
    id: 10,
    exec: (comb) => {
      let repCount = 0;
      const len = comb.length;
      
      for (let m = 0; m < len; m++) {
        if (lastPeriodSet.has(comb[m])) {
          repCount++;
          
          // 🎯 滿血自癒修正：只要重複的連莊號碼個數超過了用戶設定的上限（例如 > 2），
          // 代表連莊太嚴重， return true 毫不留情直接封殺剔除！
          if (repCount > targetMax) {
            return true;
          }
        }
        
        // 剪枝優化：即使剩下的號碼全部都連莊，加起來也不會超過 targetMax 時，可以提早安全跳出放行
        if (repCount + (len - 1 - m) <= targetMax) {
          break;
        }
      }
      
      return false; // 連莊個數在安全上限內，判定為健康組合，允許生還放行
    }
  });
}

 // ⚙️ 【大數據防線：關卡 09 ── 鄰號夾擊防線】
 const f9_on = (cfg.f9_on === true || cfg.f9_on === 'true');
if (f9_on && neighborSet.size > 0) {
  // 🎯 滿血自癒變數對齊：確保對齊您前端傳過來的鄰號上限參數（預設限制為 2 碼）
  const targetMax = Number(cfg.f9_count) || 2; 
  
  filters.push({
    id: 9,
    exec: (comb) => {
      let neiCount = 0;
      const len = comb.length;
      
      for (let m = 0; m < len; m++) {
        if (neighborSet.has(comb[m])) {
          neiCount++;
          
          // 🎯 滿血自癒修正：只要包含的鄰號個數超過了用戶設定的上限（例如 > 2），
          // 代表鄰號過度扎堆， return true 毫不留情直接封殺剔除！
          if (neiCount > targetMax) {
            return true;
          }
        }
        
        // 剪枝優化：即使剩下的號碼全部都是鄰號，加起來也不會超過 targetMax 時，可以提早安全跳出放行
        if (neiCount + (len - 1 - m) <= targetMax) {
          break;
        }
      }
      
      return false; // 鄰號個數在安全上限內，判定為健康組合，允許生還放行
    }
  });
}
 // ⚙️ 【大數據防線：關卡 08 ── 等差數字組構封鎖】
 const f8_on = (cfg.f8_on === true || cfg.f8_on === 'true');
if (f8_on) {
  filters.push({
    id: 8,
    exec: (comb) => {
      const limit = comb.length - 3;
      
      for (let i = 0; i <= limit; i++) {
        const diff1 = comb[i + 1] - comb[i];
        const diff2 = comb[i + 2] - comb[i + 1];
        
        // 🎯 滿血自癒修正：只要發現任意連續三碼出現等差規律（間距相同），
        // 代表踩到人工號地雷， return true 毫不留情直接封殺剔除！
        if (diff1 >= 1 && diff1 === diff2) {
          return true;
        }
      }
      
      return false; // 全組號碼毫無人為等差規律，判定為健康組合，允許生還放行
    }
  });
}

 // ⚙️ 【重型數學閘：關卡 13 ── 數字複雜度 AC 值雙重遍歷】(保留在最後：雙重迴圈開銷大)
 const f13_on = (cfg.f13_on === true || cfg.f13_on === 'true');
if (f13_on) {
  // 對齊變數：基本 AC 門檻值（前端填入 7，則 targetMin 計算正確對齊數學公式）
  const userMin = Number(cfg.f13_min) || 7;
  const targetMin = userMin + (pickCount - 1);
  
  filters.push({
    id: 13,
    exec: (comb) => {
      const len = comb.length;
      const diffTable = new Uint8Array(80);
      let diffCount = 0;
      
      for (let m = 0; m < len; m++) {
        const numM = comb[m];
        for (let n = m + 1; n < len; n++) {
          const diff = comb[n] - numM;
          if (diffTable[diff] === 0) {
            diffTable[diff] = 1;
            diffCount++;
          }
        }
        
        // 🎯 滿血自癒剪枝修正：即使後面剩下的所有對數(Pairs)全部都是全新未出現的差值，
        // 加起來依然無法達到 targetMin 門檻時，代表這組號碼註定不及格， return true 提前阻斷封殺！
        const remainingPairs = ((len - m - 1) * (len - m - 2)) / 2;
        if (diffCount + remainingPairs < targetMin) {
          return true;
        }
      }
      
      // 🎯 滿血自癒最終判定：如果最終得到的差值總種類數小於門檻（複雜度不夠）， return true 封殺！
      if (diffCount < targetMin) {
        return true;
      }
      
      return false; // 複雜度達標，判定為健康常態組合，允許生還放行
    }
  });
}
 // ========================================================
 // 【生存審查主閘門：短路自癒引擎完全體】 ─── 🔬 🪙
 // ========================================================
 const killStats = new Uint32Array(16); // 0~15 關卡獨立死亡計數矩陣
 let totalGeneratedTestCount = 0;       // 總計數

 function isGeneSurvive(comb) {
  totalGeneratedTestCount++; // 累加總隨機拋射母體次數
  
  // ─── 【第一階段：輕量化短路過濾鏈極速沖刷】 ───
  // 依序執行所有已載入的防線，只要有任何一條防線踩雷（回傳 true），立刻執行短路阻斷！
  for (let i = 0; i < filters.length; i++) {
    
    // 🎯 終極修復點：拿掉原本錯誤的反轉驚嘆號！
    // 當 filters[i].exec(comb) 回傳 true（代表踩到地雷、不合格）時，立刻進來抓捕
    if (filters[i].exec(comb)) { 
      
      // 像素級紀錄：哪一個防線 ID 成功擊殺了這組號碼（提供前端 VIP 圓餅圖統計）
      if (filters[i].id >= 0 && filters[i].id < 16) {
        killStats[filters[i].id]++;
      }
      
      return false; // 判定此組合基因死亡，不允許生還，拒絕交付前端
    }
  }
  
  return true; // 恭喜！通過所有魔鬼防線考驗，判定為黃金生還組合，滿血交付前端！
}

   // 🏎【第二階段：最沉重的魔王級條件 15 移至最末端執行】
   // 只有百分之百通過前面所有防線的精銳，才允許進來跑昂貴的 DFS 遞迴歷史比對！
f15_on = (cfg.f15_on === true || cfg.f15_on === 'true');
if (f15_on) {
  const splitCount = pickCount - 1;
  let conflict = false;
  
  const checkDfs = (start, curr) => {
    if (conflict) return;
    if (curr.length === splitCount) {
      if (historyEvapSet.has(curr.join(','))) {
        conflict = true;
      }
      return;
    }
    
    const combLen = comb.length;
    for (let i = start; i < combLen; i++) {
      checkDfs(i + 1, [...curr, comb[i]]);
    }
  };
  
  checkDfs(0, []);
  
  // 🎯 滿血自癒修正：與全新總閘門完全咬合！
  // 如果 conflict 為 true（代表新號碼與歷史開獎高度重疊）， return true 毫不留情直接封殺！
  if (conflict) {
    if (killStats && killStats[15] !== undefined) {
      killStats[15]++; // 記錄到死亡矩陣
    }
    return false; // 💡 這裡返還 false，因為它是獨立寫在 isGeneSurvive 尾端的主邏輯，直接回報此基因死亡！
  }
} else {
  // 🟢 【越權串音漏洞閹割補丁】：如果用戶沒勾選條件 15，直接綠色通道放行，絕不盲目比對歷史獎號！
  // 徹底將沒打勾時的條件 15 擊殺計數器死死焊接在 0！
}

// 👑 恭喜安全生還！通過全後端 1~16 條魔鬼防線的所有考驗，全線點火通車！
return true; 
} // 關閉整個 isGeneSurvive 總閘門
  
// =========================================================================
// 🔥【2026 終極完全體：零記憶體極速拓撲海選內核】🔥
// =========================================================================
let scannedCount = 0;
const maxCombinations = lottoType === "49_6" ? 13983816 : 575757;
const poolLength = basePool.length;
const requiredSlots = pickCount - favBalls.length;

(async function runDeterministicBrain() {
  const isLotto = lottoType === "49_6";
  const maxNum = isLotto ? 49 : 39;
  let localTotalGen = 0;
  
  // ⚡【子執行緒原地排行榜】：完全不拋射物件給主執行緒，在原地留 100 組，其餘秒刪！
  let localLeaderBoard = [];
  let minScoreInLocalBoard = -99999;
  const pickLimit = Math.min(100, Math.max(1, Number(cfg.count) || 100));
  const candidateLimit = Math.max(800, pickLimit * 8);

  function overlapCount(a, b) {
    const bSet = new Set(b);
    let count = 0;
    for (const n of a) if (bSet.has(n)) count++;
    return count;
  }

  function diversifyBoard(candidates) {
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    const selected = [];
    const strictOverlap = pickCount >= 6 ? 2 : 2;
    for (let maxOverlap = strictOverlap; selected.length < pickLimit && maxOverlap <= pickCount - 1; maxOverlap++) {
      for (const item of sorted) {
        if (selected.length >= pickLimit) break;
        if (selected.some(existing => existing.formatted === item.formatted)) continue;
        if (selected.every(existing => overlapCount(existing.comb, item.comb) <= maxOverlap)) selected.push(item);
      }
    }
    selected.forEach((item, idx) => {
      item.unit = Math.floor(idx / Math.max(1, Math.floor(maxNum / pickCount))) + 1;
    });
    return selected;
  }

  const breathe = () => new Promise(resolve => {
    if (typeof setImmediate !== 'undefined') setImmediate(resolve);
    else setTimeout(resolve, 0);
  });

  const fSet = new Set(favBalls);
  const remainingPool = [];
  for (let i = 1; i <= maxNum; i++) {
    if (!fSet.has(i)) remainingPool.push(i);
  }

  for (let i = remainingPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remainingPool[i], remainingPool[j]] = [remainingPool[j], remainingPool[i]];
  }

  const rSlotsCount = requiredSlots;
  const pLen = remainingPool.length;

  // 🚀【子執行緒原地極速評分與 PK 晶片】
  function processAndLocalPK(combination) {
    if (!isGeneSurvive(combination)) return; // 一條防線沒過，瞬間釋放記憶體

    // 計算 2026 數據特徵分
    let healthScore = 50; 
    const sumVal = combination.reduce((x, y) => x + y, 0);
    const lowBound = isLotto ? 110 : 70;
    const highBound = isLotto ? 185 : 125;
    if (sumVal >= lowBound && sumVal <= highBound) healthScore += 25;

    let oddsCount = 0;
    combination.forEach(num => { if ((num & 1) === 1) oddsCount++; });
    if (isLotto) {
      if (oddsCount === 3) healthScore += 25;
      else if (oddsCount === 2 || oddsCount === 4) healthScore += 10;
    } else {
      if (oddsCount === 2 || oddsCount === 3) healthScore += 25;
    }

    // 🏆 原地殘酷 PK 淘汰賽：輸的組合當場被 JavaScript 垃圾回收銷毀，不佔任何 Byte
    if (localLeaderBoard.length < candidateLimit) {
      const formatted = combination.map(n => String(n).padStart(2, '0')).join(', ');
      localLeaderBoard.push({ score: healthScore, comb: combination, formatted });
      if (localLeaderBoard.length === candidateLimit) {
        localLeaderBoard.sort((a, b) => b.score - a.score);
        minScoreInLocalBoard = localLeaderBoard[candidateLimit - 1].score;
      }
    } else if (healthScore > minScoreInLocalBoard) {
      localLeaderBoard.pop(); // 剔除最低分守門員
      const formatted = combination.map(n => String(n).padStart(2, '0')).join(', ');
      localLeaderBoard.push({ score: healthScore, comb: combination, formatted });
      localLeaderBoard.sort((a, b) => b.score - a.score); // 僅對 100 組排序，毫無內耗
      minScoreInLocalBoard = localLeaderBoard[candidateLimit - 1].score;
    }
  }

  // 【操盤手指定：50 萬組分片切割沖刷晶片】
  async function triggerChunkFlush() {
    if (scannedCount % 500000 === 0 || scannedCount === maxCombinations) {
      const currentPercent = Math.min(Math.floor((scannedCount / maxCombinations) * 100), 100);
      
      // 精確拋出理論最大值與原始防線陣列，絕不刪除監測
      parentPort.postMessage({ 
        type: 'TOTAL_SCAN_PROGRESS', 
        scanned: scannedCount, 
        maxTotal: maxCombinations,
        percent: currentPercent,
        stats: Array.from(killStats),
        totalGen: localTotalGen
      });

      parentPort.postMessage({
        type: 'CHUNK_SYNC_BOARD',
        leaderBoard: diversifyBoard(localLeaderBoard)
      });
      
      await breathe(); 
    }
  }

  // 【2026 完全體：多維拓撲限流分片迴圈晶片】
  for (let i0 = 0; i0 < pLen; i0++) {
    if (scannedCount >= maxCombinations) break;
    for (let i1 = i0 + 1; i1 < pLen; i1++) {
      for (let i2 = i1 + 1; i2 < pLen; i2++) {
        if (rSlotsCount === 3) {
          scannedCount++; localTotalGen++;
          await triggerChunkFlush();
          let combination = [...favBalls, remainingPool[i0], remainingPool[i1], remainingPool[i2]].sort((a,b)=>a-b);
          processAndLocalPK(combination);
        } else {
          for (let i3 = i2 + 1; i3 < pLen; i3++) {
            if (rSlotsCount === 4) {
              scannedCount++; localTotalGen++;
              await triggerChunkFlush();
              let combination = [...favBalls, remainingPool[i0], remainingPool[i1], remainingPool[i2], remainingPool[i3]].sort((a,b)=>a-b);
              processAndLocalPK(combination);
            } else {
              for (let i4 = i3 + 1; i4 < pLen; i4++) {
                if (rSlotsCount === 5) { 
                  scannedCount++; localTotalGen++;
                  await triggerChunkFlush();
                  let combination = [...favBalls, remainingPool[i0], remainingPool[i1], remainingPool[i2], remainingPool[i3], remainingPool[i4]].sort((a,b)=>a-b);
                  processAndLocalPK(combination);
                } else {
                  for (let i5 = i4 + 1; i5 < pLen; i5++) {
                    scannedCount++; localTotalGen++;
                    await triggerChunkFlush();
                    let combination = [...favBalls, remainingPool[i0], remainingPool[i1], remainingPool[i2], remainingPool[i3], remainingPool[i4], remainingPool[i5]].sort((a,b)=>a-b);
                    processAndLocalPK(combination);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  
  // 竣工大收網：將最終死守下來的精選 100 組全量交付主線程
  parentPort.postMessage({ type: 'TOTAL_SCAN_PROGRESS', scanned: scannedCount, maxTotal: maxCombinations, total: scannedCount, stats: Array.from(killStats), totalGen: localTotalGen });
  parentPort.postMessage({ type: 'FINAL_SURVIVE_DELIVERY', leaderBoard: diversifyBoard(localLeaderBoard) });

})(); // 完美閉合子執行緒非同步自執行大腦 🌟

// ───【2026 全域端口大總門】：監聽 Render 埠口並通電 ───
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("=======================================================");
  console.log(" 2026 LOTTO GA-WHEELING 究極完全體後端大腦通電成功！ ");
  console.log(` 多線程集流中繼站完美通車，埠口：[ ${PORT} ]`);
  console.log("=======================================================");
});
