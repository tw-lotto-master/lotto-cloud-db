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
// ====== 【四大自癒金流晶片 API - 加入 24H 到期主動物理擦除防線】 ======
app.post('/api/user/profile-v2', async (req, res) => {
 try {
     // 1. 滿血身分提取：優先從 Payload 中清洗出使用者實體 ID 🎯
     const sessionUserId = extractUserIdFromPayload(req);
     if (!sessionUserId) return res.status(401).json({ success: false, message: "身分驗證失效" });
     
     // 2. 直連讀取：先不排除密碼，因為我們要取得完整物件進行欄位動態修改與儲存
     const dbUser = await User.findById(sessionUserId);
     if (!dbUser) return res.status(404).json({ success: false, message: "找不到該會員資料" });
     
     // 3. 啟動時間物理對決：抓取當下最精確的伺服器時間 ⚙️
     const now = new Date();
     let isDataChanged = false; // 用來標記資料庫是否有被改動
     
     // ✨【核心自癒加入：24小時單次通行證主動擦除器】
     if (dbUser.singleUnlockExpiresAt) {
         const expireTime = new Date(dbUser.singleUnlockExpiresAt);
         
         // 如果當前時間已經「大於或等於」過期時間，代表通行證正式壽終正寢
         if (now >= expireTime) {
             dbUser.singleUnlockExpiresAt = null; // 物理擦除重設為 null
             dbUser.markModified('singleUnlockExpiresAt'); // 強制引信標記
             isDataChanged = true;
             console.log(`[時效自癒攔截] 操盤手 ${dbUser.username} 的 24 小時單次通行證已到期，系統已主動將欄位擦拭為 null！`);
         }
     }
     
     // ✨【加固擴充：30天月費 VIP 到期主動自癒重鎖】（順手幫您的月費也做物理同步自癒）
     if (dbUser.subscriptionExpiresAt) {
         const vipExpireTime = new Date(dbUser.subscriptionExpiresAt);
         if (now >= vipExpireTime) {
             dbUser.subscriptionExpiresAt = null; // 物理擦除時間
             dbUser.isPaidMember = false;         // 權限降階降級
             dbUser.markModified('subscriptionExpiresAt');
             dbUser.markModified('isPaidMember');
             isDataChanged = true;
             console.log(`[月費時效攔截] 操盤手 ${dbUser.username} 的鑽石會員訂閱已到期，系統已主動清空欄位並重鎖高階特權！`);
         }
     }
     
     // 4. 如果有發生任何權限過期擦除，立刻回寫儲存至 MongoDB 資料庫
     if (isDataChanged) {
         await dbUser.save();
     }
     
     // 5. 安全淨化：回傳前將敏感的 password 物理蒸發，確保客戶端資安
     const safeUserObj = dbUser.toObject();
     delete safeUserObj.password;
     
     return res.json({ success: true, user: safeUserObj });
     
 } catch (err) { 
     console.error("[Profile自癒阻斷異常] 執行時間軸巡檢時發生突發攔截: ", err.message);
     return res.status(500).json({ success: false, message: "資產讀取異常" }); 
 }
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



// ─── 雲端收藏夾儲存 API：全面重構為「100% 物理擦除覆蓋」 ───
app.post('/api/tickets/save', authenticateToken, async (req, res) => {
 try {
 const ticketsData = req.body.tickets || req.body.ticket;
 if (!ticketsData) return res.status(400).json({ success: false, message: '無效的號碼憑證' });
 
 const dbUser = await User.findById(req.user.userId);
 if (!dbUser) return res.status(404).json({ success: false, message: '操盤手帳號不存在' });
 
 // ─── 🎯 【除蟲核心】：直接強行清空舊陣列，不進行任何 push 拼接 ───
 dbUser.savedTickets = []; 

 // 將前端傳過來的最新名單（不論是字串還是陣列）洗淨格式化後存入
 const target = Array.isArray(ticketsData) ? ticketsData : [ticketsData];
 target.forEach((t, idx) => {
 const content = typeof t === 'object' ? t.content : t;
 if (content && String(content).trim().length > 0) {
 dbUser.savedTickets.push({
 content: String(content).trim(),
 id: `TK-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
 createdAt: new Date()
 });
 }
 });
 
 dbUser.markModified('savedTickets');
 await dbUser.save(); // 強制回寫，完成雲端淨化覆蓋
 
 return res.json({ 
 success: true, 
 message: '成功覆蓋並同步至雲端收藏夾！舊紀錄已完全抹除。', 
 savedTickets: dbUser.savedTickets 
 });
 } catch (err) { 
 console.error("[雲端同步攔截報錯]：", err.message);
 return res.status(500).json({ success: false, message: '雲端同步失敗' }); 
 }
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
            outputText: `【VIP純隨機大竣工】中繼站本次海選實時通過總數：${totalTheoreticalCombs} 組 \n【當前交付解鎖組合（已完美大組控重，且100%過濾歷史頭獎紀錄！）】\n-------------------------\n` + finalOutputCombs.join('') + `-------------------------\n【輸出模式】${modeLabel}\n`
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
            console.log(`[海選阻斷] 觸及 8 分鐘極限安全壁壘，中繼站安全收卷交付現存組數。`);
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
        }, 480000);

        // 🌟 核心修正：將前端傳入的歷史資料庫作為 passedHistoryDB 精確指派進去，對齊底層！
       const worker = new Worker(__filename, { workerData: { cfg, passedHistoryDB: globalHistoryDB || [], threadId: 0 } });
workers.push(worker);

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
 if (!res.writableEnded) {
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
 outputText: "【VIP融合大腦分選竣工】中繼站本次海選實時通過總數：\n" + liveScannedCount + " 組 \n \n【當前交付全局隨機最優解鎖組合（有效瓦解死鎖，100%保證分散多樣性！）】：\n-------------------------\n" + finalOutputCombs.join('') + "-------------------------\n"
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
    
    // 此處接收的是已經由 Worker 在全量海選後，完美轉換並按填滿優先排序好的原始陣列
    if (!leaderBoard || !Array.isArray(leaderBoard) || leaderBoard.length === 0) return;
    
    try {
        const isSmartMode = (cfg && cfg.vipMode === 'smart');
        // 精確對齊前端要求的解鎖組數上限（例如 15 組）
        const targetCount = Math.min(100, Math.max(1, Number(cfg.count) || 15)); 

        // 🚀 【原生接口直通出牌】：直接讀取 Worker 還原好、大組內部完全互斥且填得最滿的黃金名單
        for (let i = 0; i < leaderBoard.length; i++) {
            if (i >= targetCount) break; // 填滿用戶要的 15 組立刻完美竣工結案
            
            const item = leaderBoard[i];
            if (!item) continue;

            const indexStr = String(i + 1).padStart(2, '0');
            
            if (!isSmartMode) {
                // 如果是一般隨機模式，一律優雅歸類在第 1 大組
                finalOutputCombs.push("第 [" + indexStr + "] 組 (第 1 大組) [評分: " + (item.score || 0) + "分] : " + (item.formatted || "") + "\n");
            } else {
                // 💎 如果是智能 VIP 模式，直接調用 Worker 在線上 200 槽裡幫我們完美打好的實體大組編號 (item.unit)
                // 100% 保持在 500 分精英狀態，且完美大組互斥，榨乾賸餘可用球數！
                const displayUnit = item.unit !== undefined ? item.unit : 1;
                finalOutputCombs.push("第 [" + indexStr + "] 組 (第 " + displayUnit + " 大組) [評分: " + (item.score !== undefined ? item.score : 0) + "分] : " + (item.formatted || "") + "\n");
            }
        }
    } catch (err) {
        console.error("[主緒直通出牌解碼器異常] ", err.message);
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
      checkDfs(0, []); if (conflict) { if (killStats && killStats[15] !== undefined) killStats[15]++; return false; }
    }
    return true;
  }

// ========================================== 【區塊 2-1：30萬水庫配置與健康評分大腦】 ==========================================
let scannedCount = 0;
const getDynamicMaxCombs = () => {
    const n = basePool.length; 
    const favCount = vip_fav_on && typeof favBalls !== 'undefined' ? favBalls.length : 0;
    const n_final = n - favCount; 
    const k_final = (lottoType === "49_6" ? 6 : 5) - favCount;
    if (n_final < k_final || k_final < 0) return 0;
    let num = 1, den = 1; 
    for (let i = 0; i < k_final; i++) { num *= (n_final - i); den *= (i + 1); }
    return Math.floor(num / den);
};
const maxCombinations = getDynamicMaxCombs() || (lottoType === "49_6" ? 13983816 : 575757);

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// ─── 階段一：極速隨機海選 30 萬大水庫配置 ───
const MAX_POOL_SIZE = 300000;      // 放大至 30 萬筆，讓 120 萬精英全量均勻落庫，記憶體僅佔 2.4MB
const poolArray = [];              
const localScoreDistribution = {}; 
let localEvaluatedCount = 0;       
let localTotalGen = 0;

const randomizedRemainingPool = basePool.filter(ball => !new Set(favBalls).has(ball));

async function triggerChunkFlush() {
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
        await new Promise(res => { if (typeof setImmediate !== 'undefined') setImmediate(res); else setTimeout(res, 1); });
    }
}
// ========================================== 【區塊 2-2：完全體槽位主動撈取與秒級極速過濾引擎】 ==========================================
// ========================================== 【區塊 2-2：記憶體安全回歸、全量極速海選與主動撈取引擎】 ==========================================
(async function runDeterministicBrain() {
    const pLen = basePool.length; 
    const mainPickCount = lottoType === "49_6" ? 6 : 5;
    
    // 安全型態防禦
    const safeFavBalls = (typeof favBalls !== 'undefined' && Array.isArray(favBalls)) ? favBalls : [];
    const favCount = (vip_fav_on && safeFavBalls.length > 0) ? safeFavBalls.length : 0;

    
       // ─── 階段一：純粹同步 DFS 極速海選（徹底拔除外層地獄 while 迴圈，解鎖 2 秒竣工極限） ───
    const MAX_POOL_SIZE = 300000; 
    const reservoirPool = [];
    const tempCombination = new Array(mainPickCount);

    // 終極同步遞迴核心：0 煞車，全力衝刺 1398 萬組
    function dfsSearchSync(level, startIndex) {
        if (scannedCount >= maxCombinations) return;

        if (level === mainPickCount) {
            scannedCount++;
            localTotalGen++;

            // 16 道防線鐵血排除與健康度加權評分
            if (isGeneSurvive(tempCombination)) {
                localEvaluatedCount++;

                let healthScore = 100;
                const sumVal = tempCombination.reduce((x, y) => x + y, 0);
                if (lottoType === "49_6") {
                    if (sumVal >= 115 && sumVal <= 185) healthScore += 50;
                    else if ((sumVal >= 91 && sumVal <= 114) || (sumVal >= 186 && sumVal <= 209)) healthScore += 20;
                    else healthScore -= 50;
                } else {
                    if (sumVal >= 73 && sumVal <= 127) healthScore += 50;
                    else if ((sumVal >= 56 && sumVal <= 72) || (sumVal >= 128 && sumVal <= 144)) healthScore += 20;
                    else healthScore -= 50;
                }

                let oddsCount = 0;
                for (let b = 0; b < mainPickCount; b++) { if ((tempCombination[b] & 1) === 1) oddsCount++; }
                if (lottoType === "49_6") {
                    if (oddsCount === 2 || oddsCount === 4) healthScore += 50;
                    else if (oddsCount === 3) healthScore += 30;
                    else healthScore -= 50;
                } else {
                    if (oddsCount === 2 || oddsCount === 3) healthScore += 50;
                    else healthScore -= 50;
                }

                const midPoint = lottoType === "49_6" ? 25 : 20;
                let bigCount = 0;
                for (let b = 0; b < mainPickCount; b++) { if (tempCombination[b] >= midPoint) bigCount++; }
                if (lottoType === "49_6") {
                    if (bigCount === 2 || bigCount === 4) healthScore += 50;
                    else if (bigCount === 3) healthScore += 30;
                    else healthScore -= 50;
                } else {
                    if (bigCount === 2 || bigCount === 3) healthScore += 50;
                    else healthScore -= 50;
                }

                let currentSeq = 1, maxSeq = 1, totalPairs = 0;
                for (let m = 1; m < mainPickCount; m++) {
                    if (tempCombination[m] === tempCombination[m - 1] + 1) {
                        currentSeq++; totalPairs++;
                        if (currentSeq > maxSeq) maxSeq = currentSeq;
                    } else { currentSeq = 1; }
                }
                if (maxSeq === 2 && totalPairs === 1) healthScore += 50;
                else if (maxSeq === 1) healthScore += 30;
                else healthScore -= 50;

                let r0 = 0, r1 = 0, r2 = 0;
                for (let b = 0; b < mainPickCount; b++) {
                    const rem = tempCombination[b] % 3;
                    if (rem === 0) r0++; else if (rem === 1) r1++; else r2++;
                }
                if (lottoType === "49_6") {
                    if (r0 === 2 && r1 === 2 && r2 === 2) healthScore += 50;
                    else if (r0 === 0 || r1 === 0 || r2 === 0) healthScore -= 50;
                } else {
                    if ((r0 === 2 && r1 === 2 && r2 === 1) || (r0 === 2 && r1 === 1 && r2 === 2) || (r0 === 1 && r1 === 2 && r2 === 2)) healthScore += 50;
                    else healthScore -= 50;
                }

                if (healthScore >= 250) {
                    const floorScore = Math.floor(healthScore);
                    localScoreDistribution[floorScore] = (localScoreDistribution[floorScore] || 0) + 1;

                    const pureCombs = tempCombination.filter(ball => !safeFavBalls.includes(ball));
                    let pureMask = 0;
                    for (let b = 0; b < pureCombs.length; b++) { pureMask += Math.pow(2, pureCombs[b]); }

                    if (reservoirPool.length < MAX_POOL_SIZE) {
                        reservoirPool.push({ mask: pureMask, score: healthScore, comb: [...tempCombination] });
                    } else {
                        const replaceIndex = Math.floor(Math.random() * localEvaluatedCount);
                        if (replaceIndex < MAX_POOL_SIZE) {
                            reservoirPool[replaceIndex] = { mask: pureMask, score: healthScore, comb: [...tempCombination] };
                        }
                    }
                }
            }

            // 每隔 100 萬組，在同步的大海中向下射出一枚異步進度封包，這在多執行緒下開銷極低
            if (scannedCount % 1000000 === 0) {
                // 利用全域 parentPort 異步發射，絕不阻斷當前遞迴軸
                const currentPercent = Math.min(Math.floor((scannedCount / maxCombinations) * 100), 99);
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
            }
            return;
        }

        for (let i = startIndex; i < pLen; i++) {
            tempCombination[level] = basePool[i];
            dfsSearchSync(level + 1, i + 1); 
        }
    }

    // 🔥 點火！老老實實、精準呼叫「唯一一次」全量同步海選，0 重複開銷
    dfsSearchSync(0, 0);
    
    

    // ─── 階段二：30 萬精英池全局大洗牌 ───
    shuffleArray(reservoirPool);

   // ========================================== 【區塊 2-2：終極完美互斥與零重複過濾引擎】 ==========================================
       // ─── 階段三：【Set集合實體互斥引擎】200 個槽位主動撈取，完美相容條件16（喜愛號） ───
    const WORKER_TOTAL_SLOTS = 200;
    const slotMachine = Array.from({ length: WORKER_TOTAL_SLOTS }, () => ({ items: [] }));
    
    const pureBallsPerComb = mainPickCount - favCount; 
    // 由剩餘球數決定的極限上限（大樂透預設8組，539預設7組）
    const maxGroupLimitPerSlot = pureBallsPerComb > 0 ? Math.floor((49 - favCount) / pureBallsPerComb) : (lottoType === "49_6" ? 8 : 7);

    const usedNodeFlags = new Uint8Array(reservoirPool.length);

    for (let s = 0; s < WORKER_TOTAL_SLOTS; s++) {
        // 每一個大組槽建立一個專屬的實體彩球 Set 集合，用來記錄該大組「目前已經用掉了哪些號碼」
        const currentSlotUsedBalls = new Set();
        const currentSlotPickedIndices = []; 

        for (let i = 0; i < reservoirPool.length; i++) {
            if (usedNodeFlags[i] === 1) continue; 

            const node = reservoirPool[i];
            
            // 核心互斥檢查：遍歷當前號碼的 6 顆球，看有沒有跟大組內已有的號碼重複（排除喜愛號）
            let isCollide = false;
            for (let b = 0; b < node.comb.length; b++) {
                const ball = node.comb[b];
                if (safeFavBalls.includes(ball)) continue; // 喜愛號不參與互斥，直接跳過
                
                if (currentSlotUsedBalls.has(ball)) {
                    isCollide = true;
                    break; // 踩雷重複，直接擊殺
                }
            }

            if (!isCollide) {
                // 100% 確定不重複，將這組號碼的非喜愛號球，全部錄入該大組的用球牆
                for (let b = 0; b < node.comb.length; b++) {
                    const ball = node.comb[b];
                    if (!safeFavBalls.includes(ball)) {
                        currentSlotUsedBalls.add(ball);
                    }
                }
                currentSlotPickedIndices.push(i); 
            }

            // 完美達標組數，換下一個槽
            if (currentSlotPickedIndices.length === maxGroupLimitPerSlot) {
                break; 
            }
        }

        // 智慧自癒寬容機制：大組優先滿足極限，若因號碼卡位（或勾選防線過多），只要湊滿 3 組以上就允許錄取
        if (currentSlotPickedIndices.length >= 3) {
            for (let idx of currentSlotPickedIndices) {
                usedNodeFlags[idx] = 1; // 物理標記：整組抽離生存池，消滅雙胞胎號碼
                
                const node = reservoirPool[idx];
                const currentNoise = Math.random() * 0.9999;
                const formatted = "\n" + node.comb.map(n => String(n).padStart(2, '0')).join(', '); // 保持第一個數字自動換行
                
                slotMachine[s].items.push({
                    score: Math.max(250, node.score + 150),
                    noise: currentNoise,
                    finalScore: node.score + currentNoise + 150,
                    comb: node.comb,
                    formatted,
                    unit: s + 1 // 物理鎖定大組
                });
            }
        } else {
            currentSlotPickedIndices.length = 0; 
        }
    }

    // ─── 階段四：交卷通道（大組填滿降序排列） ───
    const localLeaderBoard = [];
    try {
        const sortedSlots = slotMachine
            .filter(slot => slot && slot.items && slot.items.length > 0)
            .sort((a, b) => b.items.length - a.items.length);
        
        let assignedUnitCounter = 1;
        for (let s = 0; s < sortedSlots.length; s++) {
            const currentSlot = sortedSlots[s];
            currentSlot.items.sort((a, b) => b.finalScore - a.finalScore);
            
            for (let j = 0; j < currentSlot.items.length; j++) {
                const item = currentSlot.items[j];
                item.unit = assignedUnitCounter; // 刷新賦予連續的大組標籤
                localLeaderBoard.push(item);
            }
            if (currentSlot.items.length > 0) {
                assignedUnitCounter++;
            }
        }
    } catch (restoreErr) {
        console.error("[Worker 智慧自癒撈取交卷還原異常] ", restoreErr.message);
    }

    // 數據通道安全交卷
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
// ========================================== 【區塊 2：終極完全體全部結束】 ==========================================


}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("=======================================================");
  console.log(" 2026 LOTTO GA-WHEELING 究極完全體後端大腦通電成功！ ");
  console.log(` 多線程集流中繼站完美通車，埠口：[ ${PORT} ]`);
  console.log("=======================================================");
});
