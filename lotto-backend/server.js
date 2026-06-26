// ==========================================
// 【區塊一：伺服器基礎工程與手機端 CORS 破壁防線】
// ==========================================
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const app = express();
app.use(express.json()); // 解析前端發射的 JSON 配置 (cfg)

// ⚡ 【CORS 破壁晶片】：動態比對並核准手機端 https://localhost 與網頁端來源
app.use((req, res, next) => {
    const origin = req.headers.origin;
    // 允許本地開發、線上網頁以及 Capacitor 手機原生環境 (https://localhost) 通行
    if (origin === 'https://localhost' || origin === 'http://localhost' || /render\.com$/.test(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // 應對手機端發射的預檢請求 (Preflight Options Request)，立刻放行
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// 🗄️ 【資料庫通道】：移植原後台 111 歷史獎號快取資料庫連線
// 請將此處的 URI 替換為您 Render 環境變數或原 MongoDB 實際連接字串
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://lotto_user:password@cluster.mongodb.net/lottoDB';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('📡 【雲端同步】成功對接外部 MongoDB 歷史獎號快取資料庫'))
    .catch(err => console.error('❌ 【連接失敗】資料庫通道崩塌:', err));

// 🛡️ 【洗滌令牌安全認證】：原後台 111 Token 驗證晶片移植
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '令牌遺失，認證失敗' });

    jwt.verify(token, process.env.JWT_SECRET || 'VIP_CORE_SECRET_999', (err, user) => {
        if (err) return res.status(403).json({ success: false, message: '令牌過期或無效' });
        req.user = user;
        next();
    });
};
// ==========================================
// 【區塊二：中央中繼站調度核心與自適應演算法路由】
// ==========================================

// 🎯 【動態自適應貪婪包牌骨架演算法】：依據剩餘球數動態計算互斥組合
function generateSmartWheelingMatrix(cfg) {
    const is39 = cfg.lottoType === '39_5';
    const size = is39 ? 5 : 6;
    const totalBalls = is39 ? 39 : 49;

    let allBalls = Array.from({ length: totalBalls }, (_, i) => i + 1);
    const mineBalls = cfg.f12_kill_set || []; // 讀取前端排除的地雷號
    let remainingBalls = allBalls.filter(ball => !mineBalls.includes(ball)); // 剔除地雷號

    const favBalls = cfg.vip_fav_on ? (cfg.vip_fav_set || []) : []; // 讀取鎖定的喜愛號
    remainingBalls = remainingBalls.filter(ball => !favBalls.includes(ball)); // 隔離喜愛號

    // 隨機洗牌（打破數字順序）
    for (let i = remainingBalls.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingBalls[i], remainingBalls[j]] = [remainingBalls[j], remainingBalls[i]];
    }

    const availableSlotsPerGroup = size - favBalls.length; // 計算每組還剩幾個空缺
    // 🧠 關鍵指正落實：依據賸餘號碼動態除以每組容量，自動決定生成 1-8 組不重複骨架
    const maxGroups = Math.floor(remainingBalls.length / availableSlotsPerGroup); 
    const smartSkeletonGroups = [];

    for (let g = 0; g < maxGroups; g++) {
        let singleGroup = [...favBalls]; // 強制注入喜愛號
        const slots = remainingBalls.splice(0, availableSlotsPerGroup); // 貪婪抓取互斥號碼
        singleGroup.push(...slots);
        singleGroup.sort((a, b) => a - b);
        smartSkeletonGroups.push(singleGroup);
    }
    return smartSkeletonGroups;
}

// 🚀 【VIP 核心對撞路由】：原 'generate-vip-turbo' 升級版
app.post('/api/lottery/generate-vip-turbo', authenticateToken, async (req, res) => {
    try {
        const { cfg, localHistoryCache } = req.body; 
        console.log(`📡 【雲端大腦對撞日誌】已封裝接收快取歷史數據: ${localHistoryCache?.length || 0} 條`);

        const requiredCount = cfg.requiredCount || 100; // 讀取用戶設定組數 (1-100組)
        const survivorSet = new Set();
        const finalResults = [];
        let isFinished = false;

        // 如果開啟了「聰明包牌模式」，優先執行自適應貪婪網格生成
        if (cfg.mode === 'smart') {
            const skeletons = generateSmartWheelingMatrix(cfg);
            // 將生成的互斥包牌投入主中繼站（後續由區塊三的防線進行洗滌過濾）
            skeletons.forEach(comb => {
                const str = comb.join(',');
                if (!survivorSet.has(str)) { survivorSet.add(str); finalResults.push(comb); }
            });
        }

        // 🔗 【多通道中央中繼分流】：開闢 4 個虛擬通道 (Worker Threads) 高速並行發射
        const workers = [];
        const threadCount = 4;

        const terminateWorkers = () => {
            isFinished = true;
            workers.forEach(w => w.terminate());
        };

        // 回應前端串流頭部，確保手機端 readChunks() 通道正常握手
        res.setHeader('Content-Type', 'application/json');
        
        await new Promise((resolve) => {
            // 如果貪婪模式下初始互斥組就已經塞滿目標組數，直接通車
            if (finalResults.length >= requiredCount) return resolve();

            for (let i = 0; i < threadCount; i++) {
                // 指向自身檔案執行 Worker 分流（Node.js 特性）
                const worker = new Worker(__filename, { workerData: { cfg, localHistoryCache } });
                
                // 🧠 關鍵指正落實：通道每符合 1 組就交卷，由中繼站統一排重、計數並合流
                worker.on('message', (msg) => {
                    if (isFinished) return;
                    if (msg.type === 'FOUND_ONE') {
                        const combString = msg.data.join(',');
                        if (!survivorSet.has(combString)) { // 中繼站查重
                            survivorSet.add(combString);
                            finalResults.push(msg.data);

                            // 當中繼站累計滿足設定的 1-100 組，立刻斷流，全線中斷運算
                            if (finalResults.length >= requiredCount) {
                                terminateWorkers();
                                resolve();
                            }
                        }
                    }
                });
                workers.push(worker);
            }
        });

        // 完美交卷，回傳給手機端
        return res.json({ success: true, count: finalResults.length, data: finalResults });

    } catch (err) {
        console.error('❌ 雲端運算核心崩潰:', err);
        return res.status(500).json({ success: false, message: '雲端大腦崩潰，請檢查配置' });
    }
});
// ==========================================
// 【區塊三-A：子線程初始化與 01-04 核心骨架防線】
// ==========================================
if (!isMainThread) {
    const { cfg, localHistoryCache } = workerData;
    const is39 = cfg.lottoType === '39_5';
    const maxBall = is39 ? 39 : 49;
    const pickCount = is39 ? 5 : 6;
    
    // 🗄️ 【歷史庫對撞 Set 化】：將 6 萬筆歷史紀錄優化為 O(1) 複雜度的字串檢索艙
    const historySet = new Set(
        localHistoryCache?.map(item => {
            if (!item.numbers) return '';
            return [...item.numbers].sort((a, b) => a - b).join(',');
        }).filter(Boolean) || []
    );

    // 🧬 【防線矩陣：第一部分】：01 至 04 道經典數理過濾閘
    function checkFrontFilters(comb, sum) {
        // 🛡️ 防線 01：總和值區間過濾
        if (cfg.f1_on && (sum < cfg.f1_min || sum > cfg.f1_max)) return false;

        // 🛡️ 防線 02：奇偶比率過濾 (例如勾選 3:3, 4:2 等比例)
        const oddCount = comb.filter(n => n % 2 !== 0).length;
        const oddEvenRatio = `${oddCount}:${pickCount - oddCount}`;
        if (cfg.f2_on && !cfg.f2_allowed?.includes(oddEvenRatio)) return false;

        // 🛡️ 防線 03：大中小區段動態分佈過濾
        // 規則：大樂透(1-16/17-32/33-49)、539(1-13/14-26/27-39)
        const boundary = is39 ? [13, 26] :;
        let p1 = 0, p2 = 0, p3 = 0;
        comb.forEach(n => {
            if (n <= boundary[0]) p1++;
            else if (n <= boundary[1]) p2++;
            else p3++;
        });
        const currentPattern = `${p1}:${p2}:${p3}`;
        if (cfg.f3_on && !cfg.f3_allowed?.includes(currentPattern)) return false;

        // 🛡️ 防線 04：連續號碼（連號組數）判定
        let consecutivePairs = 0;
        for (let i = 0; i < comb.length - 1; i++) {
            if (comb[i + 1] - comb[i] === 1) consecutivePairs++;
        }
        if (cfg.f4_on && (consecutivePairs < cfg.f4_min || consecutivePairs > cfg.f4_max)) return false;

        return true; // 通過前哨站防線
    }
    // ==========================================
    // 【區塊三-B1：05-08 進階數理防線對撞艙】
    // ==========================================
    function checkFilters_05_08(comb, lastPeriodNumbers, historicalSkipMatrix) {
        // 🛡️ 防線 05：AC 值 (Arithmetic Complexity) 算術複雜度過濾
        if (cfg.f5_on) {
            const diffs = new Set();
            for (let i = 0; i < comb.length; i++) {
                for (let j = i + 1; j < comb.length; j++) {
                    diffs.add(comb[j] - comb[i]);
                }
            }
            const acValue = diffs.size - (pickCount - 1);
            if (acValue < cfg.f5_min || acValue > cfg.f5_max) return false;
        }

        // 🛡️ 防線 06：同尾數 (尾數排重) 判定 (例如單組內不可超過 X 個相同尾數)
        if (cfg.f6_on) {
            const tailMap = {};
            comb.forEach(n => {
                const tail = n % 10;
                tailMap[tail] = (tailMap[tail] || 0) + 1;
            });
            const maxTailCount = Math.max(...Object.values(tailMap));
            if (maxTailCount > cfg.f6_max_limit) return false;
        }

        // 🛡️ 防線 07：連莊號過濾 (與上一期最新開獎號碼的重複顆數)
        if (cfg.f7_on && lastPeriodNumbers?.length > 0) {
            const repeatCount = comb.filter(n => lastPeriodNumbers.includes(n)).length;
            if (repeatCount < cfg.f7_min || repeatCount > cfg.f7_max) return false;
        }

        // 🛡️ 防線 08：隔期跳號防線 (與上上期開獎號碼的冷熱對撞)
        if (cfg.f8_on && cfg.f8_prev_numbers?.length > 0) {
            const skipCount = comb.filter(n => cfg.f8_prev_numbers.includes(n)).length;
            if (skipCount < cfg.f8_min || skipCount > cfg.f8_max) return false;
        }

        return true;
    }
    // ==========================================
    // 【區塊三-B2：09-12 高階物理防線對撞艙】
    // ==========================================
    function checkFilters_09_12(comb) {
        // 🛡️ 防線 09：冷熱門分布權重過濾 (熱門號在整組中的佔比)
        if (cfg.f9_on && cfg.hot_balls?.length > 0) {
            const hotCount = comb.filter(n => cfg.hot_balls.includes(n)).length;
            if (hotCount < cfg.f9_min_hot || hotCount > cfg.f9_max_hot) return false;
        }

        // 🛡️ 防線 10：號碼總間距 (極差過濾，最大碼減最小碼)
        if (cfg.f10_on) {
            const span = comb[comb.length - 1] - comb[0];
            if (span < cfg.f10_min || span > cfg.f10_max) return false;
        }

        // 🛡️ 防線 11：尾數總和區間過濾 (所有選號的個位數相加)
        if (cfg.f11_on) {
            const tailSum = comb.reduce((acc, curr) => acc + (curr % 10), 0);
            if (tailSum < cfg.f11_min || tailSum > cfg.f11_max) return false;
        }

        // 🛡️ 防線 12：動態剔除地雷號防線（第二道高敏防護盾，確保徹底擊殺）
        if (cfg.f12_on && cfg.f12_kill_set?.length > 0) {
            if (comb.some(n => cfg.f12_kill_set.includes(n))) return false;
        }

        return true;
    }
    // ==========================================
    // 【區塊三-B3：13-15 極致數據防線與結尾合流】
    // ==========================================
    function checkFilters_13_15(comb) {
        // 🛡️ 防線 13：相鄰號過濾 (斜連號判定，與前一期開獎號加減 1 的球數)
        if (cfg.f13_on && cfg.f13_neighbor_balls?.length > 0) {
            const neighborCount = comb.filter(n => cfg.f13_neighbor_balls.includes(n)).length;
            if (neighborCount < cfg.f13_min || neighborCount > cfg.f13_max) return false;
        }

        // 🛡️ 防線 14：質數顆數比例過濾
        if (cfg.f14_on) {
            const primes =;
            const primeCount = comb.filter(n => primes.includes(n)).length;
            if (primeCount < cfg.f14_min || primeCount > cfg.f14_max) return false;
        }

        // 🛡️ 防線 15：歷史數據全中高重疊率安全過濾（極致效能優化）
        // 💡 透過最上方快取的 historySet 的字串化，達到 O(1) 複雜度，0 延遲秒殺比對
        if (cfg.f15_on && historySet.has(comb.join(','))) return false;

        return true;
    }

    // 🗛 【總閘口：三層洗滌網格全面揉合】
    function validateAll15Filters(comb) {
        // 依序分層進行二進制分支過濾，最大化保護 CPU 資源
        if (!checkFrontFilters(comb, comb.reduce((a, b) => a + b, 0))) return false; // 呼叫區塊三-A
        if (!checkFilters_05_08(comb, cfg.f7_last_numbers, cfg.f8_matrix)) return false;
        if (!checkFilters_09_12(comb)) return false;
        if (!checkFilters_13_15(comb)) return false;
        return true; 
    }

    // 🚀 【純隨機無規律生號引擎】：建立專屬純淨可用球池
    const baseBallPool = Array.from({ length: maxBall }, (_, i) => i + 1)
                              .filter(n => !(cfg.f12_kill_set || []).includes(n));

    // 🔥 啟動多通道 Worker 無限變異循環
    while (true) {
        let pool = [...baseBallPool];
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const combination = pool.slice(0, pickCount).sort((a, b) => a - b);

        if (validateAll15Filters(combination)) {
            // ⭐ 【中央中繼上報點】：符合 1 組立刻回傳，全線併行不塞車
            parentPort.postMessage({ type: 'FOUND_ONE', data: combination });
        }
    }
} else {
    // 🌐 【伺服器實體埠啟動】：確保 Render 埠動態綁定，解決手機連線超時與 CORS 卡死
    const PORT = process.env.PORT || 10000;
    app.listen(PORT, () => {
        console.log(`📡 [SERVER INITIALIZED] 雲端 15 大防線與中繼站已大竣工！`);
        console.log(`🚀 手機原生端破壁防線 [https://localhost] 安全通行中！`);
    });
}
