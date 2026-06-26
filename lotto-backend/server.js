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

// =========================================================================
// 【區塊 A：主線程中央中繼站調度核心（集流排重與金流特權閘）】
// =========================================================================
if (isMainThread) {
  app.post('/api/lottery/generate-vip-turbo', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const { cfg, globalHistoryDB } = req.body;
      if (!cfg) return res.write(JSON.stringify({ success: false, message: "參數配置遺失" }) + "\n") || res.end();

      // 1. 金流與雙保險特權驗證閘
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
        res.write(JSON.stringify({ isPointsUpdated: true, remainingPoints: dbUser.points, isPaidMember: true }) + "\n");
      }

      // 2. 開闢多通道並行中繼站（支持 4~8 執行緒，徹底利用 Render 多核效能）
      const limitOutput = Math.min(100, cfg.count || 5);
      const threadCount = 4; // 可依 Render 規格調整為 4 或 8
      const finalSurvivorSet = new Set();
      const finalResults = [];
      let isFinished = false;
      const workers = [];

      await new Promise((resolve) => {
        const safetyTimeout = setTimeout(() => {
          console.log(" ⚠️ [超時熔斷] 已達5秒，中繼站強制切斷發射。");
          isFinished = true;
          workers.forEach(w => w.terminate());
          resolve();
        }, 5000);

        for (let i = 0; i < threadCount; i++) {
          const worker = new Worker(__filename, { workerData: { cfg, globalHistoryDB, threadId: i } });
          
          // 🎯 核心落實：中繼站接收多組傳來的符合組，全域查重、滿足即斷流
          worker.on('message', (msg) => {
            if (isFinished) return;
            
            if (msg.type === 'FOUND_ONE') {
              const combString = msg.data.map(n => String(n).padStart(2, '0')).join(',');
              
              if (!finalSurvivorSet.has(combString)) { // 中繼站全域排重艙
                finalSurvivorSet.add(combString);
                finalResults.push(msg.data);
                
                const currentCount = finalResults.length;
                const chunkText = `第 [${String(currentCount).padStart(2, '0')}] 組 : ${msg.data.map(n => String(n).padStart(2, '0')).join(', ')}\n`;
                
                // 即時網路串流發射，號碼在畫面上一個個蹦出來
                res.write(JSON.stringify({ 
                  isProgress: true, 
                  percent: Math.min(99, Math.floor((currentCount / limitOutput) * 100)), 
                  currentMatch: currentCount, 
                  appendOutput: chunkText 
                }) + "\n");

                // 只要全域湊滿前端要的組數，立刻合流截斷輸出
                if (currentCount >= limitOutput) {
                  clearTimeout(safetyTimeout);
                  isFinished = true;
                  workers.forEach(w => w.terminate());
                  resolve();
                }
              }
            }
          });
          workers.push(worker);
        }
      });

      // 3. 0組隨機生還兜底與完美交卷
      let modeLabel = cfg.vipMode === 'smart' ? '聰明包牌 (Smart Wheeling + 遺傳變異)' : '一般篩選 (遺傳演算法 GA 全隨選)';
      res.write(JSON.stringify({
        success: true,
        outputText: `【VIP海選完成】中繼站累計成功捕獲：${finalResults.length} 組\n【輸出模式】${modeLabel}\n-------------------------\n`
      }) + "\n");
      res.end();

    } catch (globalErr) {
      console.error(" ❌ 雲端大腦內核阻斷異常：", globalErr.message);
      try { res.write(JSON.stringify({ success: false, message: `後台突發故障` }) + "\n"); res.end(); } catch(e){}
    }
  });
}
// =========================================================================
// 【區塊 B：子線程環境初始化與 15 大基因選擇篩選網格】
// =========================================================================
if (!isMainThread) {
  const { cfg, globalHistoryDB } = workerData;
  const lottoType = cfg.lottoType || "39_5";
  const maxBall = lottoType === "49_6" ? 49 : 39;
  const pickCount = lottoType === "49_6" ? 6 : 5;

  // 歷史開獎快取 Set 化 
  const historyCacheSet = new Set();
  const historyDB = globalHistoryDB || [];
  if (Array.isArray(historyDB) && historyDB.length > 0) {
    historyDB.forEach(h => {
      if (h) {
        const arr = Array.isArray(h) ? h : String(h).split(',');
        if (arr.length >= pickCount) historyCacheSet.add(arr.slice(0, pickCount).map(n => String(n).padStart(2,'0')).sort().join(','));
      }
    });
  }

  let lastPeriod = [];
  const neighborSet = new Set();
  if (historyDB && historyDB.length > 0) {
    lastPeriod = historyDB[historyDB.length - 1].map(Number);
    let range = parseInt(cfg.f9_range, 10) || 1;
    lastPeriod.forEach(val => {
      for (let d = -range; d <= range; d++) { if (d !== 0) neighborSet.add(val + d); }
    });
  }

  const f1_set = new Set(cfg.f1_set || []);
  const vipFavSet = new Set(cfg.vip_fav_set || []);

  // 遺傳生存選擇：15大核心防線
  function isGeneSurvive(comb) {
    const sumValue = comb.reduce((a, b) => a + b, 0);
    if (cfg.f1_on && f1_set.size > 0) { for (let mine of f1_set) { if (comb.includes(mine)) return false; } }
    if (cfg.f2_on) {
      let f2_min = Number(cfg.f2_min) || 15; let f2_max = Number(cfg.f2_max) || 30;
      if (Number(comb) >= f2_min || Number(comb[comb.length - 1]) <= f2_max) return false;
    }
    if (historyCacheSet.size > 0 && historyCacheSet.has(comb.map(n => String(n).padStart(2, '0')).join(','))) return false;
    if (cfg.f3_on) {
      let zoneSet = new Set(); let divisor = lottoType === "49_6" ? 10 : 8;
      comb.forEach(num => zoneSet.add(Math.min(5, Math.ceil(num / divisor))));
      if (zoneSet.size !== (Number(cfg.f3_count) || 4)) return false;
    }
    if (cfg.f4_on) {
      let tails = new Array(10).fill(0); comb.forEach(num => tails[num % 10]++);
      if (Math.max(...tails) > (Number(cfg.f4_max) || 2)) return false;
    }
    if (cfg.f5_on) {
      let odds = comb.filter(n => n % 2 !== 0).length; let evens = pickCount - odds;
      if (lottoType === "49_6") {
        if (cfg.f5_lotto_60 && (odds === 6 || evens === 6)) return false;
        if (cfg.f5_lotto_51 && (odds === 5 || evens === 5)) return false;
      } else {
        if (cfg.f5_539_50 && (odds === 5 || evens === 5)) return false;
        if (cfg.f5_539_41 && (odds === 4 || evens === 4)) return false;
      }
    }
    if (cfg.f6_on && (sumValue < (Number(cfg.f6_low) || 110) || sumValue > (Number(cfg.f6_high) || 210))) return false;
    if (cfg.f7_on) {
      let maxSeq = 1, currentSeq = 1;
      for (let m = 1; m < comb.length; m++) {
        if (comb[m] === comb[m-1] + 1) { currentSeq++; if (currentSeq > maxSeq) maxSeq = currentSeq; } else { currentSeq = 1; }
      }
      if (maxSeq >= (Number(cfg.f7_len) || 3)) return false;
    }
    if (cfg.f8_on) { // 🎯 補齊缺失條件 08：等差封鎖牆
      let isArithmetic = false;
      for (let i = 0; i <= comb.length - 3; i++) {
        let diff1 = comb[i+1] - comb[i]; let diff2 = comb[i+2] - comb[i+1];
        if (diff1 === diff2 && diff1 >= 1 && diff1 <= 24) { isArithmetic = true; break; }
      }
      if (isArithmetic) return false;
    }
    if (cfg.f9_on && neighborSet.size > 0 && comb.filter(num => neighborSet.has(num)).length > (Number(cfg.f9_count) || 2)) return false;
    if (cfg.f10_on && lastPeriod.length > 0 && comb.filter(num => lastPeriod.includes(num)).length > (Number(cfg.f10_max) || 2)) return false;
    if (cfg.f11_on) {
      let midPoint = lottoType === "49_6" ? 25 : 20; let bigCount = comb.filter(num => num >= midPoint).length; let smallCount = pickCount - bigCount;
      if (cfg.f11_kill && (bigCount === pickCount || smallCount === pickCount || bigCount === 1 || smallCount === 1)) return false;
    }
    if (cfg.f12_on) {
      let road0 = 0, road1 = 0, road2 = 0; comb.forEach(num => { let rem = num % 3; if (rem === 0) road0++; else if (rem === 1) road1++; else road2++; });
      if (cfg.f12_kill && (road0 === 0 || road1 === 0 || road2 === 0)) return false;
    }
    if (cfg.f13_on) {
      let diffs = new Set();
      for (let m = 0; m < comb.length; m++) { for (let n = m + 1; n < comb.length; n++) diffs.add(comb[n] - comb[m]); }
      if (diffs.size - (pickCount - 1) < (Number(cfg.f13_min) || 6)) return false;
    }
    if (cfg.f14_on) {
      const primes =;
      if (cfg.f14_kill && comb.filter(num => primes.includes(num)).length >= 4) return false;
    }
    if (cfg.f15_on) {
      const overlapLimit = lottoType === '49_6' ? 5 : 4;
      for (let h of historyDB) { if (comb.filter(num => h.includes(num)).length >= overlapLimit) return false; }
    }
    return true;
  }
  // =========================================================================
  // 【區塊 C：雙軌制引擎落地（一般篩選 GA vs. 聰明包牌 Smart Wheeling）】
  // =========================================================================
  const vipMode = cfg.vipMode || 'smart';

  // 建立剔除地雷號後的「純淨可用球池」
  const baseBallPool = Array.from({ length: maxBall }, (_, i) => i + 1)
    .filter(n => !f1_set.has(n));

  // 軌道二：【聰明包牌模式 (Smart Wheeling Systems + GA)】
  if (cfg.mode === 'smart' || vipMode === 'smart') {
    // 剔除地雷與喜愛號，找出純粹用來互斥的補位球 pool
    let remainingBalls = [...baseBallPool].filter(ball => !vipFavSet.has(ball));
    
    // 完美的 Fisher-Yates 隨機洗牌，打破剩餘球的順序規律 🎲
    for (let i = remainingBalls.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remainingBalls[i], remainingBalls[j]] = [remainingBalls[j], remainingBalls[i]];
    }

    const availableSlotsPerGroup = pickCount - vipFavSet.size; // 每組還剩幾個缺口
    
    // 💡 核心落實：依據剩餘號碼數，動態除以每組容量，自動決定生成 1-8 組不重複骨架
    if (availableSlotsPerGroup > 0 && remainingBalls.length >= availableSlotsPerGroup) {
      const maxGroups = Math.floor(remainingBalls.length / availableSlotsPerGroup);
      
      for (let g = 0; g < maxGroups; g++) {
        let singleGroup = [...Array.from(vipFavSet)]; // 強制注入喜愛號特權 👑
        const slots = remainingBalls.slice(g * availableSlotsPerGroup, (g + 1) * availableSlotsPerGroup); // 貪婪切割互斥號碼
        singleGroup.push(...slots);
        singleGroup.sort((a, b) => a - b);

        // 骨架生成後，依然必須通過 GA 的 15 大生存條件檢驗（對齊 0-14 條件剔除）
        if (isGeneSurvive(singleGroup)) {
          parentPort.postMessage({ type: 'FOUND_ONE', data: singleGroup }); // 符合立刻交給中繼站
        }
      }
    }
  }

  // 軌道一：【一般篩選組合 (純隨機無規律遺傳變異 GA 引擎)】
  // 無論是軌道一，或是軌道二包牌後的無限突變生成，皆進入此全核心高頻隨機演化大循環
  while (true) {
    let pool = [...baseBallPool];
    
    // Fisher-Yates 全局基因亂數揉合
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    
    // 往滿足 1398 萬組/57 萬組的矩陣空間隨機提取單組基因型
    let combination = pool.slice(0, pickCount);
    
    // 如果一般模式有勾選喜愛號，同樣實施強制基因注入
    if (cfg.vip_fav_on && vipFavSet.size > 0) {
      combination = [...new Set([...Array.from(vipFavSet), ...combination])].slice(0, pickCount);
    }
    
    combination.sort((a, b) => a - b);
    
    // 進入環境選擇隔離艙 (0-15道防線)
    if (isGeneSurvive(combination)) {
      parentPort.postMessage({ type: 'FOUND_ONE', data: combination }); // 1組符合就上報給中央中繼站
    }
  }
}
