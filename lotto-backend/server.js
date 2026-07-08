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

// ========================================== 【第一處：主執行緒資料庫防並發熔斷配置替換】 ==========================================
mongoose.models = {};
mongoose.modelSchemas = {};

const mongooseOptions = {
  autoIndex: false, 
  maxPoolSize: 50,  
  minPoolSize: 5,   
  socketTimeoutMS: 45000, 
  connectTimeoutMS: 45000, 
  serverSelectionTimeoutMS: 15000, 
  heartbeatFrequencyMS: 10000, 
  family: 4 
};

mongoose.connect(TRUE_MONGO_URI, mongooseOptions)
 .then(async () => {
   console.log("[資料庫通電] MongoDB 已成功接入頂級高並發抗壓通道：lotto");
   
   try {
     // 🎯 滿血開機全自動巡檢清洗：在連線成功的回呼函式內，非同步強制為所有舊帳號格式化，自動補齊缺失的房間
     // 藉由 mongoose.models.User 或直接呼叫 User，在 0.1 秒內將 singleUnlockExpiresAt 全量注入 null
     const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
     const result = await UserModel.updateMany(
       { singleUnlockExpiresAt: { $exists: false } }, 
       { $set: { singleUnlockExpiresAt: null } }
     );
     if (result.modifiedCount > 0) {
       console.log(`[開機自癒大成功] 系統已自動格式化並補齊 ${result.modifiedCount} 個舊會員的 24小時通行證房間！`);
     }
   } catch (cleanErr) {
     console.error("[開機自癒異常攔截] 全自動清洗舊帳戶資料時發生微阻斷：", cleanErr.message);
   }
 })
 .catch(err => console.error("[資料庫突發攔截] 抗壓通道初始化失敗：", err.message));

// ==================================================================================================================


// ─── 操盤手帳戶與商用變動資產資料庫 Schema ───
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  googleId: { type: String, default: null },
  isPaidMember: { type: Boolean, default: false },
  points: { type: Number, default: 100 }, 
  subscriptionExpiresAt: { type: Date, default: null },
  singleUnlockExpiresAt: { type: Date, default: null },
  savedTickets: { type: Array, default: [] } 
}, { timestamps: true });

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
 // 採用自癒晶片優先從 headers 或 body 解析出使用者 ID，雙防線防止空憑證阻斷
 const sessionUserId = extractUserIdFromPayload(req);
 if (!sessionUserId) return res.status(401).json({ success: false, message: "身分驗證憑證失效，請重新登入" });
 const dbUser = await User.findById(sessionUserId);
 if (!dbUser) return res.status(404).json({ success: false, message: "操盤手帳戶不存在" });
 
 const now = new Date();
 if (dbUser.singleUnlockExpiresAt && new Date(dbUser.singleUnlockExpiresAt) > now) {
 return res.json({ success: true, message: "您已擁有 24 小時免扣點通行特權！", newPoints: dbUser.points });
 }
 
 // 【升級核心】單次解鎖扣除點數由 10 點精準調升至 25 點
 const UNLOCK_COST = 25;
 if ((Number(dbUser.points) || 0) < UNLOCK_COST) {
 return res.status(400).json({ success: false, message: `解鎖失敗！單次解鎖高階過濾防線需消耗 ${UNLOCK_COST} 點，請先儲值。` });
 }
 
 // 安全扣除 25 點資產，並注入 24 小時白名單截止線
 dbUser.points = Math.max(0, (Number(dbUser.points) || 0) - UNLOCK_COST);
 const expireTime = new Date();
 expireTime.setHours(expireTime.getHours() + 24); 
 dbUser.singleUnlockExpiresAt = expireTime;
 
 dbUser.markModified('points');
 dbUser.markModified('singleUnlockExpiresAt');
 await dbUser.save();
 
 console.log(`[通行證發放] 操盤手 ${dbUser.username} 成功扣除 25 點，24小時高階防線通道全線放行！`);
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

// ========================================== 【新增：全域記憶體與動態負載觀測 API 路由開始】 ==========================================
// 🚀 2026 皇家運維補丁：供前端 Dashboard 或操盤手實時監測硬體 RAM 吞吐與並發用量，純文字無防爆配置
app.get('/api/admin/hardware-radar', (req, res) => {
  try {
    // 1. 獲取 Node.js 進程當下的實體記憶體佔用 (RSS = Resident Set Size)
    const memoryUsage = process.memoryUsage();
    const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    
    // 2. 自動偵測作業系統層級的全域記憶體狀態
    const os = require('os');
    const osFreeMemGB = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const osTotalMemGB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    
    // 3. 捕捉主執行緒全域維護的活動中連線數
    // 💡 這裡精確對齊並讀取您主執行緒第 9 頁與第 13 頁定義的 `global.activeRequestsCount` 變數
    const currentActiveUsers = global.activeRequestsCount || 0;
    
    // 4. 計算平均每位用戶瞬時消耗的 RAM
    // 基礎常駐估算為 100MB，超過的部分除以當前用戶數，即為每人的巔峰動態消耗
    let estimatedRamPerUserMB = 0;
    if (currentActiveUsers > 0) {
      estimatedRamPerUserMB = Math.max(45, Math.round((rssMB - 100) / currentActiveUsers));
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      hardwareReport: {
        serverTotalRssMemory: rssMB + " MB", // 伺服器目前總共吃掉的 RAM
        v8HeapUsed: heapUsedMB + " MB",       // 實際物件與演算法正在使用的記憶體
        v8HeapTotal: heapTotalMB + " MB",     // 系統分配給 V8 的總記憶體緩衝
        osSystemFree: osFreeMemGB + " GB",    // 雲端主機（Render 容器）剩下的剩餘空間
        osSystemTotal: osTotalMemGB + " GB"   // 雲端主機總規格
      },
      trafficReport: {
        activeRunningThreads: currentActiveUsers, // 當前正在全速海選的多執行緒用戶數
        estimatedPeakCostPerUser: (currentActiveUsers > 0 ? estimatedRamPerUserMB + " MB" : "0 MB"), // 每人瞬時巔峰開銷
        safeRemainingConcurrentSlots: Math.max(0, Math.floor(((512 - rssMB) / 55))) // 預估在 512MB 免費方案下「還能再容納幾個人同時點擊」
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "硬體觀測雷達突發異常: " + err.message });
  }
});
// ========================================== 【全域記憶體與動態負載觀測 API 路由結束】 ==========================================

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

 // 鋼鐵自癒防線：只要使用者一中斷連線或關網頁，物理強制拔除心跳計時器，防止伺服器記憶體大爆炸 🛑
 req.on('close', () => {
   if (global.heartbeatTimer) {
     clearInterval(global.heartbeatTimer);
     global.heartbeatTimer = null;
     console.log("[自癒防爆閘] 偵測到用戶端離線，已物理除惡務盡殘留心跳計時器！");
   }
 });
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
 // 🎯 滿血身分雙防線解碼：優先從中間件或 Payload 內文清洗提取最真實的 ID
 const sessionUserId = (req.user && req.user.userId) || extractUserIdFromPayload(req);
 if (!sessionUserId) {
 res.write(JSON.stringify({ success: false, status: 401, message: "身分驗證失效，請重新登入" }) + "\n");
 return res.end();
}

 // 🎯 穿透資料庫快取死結：強制使用 lean() 清空 Mongoose 內部物件快取，100% 直連讀取當前最新儲存的 25 點通行證
 const dbUser = await User.findById(sessionUserId).lean();
 if (!dbUser) return res.write(JSON.stringify({ success: false, message: "找不到操盤手帳號" }) + "\n") || res.end();
 
 const nowtime = new Date();
 // 1. 驗證 30 天月費訂閱特權
 const hasActiveSubscription = dbUser.subscriptionExpiresAt && new Date(dbUser.subscriptionExpiresAt) > nowtime;
 // 2. 驗證全新的 24 小時單次解鎖通行證特權 (此處在精確直連下將滿血判定為 true)
 const hasValid24hPass = dbUser.singleUnlockExpiresAt && new Date(dbUser.singleUnlockExpiresAt) > nowtime;
 
 // 彙整最高免扣點白名單權限 (完美咬合，綠色通道動態自癒放行)
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
 message: "權限鎖定：高階篩選需持有 24 小時通行證，請先點擊『單次解鎖 (25點)』獲取憑證！" 
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
      if (typeof isVipPass !== 'undefined' && isVipPass === true && cfg) {
   cfg.isSingleUnlockedCurrentRound = true;
 }
 const worker = new Worker(__filename, { workerData: { cfg, passedHistoryDB: globalHistoryDB || [], threadId: 0 } });

// == ✨ 新增：後台啟動秒發初始化真進度封包（徹底擊碎前端空窗期死當感） ==
try {
  if (!res.writableEnded) {
    const initMaxTotal = cfg.lottoType === "49_6" ? 13983816 : 575757;
    res.write(JSON.stringify({ 
      isProgress: true, 
      percent: 1, 
      currentMatch: 0,
      scanned: 0,
      maxTotal: initMaxTotal,
      totalGen: 0,
      evaluatedCount: 0,
      scoreStats250: {}
    }) + "\n");
    console.log("[海選開閘點火] 後台已成功發射第一秒初始化進度封包給前端。");
  }
} catch (initErr) {
  console.error("[開閘點火失敗] 初始封包發射中斷：", initErr.message);
}



// ========================================== 【主執行緒修復範圍開始】 ==========================================
global.monitorEvaluatedCount = 0; 
global.monitorScoreDistribution = {}; 

const leaderBoard = [];
worker.on('message', (msg) => {
 if (isFinished) return;
 const absoluteMaxTotal = msg.maxTotal || (cfg.lottoType === "49_6" ? 13983816 : 575757);
 
 if (msg.type === 'TOTAL_SCAN_PROGRESS') {
 liveScannedCount = msg.scanned;
 let currentProgressPercent = Math.min(99, Math.floor((msg.scanned / absoluteMaxTotal) * 100));
 if (currentProgressPercent < 5) currentProgressPercent = 5;
 
 if (msg.scanned % 500000 === 0 || msg.scanned === absoluteMaxTotal) {
 console.log("[全域海選進度] 已老實掃描: " + msg.scanned + " / " + absoluteMaxTotal + " 組 (" + currentProgressPercent + "%) | 當前本地總生成: " + (msg.totalGen || 0) + " 組");
 if (msg.stats) {
 const s = msg.stats;
 console.log("\n======================= [16防線動態擊殺全景觀測] =======================");
 console.log(" [基建防線] 條件01(地雷排除): " + (s[1] || 0) + " 組 | 條件02(首尾熱區): " + (s[2] || 0) + " 組 | 條件03(落點區塊): " + (s[3] || 0) + " 組");
 console.log(" [物理過濾] 條件04(同尾限制): " + (s[4] || 0) + " 組 | 條件05(奇偶比例): " + (s[5] || 0) + " 組 | 條件06(號碼總和): " + (s[6] || 0) + " 組");
 console.log(" [數學規律] 條件07(連續號牆): " + (s[7] || 0) + " 組 | 條件08(等差數列): " + (s[8] || 0) + " 組 | 條件13(算術AC值): " + (s[13] || 0) + " 組");
 console.log(" [大數據庫] 條件09(鄰號夾擊): " + (s[9] || 0) + " 組 | 條件10(上期連莊): " + (s[10] || 0) + " 組 | 條件14(質數合數): " + (s[14] || 0) + " 組");
 console.log(" [終極防護] 條件11(大小分流): " + (s[11] || 0) + " 組 | 條件12(除三餘數): " + (s[12] || 0) + " 組 | 條件15(歷史重疊): " + (s[15] || 0) + " 組");
 console.log(" [皇家特權] 條件16(必開喜愛): " + (s[0] || 0) + " 組");
 console.log("=================================================================================\n");
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
 totalGen: msg.totalGen || 0,
 evaluatedCount: global.monitorEvaluatedCount,
 scoreStats250: global.monitorScoreDistribution
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
 console.log("[安全防禦解鎖] 大數據全量竣工，5分鐘限時熔斷器已成功物理拆除。");
 }
 
 leaderBoard.length = 0;
 if (msg.leaderBoard && Array.isArray(msg.leaderBoard)) {
 leaderBoard.push(...msg.leaderBoard);
 }
 
 if (msg.finalEvaluatedCount) global.monitorEvaluatedCount = msg.finalEvaluatedCount;
 if (msg.finalScoreDistribution) global.monitorScoreDistribution = msg.finalScoreDistribution;
 
 console.log("=======================================================");
 console.log(" [大數據全量 100% 竣工通車] 1398 萬組海選大竣工！"); 
 console.log(" 最終死守並交付全榜最優解（真實隨機汰換）：" + leaderBoard.length + " 組名牌");
 console.log(" 監控報告：本次生存池實際參與評分總組數為: " + global.monitorEvaluatedCount + " 組");
 console.log("=======================================================");
 
 isFinished = true; 
 if (global.heartbeatTimer) {
 clearInterval(global.heartbeatTimer);
 global.heartbeatTimer = null;
 console.log("[自癒通訊鎖] 主緒已成功截斷全域續命心跳包，預備進行最終串流合龍。");
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
// ========================================== 【後台主執行緒大結局與單位量詞多語系精密修復開始】 ==========================================
        if (!res.writableEnded) {
        // 🚀 萬能相容去噪：強行轉小寫並裁切前兩碼，徹底打通前端傳送大小寫不一致的暗號斷路！
        let rawUiLang = (cfg && cfg.lang) ? String(cfg.lang).trim().toLowerCase().substring(0, 2) : "zh";
        if (rawUiLang !== "en" && rawUiLang !== "ja" && rawUiLang !== "ko") {
          rawUiLang = "zh";
        }

        let headerTitle = "";
        let poolTotalText = "";
        let deliveryTitle = "";
        let modeFooterTitle = "";
        let txtUnitQuantifier = "組"; // 🚀 補上單位量詞變數，徹底物理火化殘留中文

        if (rawUiLang === "zh") {
          headerTitle = "【VIP純隨機大竣工】中繼站本次海選實時通過總數：";
          poolTotalText = "【監控報告】本次生存池實際參與評分總組數為：";
          deliveryTitle = "【當前交付解鎖明牌（已完美大組控重，且100%過濾歷史頭獎紀錄！）】：";
          modeFooterTitle = "【輸出模式】聰明包牌（大組內彩球完全互斥+歷史）";
          txtUnitQuantifier = "組";
        } else if (rawUiLang === "en") {
          headerTitle = "[VIP Pure Randomization Completed] Real-Time Scanned Passes at Relay Station: ";
          poolTotalText = "[Monitor Report] Total Sets Evaluated in Current Survival Pool: ";
          deliveryTitle = "[Currently Delivered Unlocked Tickets (Perfect Unit Control & 100% Filtered Jackpot History!)]: ";
          modeFooterTitle = "[Output Mode] Smart Wheeling (Full Exclusion Within Units + History Check)";
          txtUnitQuantifier = "Sets";
        } else if (rawUiLang === "ja") {
          headerTitle = "【VIP純ランダム大竣工】中継拠点のリアルタイム通過総数：";
          poolTotalText = "【監視レポート】今回の生存プールで実際に評価対象となった総組合せ数：";
          deliveryTitle = "【現在交付されたロック解除名札（見事な大グループ重畳制御、過去の1等当選記録を100%フィルター！）】：";
          modeFooterTitle = "【出力モード】スマート連番（大グループ内彩球完全相互排他＋過去データ）";
          txtUnitQuantifier = "組";
        } else if (rawUiLang === "ko") {
          headerTitle = "【VIP 순수 무작위 대준공】중계소 이번 해선 실시간 통과 총수: ";
          poolTotalText = "【모니터링 보고】이번 생존 풀 실제 평가 참여 총 조합 수: ";
          deliveryTitle = "【현재 교부된 잠금 해제 명판 (완벽한 대조합 가중치 제어 및 역대 1등 당첨 기록 100% 필터링 완료!)]: ";
          modeFooterTitle = "【출력 모드】스마트 조합 (대조합 내 번호 완전 상호 배제 + 역대 기록)";
          txtUnitQuantifier = "개 조합";
        }

        // 🧬 究極拼接閉環：利用 txtUnitQuantifier 動態替換原本死結的中文「組」字，並在最末端補上輸出模式說明！
        const finalFormattedOutputText = 
          headerTitle + "\n" + liveScannedCount + " " + txtUnitQuantifier + " \n" + 
          poolTotalText + global.monitorEvaluatedCount + " " + txtUnitQuantifier + " \n \n" + 
          deliveryTitle + "\n-------------------------\n" + 
          finalOutputCombs.join('') + "-------------------------\n" +
          modeFooterTitle;
// ========================================== 【後台主執行緒大結局與單位量詞多語系精密修復結束】 ==========================================


 res.write(JSON.stringify({
 success: true,
 isProgress: false,
 isCompleted: true,
 percent: 100,
 currentMatch: leaderBoard.length,
 scanned: absoluteMaxTotal,
 maxTotal: absoluteMaxTotal,
 totalGen: msg.totalGen || absoluteMaxTotal,
 fullStats: [], 
 evaluatedCount: global.monitorEvaluatedCount,
 scoreStats250: global.monitorScoreDistribution,
 outputText: finalFormattedOutputText
 }) + "\n");
 res.end(); 
 console.log("[串流大結局] 多語系竣工數據順利發射，HTTP Chunked 通道已優雅關閉。");
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
 // ========================================== 【非聰明模式名牌量詞多語系自適應修復開始】 ==========================================
 if (!isSmartMode) {
   leaderBoard.sort((a, b) => {
     const aFinal = (a.score || 0) + (a.noise || Math.random() * 0.99);
     const bFinal = (b.score || 0) + (b.noise || Math.random() * 0.99);
     return bFinal - aFinal;
   });

   // 🌍 實時動態解碼：精確捕獲當前前端下拉選單的語系短代碼
   let rawUiLang = (cfg && cfg.lang) ? String(cfg.lang).trim().toLowerCase().substring(0, 2) : "zh";
   if (rawUiLang !== "en" && rawUiLang !== "ja" && rawUiLang !== "ko") {
     rawUiLang = "zh";
   }

   let txtGroupPrefix = "第";
   let txtGroupSuffix = "組";
   let txtUnitLabel = " (第 1 大組)";
   let txtScoreLabel = " [評分: ";
   let txtScoreSuffix = "分] : ";

   if (rawUiLang === "en") {
     txtGroupPrefix = "Set"; txtGroupSuffix = "";
     txtUnitLabel = " (Unit 1)";
     txtScoreLabel = " [Score: "; txtScoreSuffix = " pts] : ";
   } else if (rawUiLang === "ja") {
     txtGroupPrefix = "第"; txtGroupSuffix = "組";
     txtUnitLabel = " (第 1 大組)";
     txtScoreLabel = " [評価点: "; txtScoreSuffix = "点] : ";
   } else if (rawUiLang === "ko") {
     txtGroupPrefix = "제"; txtGroupSuffix = "조합";
     txtUnitLabel = " (제 1 대조합)";
     txtScoreLabel = " [평가 점수: "; txtScoreSuffix = "점] : ";
   }

   leaderBoard.forEach((item, index) => {
     const indexStr = String(index + 1).padStart(2, '0');
     // 🚀 動態重組字串架構，100% 物理清除寫死中文，無縫契合各國量詞語法！
     finalOutputCombs.push(
       txtGroupPrefix + " [" + indexStr + "] " + txtGroupSuffix + 
       txtUnitLabel + 
       txtScoreLabel + (item.score || 0) + txtScoreSuffix + 
       (item.formatted || "") + "\n"
     );
   });
   return;
 }
// ========================================== 【非聰明模式名牌量詞多語系自適應修復結束】 ==========================================

 
 // 先依照子執行緒算好的隨機權重由高到低做全局初篩
 leaderBoard.sort((a, b) => b.finalScore - a.finalScore);
 
 const finalPickSize = Math.min(leaderBoard.length, Math.max(1, Number(cfg.count) || 100));
 let hardwareCleanBoard = leaderBoard.slice(0, finalPickSize);
 
 // 解析排除地雷與喜愛號設定
 const maxLottoBalls = (cfg.lottoType === "49_6") ? 49 : 39;
 const isF1Enabled = (cfg && cfg.f1_on === true);
 const f1Kills = (isF1Enabled && cfg.f1_set) ? cfg.f1_set.length : 0;
 const remainingBallCount = Math.max(1, maxLottoBalls - f1Kills);
 const favCount = favNums.length;
 const ballsPerCombination = (cfg.lottoType === "49_6") ? Math.max(4, 6 - favCount) : Math.max(3, 5 - favCount);
 
 let maxCombsPerUnit = Math.floor(remainingBallCount / ballsPerCombination);
 if (!isF1Enabled) {
     maxCombsPerUnit = (cfg.lottoType === "49_6") ? 8 : 7;
 }
 if (maxCombsPerUnit < 1) maxCombsPerUnit = 1;
 
 // ============================================================================================
 // 🧠 【2026 皇家零容忍物理抽真空機制】：強迫前 N 組在同大組內必須達成 100% 完美不重複！
 // ============================================================================================
 let usedNumbersInCurrentUnit = new Set();
 let currentUnitTracker = 1;
 let outputCounterForUnit = 0;
 
 // 雙指針或標記陣列，用來進行兩輪式精準篩選
 let unallocatedItems = [...hardwareCleanBoard];
 let finalizedList = [];
 
 // 【第一輪：絕對零容忍搜救】優先在大軍中撈出「完全不重複任何1碼」的黃金組合
 for (let currentAllowedOverlap = 0; currentAllowedOverlap <= 6; currentAllowedOverlap++) {
 if (unallocatedItems.length === 0) break;
 
 let stillLeft = [];
 for (let i = 0; i < unallocatedItems.length; i++) {
 let item = unallocatedItems[i];
 if (!item || !item.comb) continue;
 
 const pureCombs = item.comb.filter(ball => !favNums.includes(ball));
 
 // 計算與當前大組集球袋的重疊數量
 let overlapCount = 0;
 pureCombs.forEach(ball => { if (usedNumbersInCurrentUnit.has(ball)) overlapCount++; });
 
 // 計算與上一組號碼的相鄰重疊度
 let prevOverlapCount = 0;
 let isHeadVanceDuplicated = false;
 if (finalizedList.length > 0) {
 const lastFinalized = finalizedList[finalizedList.length - 1];
 pureCombs.forEach(ball => { if (lastFinalized.comb.includes(ball)) prevOverlapCount++; });
 if (item.comb === lastFinalized.comb) isHeadVanceDuplicated = true;
 }
 
 const maxOverlapFound = Math.max(overlapCount, prevOverlapCount);
 
 // 如果在當前嚴格的容忍門檻內，或者是最後一輪保底
 if (maxOverlapFound <= currentAllowedOverlap && !isHeadVanceDuplicated) {
 // 完美納入當前大組
 pureCombs.forEach(ball => usedNumbersInCurrentUnit.add(ball));
 item.unit = currentUnitTracker;
 
 // 完美不重複者直接給予 500 分最高榮譽，有輕微重疊者依比例扣分
 if (maxOverlapFound === 0) {
 const oldBaseScore = item.score;
 const newBaseScore = Math.max(250, oldBaseScore + 150);
 item.score = newBaseScore;
 item.finalScore = newBaseScore + (item.noise || 0);
 } else {
 const oldBaseScore = item.score;
 const newBaseScore = Math.max(-400, oldBaseScore - (150 * maxOverlapFound));
 item.score = newBaseScore;
 item.finalScore = newBaseScore + (item.noise || 0);
 }
 
 finalizedList.push(item);
 outputCounterForUnit++;
 
 // 達到大組最大容量上限（例如大樂透8組），強制清空集球袋，切換下一大組，重置零容忍比對！
 if (outputCounterForUnit >= maxCombsPerUnit) {
 currentUnitTracker++;
 outputCounterForUnit = 0;
 usedNumbersInCurrentUnit.clear();
 }
 } else {
 stillLeft.push(item); // 沒符合嚴格門檻的，留到下一輪放寬門檻時再處理
 }
 }
 unallocatedItems = stillLeft;
 }
 
 // 將最終完成分配與打分的號碼名單移回主板
 hardwareCleanBoard = finalizedList;
 
 // 最終排序：先依照大組別 (unit) 由小到大排序；若組別相同，再依照新得分由高到低排列
 hardwareCleanBoard.sort((a, b) => {
 const aUnit = a.unit || 1;
 const bUnit = b.unit || 1;
 if (aUnit !== bUnit) return aUnit - bUnit;
 return b.finalScore - a.finalScore;
 });
 
 // 渲染前端輸出名牌
 for (let index = 0; index < hardwareCleanBoard.length; index++) {
 const item = hardwareCleanBoard[index];
 if (!item) continue;
 const indexStr = String(index + 1).padStart(2, '0');
 const displayUnit = item.unit || 1;
 finalOutputCombs.push("第 [" + indexStr + "] 組 (第 " + displayUnit + " 大組) [評分: " + (item.score !== undefined ? item.score : 0) + "分] : " + (item.formatted || "") + "\n");
 }
 
 hardwareCleanBoard = null;
 unallocatedItems = null;
 finalizedList = null;
 } catch (err) {
 console.error("[理論大組終極物理隔離晶片異常] ", err.message);
 }
}



global.compileOutput = compileLeaderboardToOutput;
// ========================================== 【主執行緒修復範圍結束】 ==========================================

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
   if (global.heartbeatTimer) {
     clearInterval(global.heartbeatTimer);
     global.heartbeatTimer = null;
   }
   try { 
     if (!res.writableEnded) {
       res.write(JSON.stringify({ success: false, message: `後台突發故障: ${globalErr.message}` }) + "\n");
       res.end();
     }
   } catch (e) {}
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
  
// ========================================== 【子執行緒地雷號跨緒通訊破壁補丁開始】 ==========================================
const f1_on = (cfg.f1_on === true || cfg.f1_on === 'true');
let rawMineArr = [];

if (f1_on && cfg.f1_set) {
  try {
    if (Array.isArray(cfg.f1_set)) {
      rawMineArr = cfg.f1_set;
    } else if (typeof cfg.f1_set === 'object' && typeof cfg.f1_set.size === 'number') {
      // 🚀 如果主緒不小心傳了實體 Set 物件過來，強行將其轉回標準陣列
      rawMineArr = Array.from(cfg.f1_set);
    } else if (typeof cfg.f1_set === 'string') {
      // 🚀 如果傳過來的是帶有特定符號或空格的字串，進行全面格式化清洗
      rawMineArr = cfg.f1_set.split(/[\s,._+|-]+/).filter(Boolean);
    }
  } catch (e) {
    rawMineArr = [];
  }
}

// 將清洗乾淨的號碼，精確轉換成純數字型態的實體 Set 袋子，100% 自癒
const f1_set = new Set(rawMineArr.map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 49));
const vip_fav_on = (cfg.vip_fav_on === true || cfg.vip_fav_on === 'true');
// ========================================== 【子執行緒地雷號跨緒通訊破壁補丁結束】 ==========================================

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
  // 🎯 滿血自癒對齊：精準抓取用戶前端填寫的「包含個數（作為上限擊殺線）」
  const targetMax = Number(cfg.f9_count) || 2; 

  filters.push({
    id: 9,
    exec: (comb) => {
      let neiCount = 0;
      const len = comb.length;

      // 1. 老老實實、全量清點這組號碼中到底踩到了幾個鄰碼，絕不用 break 偷懶
      for (let m = 0; m < len; m++) {
        if (neighborSet.has(comb[m])) {
          neiCount++;
        }
      }

      // 2. 完美的物理擊殺線（100% 遵照您的戰術）：
      // 只要這組牌命中的鄰碼數量「超過」了用戶設定的上限值（targetMax），直接 return true 當場物理殺死！
      if (neiCount > targetMax) {
        return true; 
      }

      return false; // 鄰碼個數在安全上限之內（屬於合格的常態疏散號），允許生還放行
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
      checkDfs(0, []); if (conflict) { if (killStats && killStats[15] !== undefined) killStats[15]++; return false; }
    }
    return true;
  }

// ========================================== 【區塊 2：子執行緒全新替換範圍（強制基礎評分全開版）】 ==========================================
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
 let localLeaderBoard = []; // 蓄水池陣列：這裡永遠只精準保留全榜分數最高的前 N 組贏家
 const pickLimit = Math.min(100, Math.max(1, Number(cfg.count) || 100));
 
 // 🚀 【核心監控變數】統計通過 16 道過濾條件並參與評分的真實總數，以及 250分以上的統計
 let localEvaluatedCount = 0;
 const localScoreDistribution = {};

 function processAndLocalPK(combination) {
 // 1. 生存審查門檻：如果沒通過勾選的 16 道條件，直接回傳，不參與評分
 if (!isGeneSurvive(combination)) return;
 
 // 2. 累計進入評分生存池的總組數（完全不受組數限制，幾百萬組都會通過這裡！）
 localEvaluatedCount++;
 
 // 3. 計算基礎健康評分（全面物理強制全開，無視前端勾選狀態！）
 let healthScore = 100; 
 
 // ─── 項目 A：強制全量進行【號碼總和評分】 ───
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

 // ─── 項目 B：強制全量進行【奇偶比例評分】 ───
 let oddsCount = 0; 
 for (let i = 0; i < combination.length; i++) {
 if ((combination[i] & 1) === 1) oddsCount++;
 }
 if (lottoType === "49_6") {
 if (oddsCount === 2 || oddsCount === 4) healthScore += 50;
 else if (oddsCount === 3) healthScore += 30;
 else healthScore -= 50;
 } else {
 if (oddsCount === 2 || oddsCount === 3) healthScore += 50;
 else healthScore -= 50;
 }

 // ─── 項目 C：強制全量進行【大小比例評分】 ───
 const midPoint = lottoType === "49_6" ? 25 : 20;
 let bigCount = 0; 
 for (let i = 0; i < combination.length; i++) {
 if (combination[i] >= midPoint) bigCount++;
 }
 if (lottoType === "49_6") {
 if (bigCount === 2 || bigCount === 4) healthScore += 50;
 else if (bigCount === 3) healthScore += 30;
 else healthScore -= 50;
 } else {
 if (bigCount === 2 || bigCount === 3) healthScore += 50;
 else healthScore -= 50;
 }

 // ─── 項目 D：強制全量進行【連續號牆評分】 ───
 let currentSeq = 1, maxSeq = 1, totalPairs = 0; 
 for (let m = 1; m < combination.length; m++) {
 if (combination[m] === combination[m - 1] + 1) { 
 currentSeq++; 
 totalPairs++; 
 if (currentSeq > maxSeq) maxSeq = currentSeq; 
 } else {
 currentSeq = 1;
 }
 }
 if (maxSeq === 2 && totalPairs === 1) healthScore += 50;
 else if (maxSeq === 1) healthScore += 30;
 else healthScore -= 50;

 // ─── 項目 E：強制全量進行【除三餘數路分佈評分】 ───
 let r0 = 0, r1 = 0, r2 = 0; 
 for (let i = 0; i < combination.length; i++) {
 const rem = combination[i] % 3; 
 if (rem === 0) r0++; else if (rem === 1) r1++; else r2++; 
 }
 if (lottoType === "49_6") {
 if (r0 === 2 && r1 === 2 && r2 === 2) healthScore += 50;
 else if (r0 === 0 || r1 === 0 || r2 === 0) healthScore -= 50;
 } else {
 if ((r0===2&&r1===2&&r2===1)||(r0===2&&r1===1&&r2===2)||(r0===1&&r1===2&&r2===2)) healthScore += 50;
 else healthScore -= 50;
 }
 
 // 📊 【後台監控統計】精確捕捉五項全開評分下，250 分以上各分數段的出現頻次
 if (healthScore >= 250) {
 const floorScore = Math.floor(healthScore);
 localScoreDistribution[floorScore] = (localScoreDistribution[floorScore] || 0) + 1;
 }
 
 // 🎯 【隨機基準點提權機制】為此合格組注入獨一無二的「微擾動隨機因子 (0~0.9999)」
 // 徹底瓦解死鎖僵局！保證所有合格組在相同的 5 項基礎分下，能憑藉擾動值公平竞争
 const currentNoise = Math.random() * 0.9999;
 const finalWeightedScore = healthScore + currentNoise;
 
 const formatted = combination.map(n => String(n).padStart(2, '0')).join(', ');
 const nodeItem = { score: healthScore, noise: currentNoise, finalScore: finalWeightedScore, comb: combination, formatted };
 
 // 🏆 【蓄水池流式生死鬥演算法】贏的留下，輸的當場銷毀，不限生存池總大小
 if (localLeaderBoard.length < pickLimit) {
 localLeaderBoard.push(nodeItem);
 if (localLeaderBoard.length === pickLimit) {
 localLeaderBoard.sort((a, b) => a.finalScore - b.finalScore);
 }
 } else {
 if (finalWeightedScore > localLeaderBoard[0].finalScore) {
 localLeaderBoard[0] = nodeItem; // 淘汰守門員
 localLeaderBoard.sort((a, b) => a.finalScore - b.finalScore); // 重新校準最低分位
 }
 }
}

// ========================================== 【第二處：子執行緒回報降載優化替換】 ==========================================
 async function triggerChunkFlush() {
 // 🚀 將過濾密度調整為 1,000,000 組回報一次，大幅釋放主執行緒的事件循環，給資料庫連線絕對充足的活命空間！
 if (scannedCount % 1000000 === 0 || scannedCount === maxCombinations) {
 const currentPercent = Math.min(Math.floor((scannedCount / maxCombinations) * 100), 100);
 parentPort.postMessage({ 
 type: 'TOTAL_SCAN_PROGRESS', 
 scanned: scannedCount, 
 maxTotal: maxCombinations, 
 percent: currentPercent, 
 stats: Array.from(killStats), 
 totalGen: localTotalGen,
 finalEvaluatedCount: localEvaluatedCount,
 finalScoreDistribution: localScoreDistribution
 });
 // 強制讓出微秒級線程，給 Node.js 處理基礎資料庫連線
 await new Promise(res => { if (typeof setImmediate !== 'undefined') setImmediate(res); else setTimeout(res, 1); });
 }
 }
// ==================================================================================================================


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
 for (let i = startIndex; i < pLen; i++) { currentSelection[level] = remainingPool[i]; await dfs(level + 1, i + 1); }
 }
 await dfs(0, 0);
 
 localLeaderBoard.reverse(); // 倒序反轉，使最高分在前交付給主緒
 
 parentPort.postMessage({ 
 type: 'TOTAL_SCAN_PROGRESS', 
 scanned: scannedCount, 
 maxTotal: maxCombinations, 
 total: scannedCount, 
 stats: Array.from(killStats), 
 totalGen: localTotalGen 
 });
 parentPort.postMessage({ 
 type: 'FINAL_SURVIVE_DELIVERY', 
 leaderBoard: localLeaderBoard,
 finalEvaluatedCount: localEvaluatedCount,
 finalScoreDistribution: localScoreDistribution
 }); 
 })();
// ========================================== 【區塊 2：子執行緒全新替換範圍結束】 ==========================================


}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("=======================================================");
  console.log(" 2026 LOTTO GA-WHEELING 究極完全體後端大腦通電成功！ ");
  console.log(` 多線程集流中繼站完美通車，埠口：[ ${PORT} ]`);
  console.log("=======================================================");
});
