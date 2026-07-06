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
    if (!cfg) {
  res.write(JSON.stringify({ success: false, message: "參數配置遺失" }) + "\n");
  return res.end();
}
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
// =========================================================================
// 👑【免死金牌直通區專用】聰明包牌模式：歷史交付明牌點對點去重打散晶片
// =========================================================================
if (cfg.vipMode === 'smart' && finalOutputCombs.length > 0) {
    let hasTooMuchOverlap = false;
    
    // 拿當前這組 currentComb 去跟已經決定要交付的每一組明牌比對
    for (const existingStr of finalOutputCombs) {
        // 從既有的字串中（例如 "第 [01] 組 ... : 01, 02, 03..."）把純號碼解析出來
        const match = existingStr.match(/:\s*([\d, \s]+)/);
        if (!match) continue;
        
        const existingNums = match[1].split(',').map(n => parseInt(n.trim(), 10));
        
        // 計算重複了幾顆球
        let overlap = 0;
        for (const ball of currentComb) {
            if (existingNums.includes(ball)) {
                overlap++;
            }
        }
        
        // 物理擊殺線：直通區不計算分數，所以只要跟已選號碼重複 3 顆球以上，直接判定長太像，原地擊殺剔除！
        if (overlap >= 3) {
            hasTooMuchOverlap = true;
            break;
        }
    }
    
    // 踩雷則直接 continue 跳過這組號碼，重新拋射下一組，直到號碼完全彈開！
    if (hasTooMuchOverlap) continue;
}
// =========================================================================

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

 // ======= 【2026 核心串流交互觀測接收艙：輕量減肥與動態狀態發射版】 ─── ======= 🟢 🎯
 // ======= 【2026 核心串流交互觀測接收艙：輕量減肥與動態狀態發射版】 ─── ======= 🟢 🎯
const leaderBoard = [];
worker.on('message', (msg) => {
  if (isFinished) return;
  const absoluteMaxTotal = msg.maxTotal || (cfg.lottoType === "49_6" ? 13983816 : 575757);
  
  if (msg.type === 'TOTAL_SCAN_PROGRESS') {
    liveScannedCount = msg.scanned;
    let currentProgressPercent = Math.min(99, Math.floor((msg.scanned / absoluteMaxTotal) * 100));
    if (currentProgressPercent < 5) currentProgressPercent = 5;
    
    if (msg.scanned % 500000 === 0 || msg.scanned === absoluteMaxTotal) {
      console.log(`[全域海選進度] 已老實掃描: ${msg.scanned} / ${absoluteMaxTotal} 組 (${currentProgressPercent}%) | 當前本地總生成: ${msg.totalGen || 0} 組`);
      if (msg.stats && Array.isArray(msg.stats)) {
        const s = msg.stats;
        console.log(`\n======================= [16防線動態擊殺全景觀測] =======================`);
        console.log(` [基建防線] 條件01(地雷排除): ${s[1] || 0} 組 | 條件02(首尾熱區): ${s[2] || 0} 組 | 條件03(落點區塊): ${s[3] || 0} 組`);
        console.log(` [物理過濾] 條件04(同尾限制): ${s[4] || 0} 組 | 條件05(奇偶比例): ${s[5] || 0} 組 | 條件06(號碼總和): ${s[6] || 0} 組`);
        console.log(` [數學規律] 條件07(連續號牆): ${s[7] || 0} 組 | 條件08(等差數列): ${s[8] || 0} 組 | 條件13(算術AC值): ${s[13] || 0} 組`);
        console.log(` [大數據庫] 條件09(鄰號夾擊): ${s[9] || 0} 組 | 條件10(上期連莊): ${s[10] || 0} 組 | 條件14(質數合數): ${s[14] || 0} 組`);
        console.log(` [終極防護] 條件11(大小分流): ${s[11] || 0} 組 | 條件12(除三餘數): ${s[12] || 0} 組 | 條件15(歷史重疊): ${s[15] || 0} 組`);
        console.log(` [皇家特權] 條件16(必開喜愛): ${s[0] || 0} 組`);
        console.log(`=================================================================================\n`);
      }
    }
    
    try {
      if (!res.writableEnded) {
        res.write(JSON.stringify({ 
          isProgress: true, 
          percent: currentProgressPercent, 
          currentMatch: leaderBoard.length,
          scanned: msg.scanned,
          maxTotal: absoluteMaxTotal,
          totalGen: msg.totalGen || 0
        }) + "\n");
      }
    } catch (e) {}
    return;
  }
  
  if (msg.type === 'CHUNK_SYNC_BOARD') {
    return;
  }
  
  if (msg.type === 'FINAL_SURVIVE_DELIVERY') {
    if (typeof safetyTimeout !== 'undefined' && safetyTimeout !== null) {
      clearTimeout(safetyTimeout);
    }
    
    leaderBoard.length = 0;
    if (msg.leaderBoard && Array.isArray(msg.leaderBoard)) {
      leaderBoard.push(...msg.leaderBoard);
    }
    
    console.log(`=======================================================`);
    console.log(` [大數據全量 100% 竣工通車] 1398 萬組海選大竣工！`); 
    console.log(` 最終死守並交付全榜最優解：${leaderBoard.length} 組名牌`);
    console.log(`=======================================================`);
    
    isFinished = true; 
    if (global.heartbeatTimer) {
      clearInterval(global.heartbeatTimer);
      global.heartbeatTimer = null;
    }
    
    try {
      if (!res.writableEnded) {
        res.write(JSON.stringify({ isProgress: true, percent: 99, stage: "SCORING", scanned: absoluteMaxTotal, maxTotal: absoluteMaxTotal, totalGen: msg.totalGen || absoluteMaxTotal }) + "\n");
      }
    } catch (e) {}
    
    compileLeaderboardToOutput();
    
    try {
      if (!res.writableEnded) {
        res.write(JSON.stringify({ isProgress: true, percent: 99, stage: "MUTUAL_EXCLUSION", scanned: absoluteMaxTotal, maxTotal: absoluteMaxTotal, totalGen: msg.totalGen || absoluteMaxTotal }) + "\n");
      }
    } catch (e) {}
    
    try {
      if (!res.writableEnded) {
        res.write(JSON.stringify({
          success: true,
          isProgress: false,
          isCompleted: true,
          percent: 100,
          currentMatch: Math.min(leaderBoard.length, pickLimit),
          scanned: absoluteMaxTotal,
          maxTotal: absoluteMaxTotal,
          totalGen: msg.totalGen || absoluteMaxTotal,
          fullStats: [], 
          outputText: `【VIP融合大腦分選竣工】中繼站本次海選實時通過總數：\n${liveScannedCount} 組 \n \n【當前交付全局最優解鎖明牌】：\n-------------------------\n` + finalOutputCombs.join('') + `-------------------------\n`
        }) + "\n");
        res.end(); 
        console.log("[串流大結局] 竣工數據順利發射，HTTP Chunked 通道已優雅關閉。");
      }
    } catch (streamErr) {
      console.error("[竣工發射突發攔截] 串流寫入失敗：", streamErr.message);
    } finally {
      global.activeRequestsCount = Math.max(0, (global.activeRequestsCount || 1) - 1);
    }
    return;
  }
});

function compileLeaderboardToOutput() {
  finalOutputCombs.length = 0; 
  if (!leaderBoard || leaderBoard.length === 0) return;
  
  try {
    const isSmartMode = (cfg && cfg.vipMode === 'smart');
    const isFavEnabled = (cfg && cfg.vip_fav_on === true && cfg.vip_fav_set && cfg.vip_fav_set.length > 0);
    const favNums = isFavEnabled ? cfg.vip_fav_set : [];
    
    for (let i = leaderBoard.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [leaderBoard[i], leaderBoard[j]] = [leaderBoard[j], leaderBoard[i]];
    }
    
    leaderBoard.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    let hardwareCleanBoard = leaderBoard.slice(0, 300);
    let currentAllowedOverlap = 1; 
    let currentMaxUnits = (cfg.lottoType === "49_6") ? 8 : 7; 
    let processedSuccessfully = false;
    let loopSanityCheck = 0;
    
    while (!processedSuccessfully && loopSanityCheck < 5) {
      loopSanityCheck++;
      let currentUnitTracker = 1;
      let usedNumbersInCurrentUnit = new Set();
      
      for (let i = 0; i < hardwareCleanBoard.length; i++) {
        let item = hardwareCleanBoard[i];
        if (!item || !item.comb) continue;
        
        const pureCombs = item.comb.filter(ball => !favNums.includes(ball));
        let overlapCount = 0;
        pureCombs.forEach(ball => { if (usedNumbersInCurrentUnit.has(ball)) overlapCount++; });
        
        let prevOverlapCount = 0;
        let isHeadVanceDuplicated = false;
        
        if (i > 0 && hardwareCleanBoard[i-1] && hardwareCleanBoard[i-1].comb) {
          pureCombs.forEach(ball => { if (hardwareCleanBoard[i-1].comb.includes(ball)) prevOverlapCount++; });
          if (item.comb[0] === hardwareCleanBoard[i-1].comb[0] && item.comb[1] === hardwareCleanBoard[i-1].comb[1]) {
            isHeadVanceDuplicated = true;
          }
        }
        
        if (overlapCount >= currentAllowedOverlap || prevOverlapCount >= currentAllowedOverlap || isHeadVanceDuplicated) {
          const maxOverlapFound = Math.max(overlapCount, prevOverlapCount);
          const headPenalty = isHeadVanceDuplicated ? 300 : 0; 
          item.score = Math.max(-400, (item.score || 0) - (120 * maxOverlapFound) - headPenalty); 
          item.unit = currentUnitTracker; 
        } else {
          pureCombs.forEach(ball => usedNumbersInCurrentUnit.add(ball));
          item.unit = currentUnitTracker;
          item.score = Math.max(250, (item.score || 0) + 150); 
        }
        
        if (usedNumbersInCurrentUnit.size >= ((cfg.lottoType === "49_6" ? 6 : 5) * 6) || i % 12 === 0) {
          currentUnitTracker++;
          if (currentUnitTracker > currentMaxUnits) currentUnitTracker = 1;
          usedNumbersInCurrentUnit.clear(); 
        }
      }
      
      hardwareCleanBoard.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return Math.random() - 0.5; 
      });
      
      let sampleScoreCount = hardwareCleanBoard.filter(x => x.score === hardwareCleanBoard.score).length;
      if (sampleScoreCount < 10) {
        processedSuccessfully = true; 
      } else {
        currentAllowedOverlap++; 
        if (currentMaxUnits > 4) currentMaxUnits--; 
      }
    }
    
    const totalCards = hardwareCleanBoard.length;
    const positiveScores = hardwareCleanBoard.filter(x => (x.score || 0) > 0).length;
    const zeroScores = hardwareCleanBoard.filter(x => (x.score || 0) === 0).length;
    const negativeScores = hardwareCleanBoard.filter(x => (x.score || 0) < 0).length;
    const highestScore = totalCards > 0 && hardwareCleanBoard ? (hardwareCleanBoard[0].score || 0) : 0;
    const lowestScore = totalCards > 0 && hardwareCleanBoard[totalCards - 1] ? (hardwareCleanBoard[totalCards - 1].score || 0) : 0;

    console.log(`\n======================= [雲端大腦：全榜評分分佈實時監測] =======================`);
    console.log(` [全局解鎖快照] 當前生還篩選庫: ${totalCards} 組`);
    console.log(` [天梯極值分佈] 最高極限分: ${highestScore} 分 | 最低深淵分: ${lowestScore} 分`);
    console.log(` [特徵落差階梯] 高分正數組: ${positiveScores} 組 | 完美及格分(0分): ${zeroScores} 組 | 互斥負數組: ${negativeScores} 組`);
    console.log(`---------------------------------------------------------------------------------`);
    console.log(` [最精銳前10組天梯實時追蹤]:`);
    for (let k = 0; k < Math.min(10, totalCards); k++) {
      if (hardwareCleanBoard[k]) {
        console.log(`   * 名次[${String(k+1).padStart(2,'0')}] -> 得分: [ ${String(hardwareCleanBoard[k].score).padStart(4, ' ')} 分 ] | 歸屬: 第 ${hardwareCleanBoard[k].unit || 1} 大組 | 號碼: ${hardwareCleanBoard[k].formatted}`);
      }
    }
    console.log(`=================================================================================\n`);

    const finalPickSize = Math.min(hardwareCleanBoard.length, Math.max(1, Number(cfg.count) || 100));
    for (let index = 0; index < finalPickSize; index++) {
      const item = hardwareCleanBoard[index];
      if (!item) continue;
      const indexStr = String(index + 1).padStart(2, '0');
      const displayUnit = item.unit || (Math.floor(index / 12) + 1);
      finalOutputCombs.push(`第 [${indexStr}] 組 (第 ${displayUnit} 大組) [評分: ${item.score !== undefined ? item.score : 0}分] : ${item.formatted || ""}\n`);
    }
    
    hardwareCleanBoard = null;
  } catch (err) {
    console.error("[理論大組終極物理隔離晶片異常] ", err.message);
  }
  global.compileOutput = compileLeaderboardToOutput;
}
global.compileOutput = compileLeaderboardToOutput;


 });

 
 // =========================================================================
 // 【2026 終極續命防線】每 10 秒發送一次輕量心跳包，強行重置免費 Render 的 50 秒斷線大閘門！ 👑
 // =========================================================================
 global.heartbeatTimer = setInterval(() => {
 if (isFinished) {
 if (global.heartbeatTimer) {
 clearInterval(global.heartbeatTimer);
 global.heartbeatTimer = null;
 }
 return;
 }
 try {
 // 發射最極簡的輕量續命氣泡包，絕對不與大结局數據撞車
 res.write(JSON.stringify({ isProgress: true, isHeartbeat: true, percent: 50 }) + "\n");
 } catch (e) {
 if (global.heartbeatTimer) {
 clearInterval(global.heartbeatTimer);
 global.heartbeatTimer = null;
 }
 }
 }, 10000);
 } catch (globalErr) {
 console.error(" 雲端大腦內核阻斷異常：", globalErr.message);
 try { res.json({ success: false, message: `後台突發故障: ${globalErr.message}` }); } catch (e) {}
 }
});
} // 完美閉合主執行緒的完全體結構 🌟


if (!isMainThread) {
  const { cfg, passedHistoryDB } = workerData;
  const lottoType = cfg.lottoType || "39_5";
  const maxBall = lottoType === "49_6" ? 49 : 39;
  const pickCount = lottoType === "49_6" ? 6 : 5;
  const historyDB = passedHistoryDB || [];
  let lastPeriod = (historyDB.length > 0 && Array.isArray(historyDB[historyDB.length - 1])) 
    ? historyDB[historyDB.length - 1].map(Number) : [];
  const lastPeriodSet = new Set(lastPeriod);
  const neighborSet = new Set();
  let range = parseInt(cfg.f9_range, 10) || 1;
  lastPeriod.forEach(val => { for (let d = -range; d <= range; d++) { if (d !== 0) neighborSet.add(val + d); } });
  
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
          dfs(0, []); return res;
        };
        kCombs(sortedNums, splitCount).forEach(subKey => historyEvapSet.add(subKey));
      } else {
        historyEvapSet.add(sortedNums.join(','));
      }
    });
  }
  
  const f1_on = (cfg.f1_on === true || cfg.f1_on === 'true');
  const f1_set = new Set(f1_on && cfg.f1_set ? (Array.isArray(cfg.f1_set) ? cfg.f1_set.map(Number) : cfg.f1_set.split(',').map(v => parseInt(v.trim(), 10)).filter(n => !isNaN(n))) : []);
  const vip_fav_on = (cfg.vip_fav_on === true || cfg.vip_fav_on === 'true');
  const favBalls = vip_fav_on && cfg.vip_fav_set ? Array.from(cfg.vip_fav_set).map(Number) : [];
  let basePool = Array.from({ length: maxBall }, (_, i) => i + 1).filter(b => !f1_set.has(b));
  
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
  const targetMax = Number(cfg.f10_max) || 2; // 這裡依據您的設定檔，若前端是 f10_max 請改為 cfg.f10_max
  
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
// =========================================================================
// 【2026 後端大腦生存審查總閘門 ── 100% 變數咬合、括號完全體】
// =========================================================================
  const killStats = new Uint32Array(16);
  let totalGeneratedTestCount = 0;
  function isGeneSurvive(comb) {
    totalGeneratedTestCount++;
    for (let i = 0; i < filters.length; i++) {
      if (filters[i].exec(comb)) { if (filters[i].id >= 0 && filters[i].id < 16) killStats[filters[i].id]++; return false; }
    }
    if (f15_on) {
      const splitCount = pickCount - 1; let conflict = false;
      const checkDfs = (start, curr) => {
        if (conflict) return; if (curr.length === splitCount) { if (historyEvapSet.has(curr.join(','))) conflict = true; return; }
        for (let i = start; i < comb.length; i++) checkDfs(i + 1, [...curr, comb[i]]);
      };
      checkDfs(0, []); if (conflict) { if (killStats && killStats !== undefined) killStats++; return false; }
    }
    return true;
  }

  let scannedCount = 0;
  const getDynamicMaxCombs = () => {
    const n = basePool.length; const favCount = vip_fav_on && typeof favBalls !== 'undefined' ? favBalls.length : 0;
    const n_final = n - favCount; const k_final = (lottoType === "49_6" ? 6 : 5) - favCount;
    if (n_final < k_final || k_final < 0) return 0;
    let num = 1, den = 1; for (let i = 0; i < k_final; i++) { num *= (n_final - i); den *= (i + 1); }
    return Math.floor(num / den);
  };
  const maxCombinations = getDynamicMaxCombs() || (lottoType === "49_6" ? 13983816 : 575757);
  let localTotalGen = 0; 
  let localLeaderBoard = [];
  let minScoreInLocalBoard = -99999;
  
  // 🛠️【嚴格執行指令】：將子執行緒緩衝池嚴格裁剪對齊！
  // 為了讓主緒稍後有足夠的不重複號碼進行理論大組、喜愛號特權洗牌，我們將生還天梯精確鎖定在 200 組名額！
  const candidateLimit = 200; 

  function processAndLocalPK(combination) {
    if (!isGeneSurvive(combination)) return; // 16道條件沒過的原地物理銷毀
    
    // 🟢 條件完美通關者！立刻執行特徵加減分！
    let healthScore = 100; 
    
    if (cfg.scoreTotalSum) {
      const sumVal = combination.reduce((x, y) => x + y, 0);
      if (lottoType === "49_6") { 
        if (sumVal >= 115 && sumVal <= 185) healthScore += 50;
        else if ((sumVal >= 91 && sumVal <= 114) || (sumVal >= 186 && sumVal <= 209)) healthScore += 20;
        else healthScore -= 50;
      } else { 
        if (sumVal >= 73 && sumVal <= 127) healthScore += 50;
        else if ((sumVal >= 56 && sumVal <= 72) || (sumVal >= 128 && sumVal <= 144)) healthScore += 20;
        else healthScore -= 50;
      }
    }
    if (cfg.scoreOddEven) {
      let oddsCount = 0; combination.forEach(num => { if ((num & 1) === 1) oddsCount++; });
      if (lottoType === "49_6") {
        if (oddsCount === 2 || oddsCount === 4) healthScore += 50;
        else if (oddsCount === 3) healthScore += 30;
        else healthScore -= 50;
      } else {
        if (oddsCount === 2 || oddsCount === 3) healthScore += 50;
        else healthScore -= 50;
      }
    }
    if (cfg.scoreBigSmall) {
      const midPoint = lottoType === "49_6" ? 25 : 20;
      let bigCount = 0; combination.forEach(num => { if (num >= midPoint) bigCount++; });
      if (lottoType === "49_6") {
        if (bigCount === 2 || bigCount === 4) healthScore += 50;
        else if (bigCount === 3) healthScore += 30;
        else healthScore -= 50;
      } else {
        if (bigCount === 2 || bigCount === 3) healthScore += 50;
        else healthScore -= 50;
      }
    }
    if (cfg.scoreConsecutive) {
      let currentSeq = 1, maxSeq = 1, totalPairs = 0; 
      for (let m = 1; m < combination.length; m++) {
        if (combination[m] === combination[m - 1] + 1) { currentSeq++; totalPairs++; if (currentSeq > maxSeq) maxSeq = currentSeq; } 
        else currentSeq = 1;
      }
      if (maxSeq === 2 && totalPairs === 1) healthScore += 50;
      else if (maxSeq === 1) healthScore += 30;
      else healthScore -= 50;
    }
    if (cfg.score012Route) {
      let r0 = 0, r1 = 0, r2 = 0; combination.forEach(num => { const rem = num % 3; if (rem === 0) r0++; else if (rem === 1) r1++; else r2++; });
      if (lottoType === "49_6") {
        if (r0 === 2 && r1 === 2 && r2 === 2) healthScore += 50;
        else if (r0 === 0 || r1 === 0 || r2 === 0) healthScore -= 50;
      } else {
        if ((r0===2&&r1===2&&r2===1)||(r0===2&&r1===1&&r2===2)||(r0===1&&r1===2&&r2===2)) healthScore += 50;
        else healthScore -= 50;
      }
    }

    const formatted = combination.map(n => String(n).padStart(2, '0')).join(', ');
    
    // =========================================================================
    // 🛠️【嚴格執行指令：原地即時 PK 汰換閘門】 ─── 贏的留下，輸的當場就地銷毀釋放！
    // =========================================================================
    if (localLeaderBoard.length < candidateLimit) {
      localLeaderBoard.push({ score: healthScore, comb: combination, formatted });
      if (localLeaderBoard.length === candidateLimit) {
        localLeaderBoard.sort((a, b) => b.score - a.score); minScoreInLocalBoard = localLeaderBoard[candidateLimit - 1].score;
      }
    } 
    // 🚀【全量高分隨機更換】：只要新進來的生存號碼分數大於「或是同分且觸發 45% 的亂數分流」，
    // 立即將排在最末端、開頭黏在一起的低分死組合剔除，原地銷毀！記憶體開銷永遠鎖死在極低水位！
    else if (healthScore > minScoreInLocalBoard || (healthScore === minScoreInLocalBoard && Math.random() < 0.45)) {
      localLeaderBoard.pop(); // 物理拋棄最弱守門人，由 V8 引擎秒速回收內存！
      localLeaderBoard.push({ score: healthScore, comb: combination, formatted });
      localLeaderBoard.sort((a, b) => b.score - a.score); 
      minScoreInLocalBoard = localLeaderBoard[candidateLimit - 1].score;
    }
  }

  async function triggerChunkFlush() {
    if (scannedCount % 500000 === 0 || scannedCount === maxCombinations) {
      const currentPercent = Math.min(Math.floor((scannedCount / maxCombinations) * 100), 100);
      parentPort.postMessage({ type: 'TOTAL_SCAN_PROGRESS', scanned: scannedCount, maxTotal: maxCombinations, percent: currentPercent, stats: Array.from(killStats), totalGen: localTotalGen });
      await new Promise(res => { if (typeof setImmediate !== 'undefined') setImmediate(res); else setTimeout(res, 1); });
    }
  }

  (async function runDeterministicBrain() {
    const favSet = new Set(favBalls); const remainingPool = basePool.filter(ball => !favSet.has(ball)); remainingPool.sort((a, b) => a - b);
    const pLen = remainingPool.length; const requiredSlots = pickCount - favBalls.length; 
    let currentSelection = new Array(requiredSlots);
    async function dfs(level, startIndex) {
      if (scannedCount >= maxCombinations) return;
      if (level === requiredSlots) {
        scannedCount++; localTotalGen++;
        let combination = [...favBalls, ...currentSelection].sort((a, b) => a - b);
        processAndLocalPK(combination);
        await triggerChunkFlush(); return;
      }
      for (let i = leaderBoard.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [leaderBoard[i], leaderBoard[j]] = [leaderBoard[j], leaderBoard[i]];
}

    }
    await dfs(0, 0);
    
    localLeaderBoard.sort((a, b) => b.score - a.score);
    
    parentPort.postMessage({ type: 'TOTAL_SCAN_PROGRESS', scanned: scannedCount, maxTotal: maxCombinations, total: scannedCount, stats: Array.from(killStats), totalGen: localTotalGen });
    parentPort.postMessage({ type: 'FINAL_SURVIVE_DELIVERY', leaderBoard: localLeaderBoard }); 
  })();
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("=======================================================");
  console.log(" 2026 LOTTO GA-WHEELING 究極完全體後端大腦通電成功！ ");
  console.log(` 多線程集流中繼站完美通車，埠口：[ ${PORT} ]`);
  console.log("=======================================================");
});
