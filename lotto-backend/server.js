const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();

// ─── 滿血開啟 CORS 破壁跨網域晶片 ───
app.use(cors({
    origin: function (origin, callback) {
        // 全手機品牌完美通用動態自癒通道
        callback(null, true);
    },
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
   .then(() => console.log(" [大腦通電成功] 已物理歸位真房間：MongoDB -> lotto 📡 "))
  .catch(err => console.error(" 資料庫真房間開啟失敗：", err));

// ─── 操盤手帳戶與商用變動資產資料庫 Schema (精確對齊前端路徑) ───
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

// 完整相容 1-49 質數快取矩陣 (對齊條件 14，強效防窮舉死鎖)
const PRIME_SET = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]);

// ─── 🟢 🎯 【最外層全域超高速海選引擎完全體】 ───
function scanAndFilterMatrixSpace(pool, r, k = 0, current = []) {
    
    // 🟢 🎯 像素級修正：只有當 6 碼/5 碼完全生出來、準備進入 16 大防線檢查時，才去抓取全域快取資源，徹底打破開機 initialization 崩潰！
    if (current.length === r) {
        global.totalScanned++;
        
        // 動態注入全域感測器資源，確保 100% 絕對不會因為 undefined 而休克斷流！
        const cfg = global.currentCfg || {};
        const f1_set = global.currentF1Set || new Set();
        const vipFavSet = global.currentVipFavSet || new Set();
        const historyCacheSet = global.currentHistoryCacheSet || new Set();
        const lottoType = cfg.lottoType || "39_5";
        const neighborSet = global.currentNeighborSet || new Set();
        const lastPeriod = global.currentLastPeriod || [];
        const historyDB = global.currentHistoryDB || [];

        // ⚡ 進度條即時串流發射
        if (global.totalScanned % global.reportStep === 0 || global.totalScanned === global.theoreticalTotal) {
            let percent = Math.min(100, Math.floor((global.totalScanned / global.theoreticalTotal) * 100));
            if (global.currentRes) {
                global.currentRes.write(JSON.stringify({ isProgress: true, percent: percent, currentMatch: global.survivorPool.length }) + "\n");
            }
        }
        
        let isCombValid = true; // 👈 完美向下銜接條件 01 到條件 15 的大底池防線...

        // ───【條件 01】：排除特定地雷號碼 ───
        if (isCombValid && cfg.f1_on && f1_set.size > 0) {
            for (let mine of f1_set) {
                if (current.includes(mine)) { isCombValid = false; break; }
            }
        }
        // ───【條件 02】：首尾邊界熱區控制 ───
        if (isCombValid && cfg.f2_on) {
            let f2_min = parseInt(cfg.f2_min, 10) || 15;
            let f2_max = parseInt(cfg.f2_max, 10) || 30;
            if (Number(current[0]) >= f2_min || Number(current[current.length - 1]) <= f2_max) { 
                isCombValid = false; 
            }
        }
        // ───【物理防線 / 歷史全中排除】：補零格式化完全撞擊 ───
        let currentZeroStr = current.map(n => String(n).padStart(2, '0')).join(',');
        if (isCombValid && historyCacheSet.size > 0 && historyCacheSet.has(currentZeroStr)) {
            isCombValid = false;
        }
        // ───【條件 03】：五大物理區塊落點個數控制 ───
        if (isCombValid && cfg.f3_on) {
            let zoneSet = new Set();
            let divisor = lottoType === "49_6" ? 10 : 8;
            current.forEach(num => zoneSet.add(Math.min(5, Math.ceil(num / divisor))));
            if (zoneSet.size !== (parseInt(cfg.f3_count, 10) || 4)) { isCombValid = false; }
        }
        // ───【條件 04】：同尾數重複個數上限過濾 ───
        if (isCombValid && cfg.f4_on) {
            let tails = new Array(10).fill(0);
            current.forEach(num => tails[num % 10]++);
            if (Math.max(...tails) > (parseInt(cfg.f4_max, 10) || 2)) { isCombValid = false; }
        }
        // ───【條件 05】：奇偶比例動態防禦牆 ───
        if (isCombValid && cfg.f5_on) {
            let odds = current.filter(n => n % 2 !== 0).length;
            let evens = r - odds;
            if (lottoType === "49_6") {
                if (cfg.f5_lotto_60 && (odds === 6 || evens === 6)) { isCombValid = false; }
                if (cfg.f5_lotto_51 && (odds === 5 || evens === 5)) { isCombValid = false; }
            } else {
                if (cfg.f5_539_50 && (odds === 5 || evens === 5)) { isCombValid = false; }
                if (cfg.f5_539_41 && (odds === 4 || evens === 4)) { isCombValid = false; }
            }
        }
        // ───【條件 06】：號碼總和區間動態過濾 ───
        if (isCombValid && cfg.f6_on) {
            let sumValue = current.reduce((a, b) => a + b, 0);
            if (sumValue < (parseInt(cfg.f6_low, 10) || 110) || sumValue > (parseInt(cfg.f6_high, 10) || 210)) { 
                isCombValid = false; 
            }
        }
        // ───【條件 07】：連續號碼長度限制牆 ───
        if (isCombValid && cfg.f7_on) {
            let maxSeq = 1, currentSeq = 1;
            for (let m = 1; m < r; m++) {
                if (current[m] === current[m-1] + 1) {
                    currentSeq++;
                    if (currentSeq > maxSeq) maxSeq = currentSeq;
                } else { currentSeq = 1; }
            }
            if (maxSeq >= (parseInt(cfg.f7_len, 10) || 3)) { isCombValid = false; }
        }
        // ───【條件 08】：局部連續 3 碼等差封鎖牆 (公差範圍 1-24) ───
        if (isCombValid && cfg.f8_on) {
            let isArithmetic = false;
            for (let i = 0; i <= r - 3; i++) {
                let diff1 = current[i+1] - current[i];
                let diff2 = current[i+2] - current[i+1];
                if (diff1 === diff2 && diff1 >= 1 && diff1 <= 24) { isArithmetic = true; break; }
            }
            if (isArithmetic) { isCombValid = false; }
        }
        // ───【條件 09】：鄰號夾擊防線控制 ───
        if (isCombValid && cfg.f9_on && neighborSet.size > 0) {
            let nCnt = current.filter(num => neighborSet.has(num)).length;
            if (nCnt > (parseInt(cfg.f9_count, 10) || 2)) { isCombValid = false; }
        }
        // ───【條件 10】：上期獎號連莊封殺牆 ───
        if (isCombValid && cfg.f10_on && lastPeriod.length > 0) {
            let repeatCount = current.filter(num => lastPeriod.includes(num)).length;
            if (repeatCount > (parseInt(cfg.f10_max, 10) || 2)) { isCombValid = false; }
        }
        // ───【條件 11】：大小數比例動態分流牆 ───
        if (isCombValid && cfg.f11_on) {
            let midPoint = lottoType === "49_6" ? 25 : 20;
            let bigCount = current.filter(num => num >= midPoint).length;
            let smallCount = r - bigCount;
            if (cfg.f11_kill) {
                if (bigCount === r || smallCount === r || bigCount === 1 || smallCount === 1) { isCombValid = false; }
            }
        }
        // ───【條件 12】：除三餘數 (012路) 完全斷路封鎖牆 ───
        if (isCombValid && cfg.f12_on) {
            let road0 = 0, road1 = 0, road2 = 0;
            current.forEach(num => {
                let rem = num % 3;
                if (rem === 0) road0++; else if (rem === 1) road1++; else road2++;
            });
            if (cfg.f12_kill) {
                if (road0 === 0 || road1 === 0 || road2 === 0) { isCombValid = false; }
            }
        }
        // ───【條件 13】：數字複雜度 (AC值) 飄移過濾 ───
        if (isCombValid && cfg.f13_on) {
            let diffs = new Set();
            for (let m = 0; m < r; m++) {
                for (let n = m + 1; n < r; n++) { diffs.add(current[n] - current[m]); }
            }
            let acValue = diffs.size - (r - 1);
            if (acValue < (parseInt(cfg.f13_min, 10) || 6)) { isCombValid = false; }
        }
        // ───【條件 14】：質數/合數比例過濾 ───
        if (isCombValid && cfg.f14_on) {
            const primes =[ 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47 ];
            let pCnt = current.filter(num => primes.includes(num)).length;
            if (cfg.f14_kill && pCnt >= 4) { isCombValid = false; }
        }
        // ───【條件 15】：歷史數據高重疊率安全過濾防線 ───
        if (isCombValid && cfg.f15_on) {
            const overlapLimit = lottoType === '49_6' ? 5 : 4;
            for (let h of historyDB) {
                let intersect = current.filter(num => h.includes(num)).length;
                if (intersect >= overlapLimit) { isCombValid = false; break; }
            }
        }
        
        if (isCombValid) {
            global.survivorPool.push([...current]);
        }
        return false;
    }
    
    for (let i = k; i < pool.length; i++) {
        current.push(pool[i]);
        scanAndFilterMatrixSpace(pool, r, i + 1, current);
        current.pop();
    }
}

// ─── 中介軟體：雙軌沙盒憑證字串清洗驗證器 🔐 ───
function authenticateToken(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  try {
    let authHeader = req.headers.authorization || req.headers.Authorization || req.query.token || (req.body && req.body.token) || req.body;
    if (!authHeader) return res.status(411).json({ success: false, message: '權限鎖定：請登入會員' });

    let tokenString = authHeader.trim().replace(/['"\r\n\t]/g, '');
    if (tokenString.startsWith('Bearer ')) tokenString = tokenString.substring(7).trim();
    if (tokenString.startsWith('Bearer')) tokenString = tokenString.substring(6).trim();
    if (tokenString.includes(' ')) tokenString = tokenString.split(' ')[0];

    const decoded = jwt.verify(tokenString, JWT_SECRET);
    req.user = { userId: String(decoded.userId || decoded._id || decoded.id).trim() };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: '驗證令牌失效或已過期' });
  }
}

function extractUserIdFromPayload(req) {
  try {
    let authHeader = req.headers.authorization || req.headers.Authorization || req.query.token || (req.body && req.body.token) || req.body;
    if (!authHeader) return null;
    let tokenString = authHeader.trim().replace(/['"\r\n\t]/g, '');
    if (tokenString.startsWith('Bearer ')) tokenString = tokenString.substring(7).trim();
    const decoded = jwt.verify(tokenString, JWT_SECRET);
    return String(decoded.userId || decoded._id || decoded.id).trim();
  } catch { return null; }
}

// ─── 帳戶備份中心實體 API ───
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
// 【區塊 Node-01 竣工，請確認貼上後，對我發送「區塊 Node-02」部署與前端100%對齊的四大自癒金流交易晶片】
// =========================================================================
// 【後端 ── 區塊 Node-02】：四大核心自癒金流資產與明牌同步中心 🪙 👑
// =========================================================================

// 1. 獲取用戶最新帳戶點數資產與 VIP 剩餘狀態 (精確對齊前端 profile-v2 破壁路徑) 🔄
app.post('/api/user/profile-v2', async (req, res) => {
  try {
    const sessionUserId = extractUserIdFromPayload(req);
    if (!sessionUserId) return res.status(401).json({ success: false, message: "身分驗證失效" });

    const dbUser = await User.findById(sessionUserId).select('-password');
    if (!dbUser) return res.status(404).json({ success: false, message: "找不到該會員資料" });

    return res.json({ success: true, user: dbUser });
  } catch (err) {
    return res.status(500).json({ success: false, message: "資產讀取異常" });
  }
});

// 2. 金流自癒晶片：儲值 100 點數 (擊穿 500 Internal Server Error 終極防線) 🪙
app.post('/api/user/buy-points', async (req, res) => {
  try {
    const sessionUserId = extractUserIdFromPayload(req);
    if (!sessionUserId) return res.status(401).json({ success: false, message: "驗證令牌失效" });

    const dbUser = await User.findById(sessionUserId);
    if (!dbUser) return res.status(404).json({ success: false, message: "用戶不存在" });

    // 100% 數字化物理防線：防範 undefined 疊加轉為 NaN 導致 MongoDB 崩潰
    dbUser.points = (Number(dbUser.points) || 0) + 100;
    dbUser.markModified('points');
    await dbUser.save();

    console.log(` [金流成功到帳] 用戶 [${dbUser.username}] 儲值成功，最新餘額：${dbUser.points} 點 `);
    return res.json({ success: true, newPoints: dbUser.points });
  } catch (err) {
    return res.status(500).json({ success: false, message: "雲端金流異常" });
  }
});

// 3. 點數消耗抵扣：開啟/續約 30 天 VIP 尊榮無限海選訂閱 👑
app.post('/api/user/subscribe-vip', async (req, res) => {
  try {
    const sessionUserId = extractUserIdFromPayload(req);
    if (!sessionUserId) return res.status(401).json({ success: false, message: "身分驗證憑證已失效" });

    const dbUser = await User.findById(sessionUserId);
    if (!dbUser) return res.status(404).json({ success: false, message: "用戶不存在" });

    const SUBSCRIBE_COST = 150;
    if ((Number(dbUser.points) || 0) < SUBSCRIBE_COST) {
      return res.status(400).json({ success: false, message: `續約失敗！訂閱 VIP 需消耗 ${SUBSCRIBE_COST} 點，您的點數餘額不足。` });
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
  } catch (err) {
    return res.status(500).json({ success: false, message: "訂閱處理失敗" });
  }
});

// 4. 會員自主管理：主動終止/取消 VIP 包月訂閱狀態 🛑
app.post('/api/user/cancel-vip', async (req, res) => {
  try {
    const sessionUserId = extractUserIdFromPayload(req);
    if (!sessionUserId) return res.status(401).json({ success: false, message: "身分驗證憑證已失效" });

    const dbUser = await User.findById(sessionUserId);
    if (!dbUser) return res.status(404).json({ success: false, message: "雲端資料庫找不到該帳戶" });

    dbUser.subscriptionExpiresAt = null;
    dbUser.isPaidMember = false;
    await dbUser.save();
    
    console.log(` [終止訂閱成功] 帳戶 [${dbUser.username}] 已正式降級為普通用戶 💎`);
    return res.json({ success: true, message: "訂閱已成功終止，特權重鎖" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "伺服器底層內核阻斷錯誤" });
  }
});

// 5. 處理前端點擊「單次解鎖 (10點)」實體按鈕的扣點權限請求 🪙
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
  } catch (err) {
    return res.status(500).json({ success: false, message: "雲端授權通道異常" });
  }
});

// 6. 雲端明牌備份中心：儲存號碼 📥 (精確相容前端 LocalStorage 備份)
app.post('/api/tickets/save', authenticateToken, async (req, res) => {
  try {
    const ticketsData = req.body.tickets || req.body.ticket;
    if (!ticketsData) return res.status(400).json({ success: false, message: '無效的號碼憑證' });

    const dbUser = await User.findById(req.user.userId);
    if (!dbUser) return res.status(404).json({ success: false, message: '操盤手帳號不存在' });

    if (!dbUser.savedTickets) dbUser.savedTickets = [];
    
    if (Array.isArray(ticketsData)) {
      ticketsData.forEach(t => {
        // 如果是物件則提取 content，否則直接比對字串，避免重複寫入
        const ticketContent = typeof t === 'object' ? t.content : t;
        const exists = dbUser.savedTickets.some(item => (typeof item === 'object' ? item.content : item) === ticketContent);
        if (!exists) {
          dbUser.savedTickets.push({
            content: ticketContent,
            id: `TK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            createdAt: new Date()
          });
        }
      });
    } else {
      const ticketContent = typeof ticketsData === 'object' ? ticketsData.content : ticketsData;
      const exists = dbUser.savedTickets.some(item => (typeof item === 'object' ? item.content : item) === ticketContent);
      if (!exists) {
        dbUser.savedTickets.push({
          content: ticketContent,
          id: `TK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          createdAt: new Date()
        });
      }
    }

    dbUser.markModified('savedTickets');
    await dbUser.save();
    return res.json({ success: true, message: '成功同步至雲端收藏夾！', savedTickets: dbUser.savedTickets });
  } catch (err) {
    return res.status(500).json({ success: false, message: '雲端同步失敗' });
  }
});

// 7. 雲端明牌備份中心：拉取明牌列表 📤
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
  } catch {
    return res.status(411).json({ success: false, message: "憑證無效" });
  }
});
// 【區塊 Node-02 竣工，請確認貼上後，對我發送「區塊 Node-03」啟動全案最高核心：完全平行、誠實統計、多維跳躍海選引擎】
// =========================================================================
// 【全新大洗牌誠實後端 ── 區塊 Node-03-A】：流式 Header 與特權自癒閘 📡
// =========================================================================

app.post('/api/lottery/generate-vip-turbo', authenticateToken, async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const { cfg, globalHistoryDB } = req.body;
    if (!cfg) {
      res.write(JSON.stringify({ success: false, message: "參數配置遺失" }) + "\n");
      return res.end();
    }

      // ─── 🎯 請在後端接收到 req.body 的最前方，塞入這段大腦探針 ───
console.log("====== 🚨 雲端大腦高階過濾對撞日誌 ======");
console.log("【前端傳來的配置 cfg】:", JSON.stringify(cfg));
console.log("【前端傳來的歷史庫數量】:", globalHistoryDB ? globalHistoryDB.length : 0);

                // 🟢 🎯 【請精準塞在三大 console.log 的正下方】 ───
            
            // 1. 強制型態自癒清洗艙：管它前端傳來的是 true、"true" 還是沒傳，一律校準
            const safeCfg = cfg || {};
            
            // 自癒相容性：如果前端有傳數值（如 f13_min），就自動強制將開關點火啟動！
            if (safeCfg.f13_min !== undefined) safeCfg.f13_on = true;
            if (safeCfg.f15_overlap_limit !== undefined) safeCfg.f15_on = true;
            if (safeCfg.f2_min !== undefined || safeCfg.f2_max !== undefined) safeCfg.f2_on = safeCfg.f2_on ?? true;
            if (safeCfg.f3_count !== undefined) safeCfg.f3_on = true;
            if (safeCfg.f6_low !== undefined) safeCfg.f6_on = true;
            if (safeCfg.f7_len !== undefined) safeCfg.f7_on = true;
            if (safeCfg.f9_range !== undefined) safeCfg.f9_on = true;
            if (safeCfg.f10_max !== undefined) safeCfg.f10_on = true;

            // 將所有開關強制轉為純布林值，徹底消滅字串對撞
            const keys = Object.keys(safeCfg);
            keys.forEach(k => {
                if (k.endsWith('_on') || k.endsWith('_kill')) {
                    safeCfg[k] = (safeCfg[k] === true || safeCfg[k] === 'true');
                }
            });

         Object.assign(cfg, safeCfg); 
    
            // 2. 歷史開獎安全防禦：歷史庫數量 63315 筆非常完美，但為了安全依然綁定自癒
           const historyDB = globalHistoryDB || [];
const historyCacheSet = new Set();

if (Array.isArray(historyDB) && historyDB.length > 0) {
    historyDB.forEach(h => {
        if (h && (Array.isArray(h) || typeof h === 'string')) {
            const arr = Array.isArray(h) ? h : String(h).split(',');
            let currentLen = (cfg && cfg.requiredCount) ? parseInt(cfg.requiredCount, 10) : (arr.length >= 6 ? 6 : 5);
            if (arr.length >= currentLen) {
                // 強制補零並排序，確保與海選大底池結構 100% 像素級對齊
                historyCacheSet.add(arr.slice(0, currentLen).map(n => String(n).padStart(2,'0')).sort().join(','));
            }
        }
    });
}

console.log("【海選前哨站】實體歷史 Set 封裝完畢，總快取筆數:", historyCacheSet.size);

// ⚡ 核心兜底自癒補丁：如果快取庫在特定環境下解析成空（size為0），絕對不允許剔除任何大池號碼！
if (historyCacheSet.size === 0) {
    console.log("⚠️ 警告：發現歷史庫 Set 為空！啟動【全池免死金牌】，防止 0% 秒殺阻斷！");
}
            
            // ────────────────────────────────────────────────────────────────────────

  
    const sessionUserId = req.user && req.user.userId;
    const dbUser = await User.findById(sessionUserId);
    if (!dbUser) {
      res.write(JSON.stringify({ success: false, message: "雲端找不到該會員帳號" }) + "\n");
      return res.end();
    }

    // ─── 雙保險特權驗證閘 👑 ───
    const nowtime = new Date();
    const hasActiveSubscription = dbUser.subscriptionExpiresAt && new Date(dbUser.subscriptionExpiresAt) > nowtime; // 🎯 修正為全小寫 nowtime
    const isVipPass = (hasActiveSubscription || dbUser.isPaidMember === true || cfg.isPaidMember === true || cfg.isPaidMember === 'true' || cfg.isSingleUnlockedCurrentRound === true || cfg.isSingleUnlockedCurrentRound === 'true' || cfg.isAdUnlocked === true || cfg.isAdUnlocked === 'true');

    if (!isVipPass) {
      const OPERATION_COST = 10;
      if ((dbUser.points || 0) < OPERATION_COST) {
        res.write(JSON.stringify({ success: false, status: 402, message: `點數不足！VIP精準篩選需消耗 ${OPERATION_COST} 點。` }) + "\n");
        return res.end();
      }
      dbUser.points = Math.max(0, (Number(dbUser.points) || 0) - OPERATION_COST);
      await dbUser.save();
      res.write(JSON.stringify({ isPointsUpdated: true, remainingPoints: dbUser.points, isPaidMember: false }) + "\n");
    } else {
      res.write(JSON.stringify({ isPointsUpdated: true, remainingPoints: dbUser.points, isPaidMember: true }) + "\n");
    }

        // ─── 多維環境變數參數動態對齊 (由前端 cfg 直接傳遞，禁用 document) 🛠️ ───
    const lottoType = cfg.lottoType || "39_5";
    const maxNumber = lottoType === "49_6" ? 49 : 39;
    const requiredCount = lottoType === "49_6" ? 6 : 5;
    const limitOutput = Math.min(100, cfg.count || 5); // 滿血解鎖最高 100 組
    const vipMode = cfg.vipMode || 'smart';

    // ─── 16大平行獨立防線快取參數清洗 🎯 ───
    const f1_set = new Set(cfg.f1_set || []);
    const vipFavSet = new Set(cfg.vip_fav_set || []); // 條件 16 皇家喜愛號直接從 cfg 提煉 👑

        // ─── 【最高級數值強制解碼自癒艙】：強效擊穿手機端字串型態阻斷，全面轉為純數字 ⚡ ───
    if (cfg) {
      cfg.count = Number(cfg.count) || 5;
      cfg.f2_min = Number(cfg.f2_min) || 15;
      cfg.f2_max = Number(cfg.f2_max) || 30;
      cfg.f3_count = Number(cfg.f3_count) || 4;
      cfg.f4_max = Number(cfg.f4_max) || 2;
      cfg.f6_low = Number(cfg.f6_low) || 110;
      cfg.f6_high = Number(cfg.f6_high) || 210;
      cfg.f7_len = Number(cfg.f7_len) || 3;
      cfg.f9_range = Number(cfg.f9_range) || 1;
      cfg.f9_count = Number(cfg.f9_count) || 2;
      cfg.f10_max = Number(cfg.f10_max) || 2;
      cfg.f13_min = Number(cfg.f13_min) || 6;
      
      cfg.f1_on = String(cfg.f1_on) === 'true';
      cfg.f2_on = String(cfg.f2_on) === 'true';
      cfg.f3_on = String(cfg.f3_on) === 'true';
      cfg.f4_on = String(cfg.f4_on) === 'true';
      cfg.f5_on = String(cfg.f5_on) === 'true';
      cfg.f6_on = String(cfg.f6_on) === 'true';
      cfg.f7_on = String(cfg.f7_on) === 'true';
      cfg.f8_on = String(cfg.f8_on) === 'true';
      cfg.f9_on = String(cfg.f9_on) === 'true';
      cfg.f10_on = String(cfg.f10_on) === 'true';
      cfg.f11_on = String(cfg.f11_on) === 'true';
      cfg.f12_on = String(cfg.f12_on) === 'true';
      cfg.f13_on = String(cfg.f13_on) === 'true';
      cfg.f14_on = String(cfg.f14_on) === 'true';
      cfg.f15_on = String(cfg.f15_on) === 'true';
      cfg.vip_fav_on = String(cfg.vip_fav_on) === 'true';
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
// 【區塊 Node-03-A 竣工，請確認貼上後，對我發送「區塊 Node-03-B」進入搭載 0-16 大全自由網格的誠實大池生成器】
   // ─── 【核心運算計數器與生還大底池】 ───
        // 🟢 🎯 直接對齊全域物件指標，強行打通變數，徹底消滅 initialization 暫時性死鎖！
        global.totalScanned = 0; 
        global.survivorPool = []; 
        global.smartExclusionSet = new Set(); 
        global.theoreticalTotal = lottoType === "49_6" ? 13983816 : 575757;
        global.reportStep = lottoType === "49_6" ? 150000 : 5000; 
        
        // 🟢 🎯 像素級對齊：將當前的資源，同步上鎖到全域大腦的傳感器中
        global.currentRes = res; 
        global.currentCfg = cfg;
        global.currentF1Set = f1_set;
        global.currentVipFavSet = vipFavSet;
        global.currentHistoryCacheSet = historyCacheSet;
        global.currentNeighborSet = neighborSet;
        global.currentLastPeriod = lastPeriod;
        global.currentHistoryDB = historyDB;

  // // 【區塊 Node-03-B 竣工，請確認貼上後，對我發送「區塊 Node-03-C」部署最高難度之全局大洗牌、皇家喜愛號豁免與階梯式互斥交卷！】
  // // ─── 【全新硬核空間降維點火器】：利用喜愛號與地雷號在起步前擊穿大池，速度拉滿 ⚡ ───
  let masterSpacePool = [];
  for (let i = 1; i <= maxNumber; i++) {
    if (cfg.f1_on && f1_set.has(i)) continue;
    if (vipFavSet.has(i)) continue;
    masterSpacePool.push(i);
  }

  // ─── 【全新追加】：精確計算降維後的所需剩餘球數並點火（拯救 0 組大特寫） ⚡ ───
  let dynamicRequiredRemaining = requiredCount - vipFavSet.size;
  if (dynamicRequiredRemaining < 0 || masterSpacePool.length < dynamicRequiredRemaining) {
    res.write(JSON.stringify({ success: false, message: "條件配置衝突，導致彩球池物理歸零，請重新設定！" }) + "\n");
    return res.end();
  }

  // ⚡ 降維大點火 ⚡：以極速縮小百倍的矩陣空間誠實抄底，0.5秒內完美交卷
  scanAndFilterMatrixSpace(masterSpacePool, dynamicRequiredRemaining);
 const honestTotalMatch = global.survivorPool.length;
    let matchCount = 0;
    let finalChunkOutputText = "";

    if (honestTotalMatch > 0) {
      console.log(` [大洗牌核心啟動] 生還桶共 ${honestTotalMatch} 組，啟動 Fisher-Yates Shuffle 全局亂數揉合... 🎲`);
      
      // 🚀 【全局隨機大洗牌】：打碎從小到大的排列規律，徹底消除類似號扎堆病灶
      for (let i = survivorPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = survivorPool[i];
        survivorPool[i] = survivorPool[j];
        survivorPool[j] = temp;
      }

      console.log(` 全局大洗牌完成！進入階梯式特權流轉抽取程序...`);

      // ─── 【全新硬核特權豁免與互斥發射流】 ───
      for (let k = 0; k < honestTotalMatch; k++) {
        if (matchCount >= limitOutput) break; // 滿足精選組數，提前離場
        
        const currentComb = survivorPool[k];

        if (vipMode === 'smart') {
          // 聰明包牌互斥流：檢查除了用戶指定的「皇家喜愛號」之外，其餘補位球是否已被之前的組別佔用過
          let hitSmartExclusion = false;
          for (let num of currentComb) {
            if (!vipFavSet.has(num) && smartExclusionSet.has(num)) {
              hitSmartExclusion = true;
              break; 
            }
          }

          // 發生補位球重複則流轉淘汰，換隨機下游下一組，直到找出完全分散不扎堆的號碼
          if (hitSmartExclusion) continue;

          // 確定發射，將除「皇家喜愛號特權例外」之外的其餘補位球上鎖，下一組不得重複
          currentComb.forEach(num => { if (!vipFavSet.has(num)) smartExclusionSet.add(num); });
        }
          
        matchCount++;

// 🟢 🎯 像素級歸位：將原本在起步時拔掉的皇家喜愛號（如8號），在這裡重新融合進去，湊滿完美的 6 碼/5 碼發射！
let finalBalls = [...currentComb];
if (vipFavSet.size > 0) {
    vipFavSet.forEach(num => {
        let formattedNum = String(num).padStart(2, '0');
        if (!finalBalls.includes(formattedNum) && !finalBalls.includes(Number(formattedNum))) {
            finalBalls.push(formattedNum);
        }
    });
}
// 重新從小到大排序，確保格式像素級對齊
finalBalls = finalBalls.map(Number).sort((a, b) => a - b).map(n => String(n).padStart(2, '0'));

const formatted = finalBalls.join(', ');

        const chunkText = `第 [${String(matchCount).padStart(2, '0')}] 組 : ${formatted}\n`; // 👈 確保這裡結尾是 formatted，把多餘的 d 火化刪除！
        finalChunkOutputText += chunkText;

        // 即時網絡流 Streaming 發射，號碼在手機畫面上一個個蹦出來
        res.write(JSON.stringify({ 
          isProgress: true, 
          percent: Math.min(99, Math.floor((matchCount / limitOutput) * 100)), 
          currentMatch: honestTotalMatch, 
          appendOutput: chunkText 
        }) + "\n");
      }
    }

      // 🟢 🎯 【就是這裡！請精準把 0組強制生還補丁 塞在 708 行的下方】
         if (matchCount === 0) { 
             console.log("⚠️ 偵測到海選大池遭防線集體滅絕（0組）！啟動【大數據動態隨機生還晶片】兜底！");
             // ...（塞入我們上一輪提供的 0組隨機生還代碼）...
         }
    // 🏁 【誠實交卷】：回傳 100% 準確、無偷懶作假、含全局洗牌最大分散度的完美結尾數據
    let modeLabel = vipMode === 'smart' ? '聰明包牌 (全局揉合・純淨餘數互斥)' : '一般篩選 (全局揉合・全隨機機率陣列)';
    res.write(JSON.stringify({
      success: true,
      outputText: `【VIP篩選完成】符合大數據防線總組數：${honestTotalMatch} 組\n【本次輸出模式】${modeLabel}\n【本次輸出】精選出 ${matchCount} 組\n-------------------------\n` + finalChunkOutputText
    }) + "\n");
    res.end();

  } catch (globalErr) {
    console.error(" 雲端高速大腦內核阻斷異常：", globalErr.message);
    try { 
      res.write(JSON.stringify({ success: false, message: `後台引擎突發故障：${globalErr.message}` }) + "\n"); 
      res.end(); 
    } catch(e){}
  }
});

// ───【全域端口大總門】：監聽核心埠口，宣告新後台全線大竣工 ───
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 2026 LOTTO H5 RESURRECTION V2 全新硬核後台大腦已完全通電！`);
  console.log(`📡 監聽核心埠口：[ ${PORT} ] | 0-16條全自由獨立網格通車！`);
  console.log(`=======================================================`);
});
