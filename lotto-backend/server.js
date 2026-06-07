// =========================================================================
// 【第一區塊 完全體】：基礎引擎宣告、會員安全驗證系統與大樂透 1400 萬組一維通道
// =========================================================================
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();

// 擊穿跨域WebView安全鎖
app.use(cors({ 
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
    allowedHeaders: ['Content-Type', 'Authorization'] 
}));
app.use(express.json({ limit: '100mb' })); 

// =================【MONGOOSE 資料庫操盤手結構定義】=================
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: { type: String },
    googleId: { type: String },
    isPaidMember: { type: Boolean, default: false },
    savedTickets: { type: mongoose.Schema.Types.Mixed, default: [] }
}, { strict: false });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// =================【會員註冊與安全登入接口】=================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await new User({ username, password: hashedPassword, isPaidMember: false }).save();
        res.json({ success: true, message: '註冊成功！🟢' });
    } catch (err) { 
        res.status(500).json({ success: false, message: '註冊失敗，帳號可能已存在' }); 
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ success: false, message: '帳密錯誤' });
        }
        const token = jwt.sign({ userId: user._id, isPaidMember: user.isPaidMember }, 'FREE_LOTTO_SECRET_2026', { expiresIn: '30d' });
        res.json({ success: true, token, username: user.username, isPaidMember: user.isPaidMember });
    } catch (err) { 
        res.status(500).json({ success: false, message: '登入驗證異常' }); 
    }
});

app.post('/api/auth/google-sync', async (req, res) => {
    try {
        const { username, googleId } = req.body;
        if (!googleId) return res.status(400).json({ success: false, message: '無效的 Google 憑證' });
        let user = await User.findOne({ googleId });
        if (!user) {
            user = new User({ 
                username: username || `Google操盤手_${Math.floor(1000 + Math.random() * 9000)}`, 
                googleId: googleId, 
                isPaidMember: false, 
                savedTickets: [] 
            });
            await user.save();
        }
        const token = jwt.sign({ userId: user._id, isPaidMember: user.isPaidMember }, 'FREE_LOTTO_SECRET_2026', { expiresIn: '30d' });
        res.json({ success: true, token, username: user.username, isPaidMember: user.isPaidMember });
    } catch (err) { 
        res.status(500).json({ success: false, message: 'Google 雲端同步異常' }); 
    }
});

// =================【大樂透 1,400 萬組一維高速記憶體通道鋪設】=================
let globalLotto49Matrix = null;
let globalLotto49Indices = null; 

function initLotto49Matrix() {
    if (globalLotto49Matrix) return;
    console.log("⚡ 正在為大樂透 1,400 萬組全窮舉鋪設一維高速記憶體通道...");
    globalLotto49Matrix = new Uint8Array(13983816 * 6);
    globalLotto49Indices = new Int32Array(13983816);
    
    let idx = 0;
    let countIdx = 0;
    for (let i1 = 1; i1 <= 44; i1++) {
        for (let i2 = i1 + 1; i2 <= 45; i2++) {
            for (let i3 = i2 + 1; i3 <= 46; i3++) {
                for (let i4 = i3 + 1; i4 <= 47; i4++) {
                    for (let i5 = i4 + 1; i5 <= 48; i5++) {
                        for (let i6 = i5 + 1; i6 <= 49; i6++) {
                            globalLotto49Matrix[idx++] = i1;
                            globalLotto49Matrix[idx++] = i2;
                            globalLotto49Matrix[idx++] = i3;
                            globalLotto49Matrix[idx++] = i4;
                            globalLotto49Matrix[idx++] = i5;
                            globalLotto49Matrix[idx++] = i6;
                            globalLotto49Indices[countIdx] = countIdx;
                            countIdx++;
                        }
                    }
                }
            }
        }
    }
    console.log("🎲 正在對 1,400 萬組指針進行萬里長征級隨機大洗牌...");
    for (let i = globalLotto49Indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = globalLotto49Indices[i];
        globalLotto49Indices[i] = globalLotto49Indices[j];
        globalLotto49Indices[j] = temp;
    }
    console.log("🟢 1,400 萬組打散指針與矩陣完全體鋪設完畢！");
}
setTimeout(initLotto49Matrix, 1000);
// =========================================================================
// 【第二區塊 - 零件 A】：VIP 渦輪超導串流起點與 64 位元二進位大數據壓縮
// =========================================================================
app.post('/api/lottery/generate-vip', (req, res) => { return runVipLightEngine(req, res); });
app.post('/lottery/generate-vip', (req, res) => { return runVipLightEngine(req, res); });

function runVipLightEngine(req, res) {
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        const { requiredCount, maxNumber, count } = req.body;
        const targetCount = Math.min(100, count || 100);
        let resultsPool = [];
        for (let i = 0; i < targetCount * 2; i++) {
            let pool = Array.from({ length: maxNumber }, (_, idx) => idx + 1);
            for (let j = pool.length - 1; j > 0; j--) {
                const k = Math.floor(Math.random() * (j + 1));
                [pool[j], pool[k]] = [pool[k], pool[j]];
            }
            let comb = pool.slice(0, requiredCount).sort((a, b) => a - b);
            resultsPool.push(comb);
        }
        return res.json({ success: true, results: resultsPool });
    } catch (e) { 
        return res.json({ success: false, results: [] }); 
    }
}

// ⚡ 核心主動防禦：流式 HTTP SSE 傳輸接口，擊穿手機網路硬體中斷超時鎖 ⚡
app.post('/api/lottery/generate-vip-turbo', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const { cfg, globalHistoryDB } = req.body;
        if (!cfg) { 
            return res.write(JSON.stringify({ success: false, message: "參數配置遺失" }) + "\n"); 
        }
        
        const lottoType = cfg.lottoType || "39_5";
        const requiredCount = (lottoType === "49_6") ? 6 : 5;
        const maxNumber = (lottoType === "49_6") ? 49 : 39;
        const targetCount = Math.min(100, cfg.count || 5);
        
        const historyDB = globalHistoryDB || [];
        const historyCacheSet = new Set(historyDB.map(h => h.slice(0, requiredCount).sort((a,b)=>a-b).join(',')));
        
        // 🚀 【二進位位元優化】：歷史大數據壓縮成 64 位元 BigInt，以單個 CPU 週期高速對撞排除 🚀
        const globalHistoryBigInts = historyDB.map(h => {
            let nums = h.slice(0, requiredCount).map(Number);
            let mask = 0n;
            nums.forEach(n => { mask |= (1n << BigInt(n)); });
            return mask;
        });
        
        const f1_set = new Set(cfg.f1_set || []);
        const neighborSet = new Set();
        const lastPeriod = cfg.lastPeriod || [];
        
        lastPeriod.forEach(val => {
            let range = parseInt(cfg.f9_range, 10) || 1;
            for (let d = -range; d <= range; d++) { 
                if (d !== 0) neighborSet.add(val + d); 
            }
        });
        
        let vipValidPool = [];
        let totalScanned = 0;
        let matchCount = 0;
        let vipSmartMask = 0; 
        const isSmartMode = (cfg.vipMode === 'smart');
        // =========================================================================
        // 【第二區塊 - 零件 B】：今彩 539 實體全窮舉與前置物理防線判定
        // =========================================================================
        if (lottoType === "39_5") {
            lotto539OuterLoop:
            for (let i1 = 1; i1 <= 35; i1++) {
                for (let i2 = i1 + 1; i2 <= 36; i2++) {
                    for (let i3 = i2 + 1; i3 <= 37; i3++) {
                        for (let i4 = i3 + 1; i4 <= 38; i4++) {
                            for (let i5 = i4 + 1; i5 <= 39; i5++) {
                                totalScanned++;
                                let comb = [i1, i2, i3, i4, i5];
                                let pass = true;
                                
                                // 【防線 2】：歷史全中全重疊排除
                                if (pass && historyCacheSet.has(comb.join(','))) pass = false;
                                
                                // 【防線 3/條件 1】：地雷號排除 (f1_set)
                                if (pass && cfg.f1_on && (f1_set.has(i1) || f1_set.has(i2) || f1_set.has(i3) || f1_set.has(i4) || f1_set.has(i5))) pass = false;
                                
                                // 【防線 4/條件 2】：首尾邊界熱區控制
                                if (pass && cfg.f2_on && (i1 >= cfg.f2_min || i5 <= cfg.f2_max)) pass = false;
                                
                                // 【防線 5/條件 3】：五大物理區塊落點個數控制
                                if (pass && cfg.f3_on) {
                                    let zoneSet = new Set();
                                    zoneSet.add(Math.min(5, Math.ceil(i1 / 8)))
                                           .add(Math.min(5, Math.ceil(i2 / 8)))
                                           .add(Math.min(5, Math.ceil(i3 / 8)))
                                           .add(Math.min(5, Math.ceil(i4 / 8)))
                                           .add(Math.min(5, Math.ceil(i5 / 8)));
                                    if (zoneSet.size !== cfg.f3_req) pass = false;
                                }
                                
                                // 【防線 6/條件 4】：同尾數重複個數上限過濾
                                if (pass && cfg.f4_on) {
                                    let tails = new Array(10).fill(0);
                                    tails[i1%10]++; tails[i2%10]++; tails[i3%10]++; tails[i4%10]++; tails[i5%10]++;
                                    if (Math.max(...tails) > cfg.f4_max) pass = false;
                                }
                                
                                // 【防線 7/條件 5】：奇偶比例動態防禦牆
                                if (pass && cfg.f5_on) {
                                    let oddCount = (i1%2) + (i2%2) + (i3%2) + (i4%2) + (i5%2);
                                    if (cfg.f5_539_50 && (oddCount === 5 || oddCount === 0)) pass = false;
                                    if (cfg.f5_539_41 && (oddCount === 4 || oddCount === 1)) pass = false;
                                }
                                
                                // 【防線 8/條件 6】：號碼總和區間動態過濾
                                if (pass) {
                                    let sumValue = i1 + i2 + i3 + i4 + i5;
                                    if (cfg.f6_on && (sumValue < cfg.f6_low || sumValue > cfg.f6_high)) pass = false;
                                }
                                // =========================================================================
                                // 【第二區塊 - 零件 C】：539 高階獨立防線、即時進度噴發與聰明自癒閉合
                                // =========================================================================
                                // 【防線 9/條件 13】：今彩 539 數字複雜度 (AC值) 獨立過濾
                                if (pass && cfg.f13_on) {
                                    let diffs = new Set();
                                    for (let m = 0; m < 5; m++) {
                                        for (let n = m + 1; n < 5; n++) { 
                                            diffs.add(Math.abs(comb[m] - comb[n])); 
                                        }
                                    }
                                    if ((diffs.size - 4) < cfg.f13_min) pass = false; 
                                }
                                
                                // 【防線 10/條件 14】：539 質數/合數比例過濾 (獨立封殺單組質數 >= 4 個)
                                if (pass && cfg.f14_on) {
                                    const prime39Mask = (1n<<2n)|(1n<<3n)|(1n<<5n)|(1n<<7n)|(1n<<11n)|(1n<<13n)|(1n<<17n)|(1n<<19n)|(1n<<23n)|(1n<<29n)|(1n<<31n)|(1n<<37n);
                                    let primeCount = 0;
                                    if ((prime39Mask & (1n << BigInt(i1))) !== 0n) primeCount++;
                                    if ((prime39Mask & (1n << BigInt(i2))) !== 0n) primeCount++;
                                    if ((prime39Mask & (1n << BigInt(i3))) !== 0n) primeCount++;
                                    if ((prime39Mask & (1n << BigInt(i4))) !== 0n) primeCount++;
                                    if ((prime39Mask & (1n << BigInt(i5))) !== 0n) primeCount++;
                                    if (primeCount >= 4) pass = false;
                                }
                                
                                // 【防線 11/條件 15】：539 歷史大數據 4 碼重疊位元級防禦封殺
                                if (pass && cfg.f15_on && typeof globalHistoryBigInts !== 'undefined') {
                                    let currentMask = (1n<<BigInt(i1))|(1n<<BigInt(i2))|(1n<<BigInt(i3))|(1n<<BigInt(i4))|(1n<<BigInt(i5));
                                    for (let h = 0; h < globalHistoryBigInts.length; h++) {
                                        let intersect = currentMask & globalHistoryBigInts[h];
                                        let matchOverlap = 0;
                                        while (intersect > 0n) { 
                                            if (intersect & 1n) matchOverlap++; 
                                            intersect >>= 1n; 
                                        }
                                        if (matchOverlap >= 4) { pass = false; break; }
                                    }
                                }
                                
                                // ───【539 聰明包牌獨立隔離與自癒接口】───
                                if (pass) {
                                    matchCount++; 
                                    if (vipValidPool.length < targetCount) {
                                        let dup = false;
                                        if (((vipSmartMask & (1 << i1)) !== 0) || 
                                            ((vipSmartMask & (1 << i2)) !== 0) || 
                                            ((vipSmartMask & (1 << i3)) !== 0) || 
                                            ((vipSmartMask & (1 << i4)) !== 0) || 
                                            ((vipSmartMask & (1 << i5)) !== 0)) {
                                            dup = true;
                                        }
                                        
                                        if (!dup) {
                                            vipValidPool.push(comb);
                                            vipSmartMask |= (1 << i1) | (1 << i2) | (1 << i3) | (1 << i4) | (1 << i5);
                                        } else {
                                            vipSmartMask = 0; // 自癒解鎖
                                        }
                                    }
                                }
                                
                                // 🌊 539 異步串流進度每 15 萬組實時噴回手機前端 🌊
                                if (totalScanned % 150000 === 0) {
                                    let percent = Math.floor((totalScanned / 575757) * 100);
                                    res.write(JSON.stringify({ isProgress: true, percent: percent, currentMatch: matchCount }) + "\n");
                                }
                            }
                        }
                    }
                }
            }
        } // 🎯 閉合 539 主軌道
        // =========================================================================
        // 【第三區塊 - 零件 A】：大樂透分流起點、一維矩陣解壓與基礎防線判定
        // =========================================================================
        else {
            // 驅動開機預載的 Fisher-Yates 隨機指針陣列，徹底打破覆蓋偏向！
            initLotto49Matrix(); 
            
            let f2_min = parseInt(cfg.f2_min, 10) || 15;
            let f2_max = parseInt(cfg.f2_max, 10) || 30;
            let f4_max = parseInt(cfg.f4_max, 10) || 2;
            let f6_low = parseInt(cfg.f6_low, 10) || 100;
            let f6_high = parseInt(cfg.f6_high, 10) || 185;
            const matrixLength = 13983816;
            const chunkSize = 3495954; 
            let currentPointerIdx = 0;
            
            // 鑽石優化：大樂透超 40 位元全局「不重複聰明包牌」雙軌整數遮罩快取
            let smartMaskLow = 0;  // 追蹤 1-25 號碼
            let smartMaskHigh = 0; // 追蹤 26-49 號碼
            
            // 🚀 核心黑科技：大樂透超導非同步時間切片 Chunking 核心處理器
            async function runSliceChunk(startK, endK) {
                for (let k = startK; k < endK; k++) {
                    // 在 0 記憶體負擔下精確擊穿時脈限制，直接解壓一維矩陣資料
                    let matrixId = globalLotto49Indices[currentPointerIdx++];
                    let bytePos = matrixId * 6;
                    
                    let i1 = globalLotto49Matrix[bytePos];
                    let i2 = globalLotto49Matrix[bytePos + 1];
                    let i3 = globalLotto49Matrix[bytePos + 2];
                    let i4 = globalLotto49Matrix[bytePos + 3];
                    let i5 = globalLotto49Matrix[bytePos + 4];
                    let i6 = globalLotto49Matrix[bytePos + 5];
                    totalScanned++;
                    let pass = true;
                    
                    // 【防線 4/條件 2】：首尾邊界熱區控制
                    if (pass && cfg.f2_on && (i1 >= f2_min || i6 <= f2_max)) pass = false;
                    
                    if (pass) {
                        let comb = [i1, i2, i3, i4, i5, i6];
                        
                        // 【防線 2】：歷史全中全重疊排除
                        if (historyCacheSet.has(comb.join(','))) pass = false;
                        
                        // 【防線 3/條件 1】：排除特定地雷號碼
                        if (pass && cfg.f1_on && (f1_set.has(i1) || f1_set.has(i2) || f1_set.has(i3) || f1_set.has(i4) || f1_set.has(i5) || f1_set.has(i6))) pass = false;
                        
                        // 【防線 5/條件 3】：五大物理區塊落點個數控制
                        if (pass && cfg.f3_on) {
                            let zoneSet = new Set();
                            zoneSet.add(Math.min(5, Math.ceil(i1 / 10)))
                                   .add(Math.min(5, Math.ceil(i2 / 10)))
                                   .add(Math.min(5, Math.ceil(i3 / 10)))
                                   .add(Math.min(5, Math.ceil(i4 / 10)))
                                   .add(Math.min(5, Math.ceil(i5 / 10)))
                                   .add(Math.min(5, Math.ceil(i6 / 10)));
                            if (zoneSet.size !== cfg.f3_req) pass = false;
                        }
                        
                        // 【防線 6/條件 4】：同尾數重複個數上限過濾
                        if (pass && cfg.f4_on) {
                            let tails = new Array(10).fill(0);
                            tails[i1%10]++; tails[i2%10]++; tails[i3%10]++; tails[i4%10]++; tails[i5%10]++; tails[i6%10]++;
                            if (Math.max(...tails) > f4_max) pass = false;
                        }
                        
                        // 【防線 7/條件 5】：奇偶比例動態防禦牆
                        if (pass && cfg.f5_on) {
                            let oddCount = (i1%2) + (i2%2) + (i3%2) + (i4%2) + (i5%2) + (i6%2);
                            if (cfg.f5_lotto_60 && (oddCount === 6 || oddCount === 0)) pass = false;
                            if (cfg.f5_lotto_51 && (oddCount === 5 || oddCount === 1)) pass = false;
                        }
                        
                        // 【防線 8/條件 6】：號碼總和區間動態過濾
                        if (pass) {
                            let sumValue = i1 + i2 + i3 + i4 + i5 + i6;
                            if (cfg.f6_on && (sumValue < f6_low || sumValue > f6_high)) pass = false;
                        }
                        // =========================================================================
                        // 【第三區塊 - 零件 B】：大樂透高階獨立防線與雙軌遮罩寫入、切片迴圈釋放
                        // =========================================================================
                        // 【防線 9/條件 13】：大樂透數字複雜度 (AC值) 獨立過濾
                        if (pass && cfg.f13_on) {
                            let diffs = new Set();
                            for (let m = 0; m < 6; m++) {
                                for (let n = m + 1; n < 6; n++) { 
                                    diffs.add(Math.abs(comb[m] - comb[n])); 
                                }
                            }
                            if ((diffs.size - 5) < cfg.f13_min) pass = false; 
                        }
                        
                        // 【防線 10/條件 14】：大樂透質數/合數比例過濾 (獨立封殺單組質數 >= 4 個)
                        if (pass && cfg.f14_on) {
                            const prime49Mask = (1n<<2n)|(1n<<3n)|(1n<<5n)|(1n<<7n)|(1n<<11n)|(1n<<13n)|(1n<<17n)|(1n<<19n)|(1n<<23n)|(1n<<29n)|(1n<<31n)|(1n<<37n)|(1n<<41n)|(1n<<43n)|(1n<<47n);
                            let primeCount = 0;
                            if ((prime49Mask & (1n << BigInt(i1))) !== 0n) primeCount++;
                            if ((prime49Mask & (1n << BigInt(i2))) !== 0n) primeCount++;
                            if ((prime49Mask & (1n << BigInt(i3))) !== 0n) primeCount++;
                            if ((prime49Mask & (1n << BigInt(i4))) !== 0n) primeCount++;
                            if ((prime49Mask & (1n << BigInt(i5))) !== 0n) primeCount++;
                            if ((prime49Mask & (1n << BigInt(i6))) !== 0n) primeCount++;
                            if (primeCount >= 4) pass = false; 
                        }
                        
                        // 【防線 11/條件 15】：大樂透歷史大數據 5 碼重疊位元級高速排除
                        if (pass && cfg.f15_on && typeof globalHistoryBigInts !== 'undefined') {
                            let currentMask = (1n<<BigInt(i1))|(1n<<BigInt(i2))|(1n<<BigInt(i3))|(1n<<BigInt(i4))|(1n<<BigInt(i5))|(1n<<BigInt(i6));
                            for (let h = 0; h < globalHistoryBigInts.length; h++) {
                                let intersect = currentMask & globalHistoryBigInts[h];
                                let matchOverlap = 0;
                                while (intersect > 0n) { 
                                    if (intersect & 1n) matchOverlap++; 
                                    intersect >>= 1n; 
                                }
                                if (matchOverlap >= 5) { pass = false; break; }
                            }
                        }
                        
                        // ───【大樂透聰明包牌雙軌智控隔離接口】───
                        if (pass) {
                            matchCount++; 
                            if (vipValidPool.length < targetCount) {
                                let dup = false;
                                if (i1 <= 25) { if ((smartMaskLow & (1 << i1)) !== 0) dup = true; } else { if ((smartMaskHigh & (1 << (i1 - 25))) !== 0) dup = true; }
                                if (i2 <= 25) { if ((smartMaskLow & (1 << i2)) !== 0) dup = true; } else { if ((smartMaskHigh & (1 << (i2 - 25))) !== 0) dup = true; }
                                if (i3 <= 25) { if ((smartMaskLow & (1 << i3)) !== 0) dup = true; } else { if ((smartMaskHigh & (1 << (i3 - 25))) !== 0) dup = true; }
                                if (i4 <= 25) { if ((smartMaskLow & (1 << i4)) !== 0) dup = true; } else { if ((smartMaskHigh & (1 << (i4 - 25))) !== 0) dup = true; }
                                if (i5 <= 25) { if ((smartMaskLow & (1 << i5)) !== 0) dup = true; } else { if ((smartMaskHigh & (1 << (i5 - 25))) !== 0) dup = true; }
                                if (i6 <= 25) { if ((smartMaskLow & (1 << i6)) !== 0) dup = true; } else { if ((smartMaskHigh & (1 << (i6 - 25))) !== 0) dup = true; }
                                
                                if (!dup) {
                                    vipValidPool.push(comb);
                                    if (i1 <= 25) smartMaskLow |= (1 << i1); else smartMaskHigh |= (1 << (i1 - 25));
                                    if (i2 <= 25) smartMaskLow |= (1 << i2); else smartMaskHigh |= (1 << (i2 - 25));
                                    if (i3 <= 25) smartMaskLow |= (1 << i3); else smartMaskHigh |= (1 << (i3 - 25));
                                    if (i4 <= 25) smartMaskLow |= (1 << i4); else smartMaskHigh |= (1 << (i4 - 25));
                                    if (i5 <= 25) smartMaskLow |= (1 << i5); else smartMaskHigh |= (1 << (i5 - 25));
                                    if (i6 <= 25) smartMaskLow |= (1 << i6); else smartMaskHigh |= (1 << (i6 - 25));
                                } else {
                                    smartMaskLow = 0; smartMaskHigh = 0; // 自癒解鎖
                                }
                            }
                        }
                    }
                } // 🎯 閉合單個 Chunk 的 for 迴圈
                
                // 🌊 大樂透即時進度％數隨時間切片，不間斷透過 HTTP 管道噴回手機螢幕 🌊
                let percent = Math.floor((totalScanned / matrixLength) * 100);
                res.write(JSON.stringify({ isProgress: true, percent: percent, currentMatch: matchCount }) + "\n");
                
                // 🚀 【時間切片關鍵點】：精確交還執行緒控制權，阻斷硬體中斷與當機
                if (totalScanned < matrixLength) {
                    await new Promise(resolve => setImmediate(resolve));
                }
            }
            
            // 依序驅動 4 大切片快取，搾乾雲端核心時脈！
            await runSliceChunk(0, chunkSize);
            await runSliceChunk(chunkSize, chunkSize * 2);
            await runSliceChunk(chunkSize * 2, chunkSize * 3);
            await runSliceChunk(chunkSize * 3, matrixLength);
        } // 🎯 閉合大樂透主軌道 (else 區塊)
        // =========================================================================
        // 【第三區塊 - 零件 C】：全線結果封裝輸出、明牌存取 API 與雙層保險啟動監聽
        // =========================================================================
        if (vipValidPool.length === 0) {
            return res.write(JSON.stringify({ success: false, message: "符合防線有效組合為 0 組，請放寬過濾標準！" }) + "\n");
        }
        
        let mName = (cfg.vipMode === 'smart') ? '聰明包牌' : '一般隨機';
        let outputText = `【VIP篩選完成】符合防線總組數：${(lottoType === "39_5") ? vipValidPool.length : matchCount} 組\n【本次輸出模式】${mName}\n【本次輸出】精選出 ${vipValidPool.length} 組\n-------------------------\n`;
        vipValidPool.forEach((comb, idx) => {
            outputText += `第 [${String(idx + 1).padStart(2, '0')}] 組：${comb.map(n => String(n).padStart(2, '0')).join(', ')}\n`;
        });
        
        res.write(JSON.stringify({ success: true, outputText: outputText }) + "\n");
        res.end();
        
    } catch (err) {
        res.write(JSON.stringify({ success: false, message: "雲端大數據晶片過載：" + err.message }) + "\n");
        res.end();
    }
});

// =================【智能備份/同步明牌 API 接口】=================
app.post('/api/tickets/save', async (req, res) => {
    try {
        const token = req.headers['authorization'];
        if (!token) return res.status(401).json({ success: false, message: '未帶憑證' });
        const decoded = jwt.verify(token, 'FREE_LOTTO_SECRET_2026');
        await User.findByIdAndUpdate(decoded.userId, { $set: { savedTickets: req.body.tickets || [] } }, { upsert: true });
        return res.json({ success: true, message: '明牌已成功同步！🟢' });
    } catch (err) { 
        return res.json({ success: true }); 
    }
});

app.get('/api/tickets/list', async (req, res) => {
    try {
        const token = req.headers['authorization'];
        const decoded = jwt.verify(token, 'FREE_LOTTO_SECRET_2026');
        const user = await User.findById(decoded.userId);
        res.json({ success: true, savedTickets: (user && user.savedTickets) ? user.savedTickets : [] });
    } catch (err) { 
        res.status(401).json({ success: false, savedTickets: [] }); 
    }
});

// =================【環境埠位配置與雙層保險滿血啟動】=================
const PORT = process.env.PORT || 10000;
// 雙層防禦機制：自動適應 Render 表格變數與代碼內置盾牌
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb+srv://bingooo16888_db_user:bingo19880429@cluster0.t33ebvn.mongodb.net/lotto?retryWrites=true&w=majority&appName=Cluster0";

app.listen(PORT, () => { 
    console.log(`🚀 雲端運行引擎已在埠位 ${PORT} 滿血發動！`); 
});

if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => { console.log("🟢 MongoDB 雲端大腦握手成功！"); })
        .catch(err => { console.error("❌ 資料庫連線跳過:", err.message); });
}

// =========================================================================
// ───【2026 終極原廠融合完全體 server.js 全線正式通車！】───
// =========================================================================
