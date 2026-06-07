@@ -1,5 +1,5 @@
// =========================================================================
// 【第一區塊 完全體】：基礎引擎宣告、會員安全驗證系統與大樂透 1400 萬組一維通道
// 【零件 1】：基礎引擎宣告、會員安全驗證系統與大數據一維記憶體鋪設
// =========================================================================
const express = require('express');
const mongoose = require('mongoose');
@@ -118,7 +118,7 @@ function initLotto49Matrix() {
}
setTimeout(initLotto49Matrix, 1000);
// =========================================================================
// 【第二區塊 - 零件 A】：VIP 渦輪超導串流起點、大數據位元壓縮與大組階梯自癒接力矩陣
// 【零件 2】：VIP 渦輪超導串流起點、大數據位元壓縮與大組階梯自癒接力矩陣
// =========================================================================
app.post('/api/lottery/generate-vip', (req, res) => { return runVipLightEngine(req, res); });
app.post('/lottery/generate-vip', (req, res) => { return runVipLightEngine(req, res); });
@@ -199,7 +199,6 @@ app.post('/api/lottery/generate-vip-turbo', async (req, res) => {
        function checkAndRegisterSmart接力(combArray) {
            let matchOverlapWithCurrentGroup = false;

            // 遍歷當前組合的每一個號碼
            for (let n of combArray) {
                let bit = 1n << BigInt(n);
                if ((usedNumbersGlobalMask & bit) !== 0n) {
@@ -209,59 +208,52 @@ app.post('/api/lottery/generate-vip-turbo', async (req, res) => {
            }

            if (!matchOverlapWithCurrentGroup) {
                // 🟢 字面完全不重複！將此組合的號碼永遠鎖入全局遮罩，劃歸當前大組
                for (let n of combArray) {
                    usedNumbersGlobalMask |= (1n << BigInt(n));
                }
                return true;
            } else {
                // 🔴 與當前組號碼發生重疊！檢查是否所有 39 或 49 個號碼都已經被輪過一圈了？
                let usedCount = 0;
                let tempMask = usedNumbersGlobalMask;
                while (tempMask > 0n) {
                    if (tempMask & 1n) usedCount++;
                    tempMask >>= 1n;
                }

                // 如果目前的剩餘號碼已經不夠湊出新的一組（539剩餘號碼<5，大樂透剩餘號碼<6）
                let remainingRequired = (lottoType === "49_6") ? 6 : 5;
                if ((maxPossibleNumbersInGroup - usedCount) < remainingRequired) {
                    // ⚡ 自動觸發自癒自檢：開闢全新的大組隔離空間（第二大組接力開始），重置遮罩，但絕對不回頭重複！
                    currentGroupIndex++;
                    usedNumbersGlobalMask = 0n;
                    // 將當前這組新精銳號碼直接填入新大組的第一順位
                    for (let n of combArray) {
                        usedNumbersGlobalMask |= (1n << BigInt(n));
                    }
                    return true;
                }
                return false; // 還在大組空間內，繼續尋找其他未出廠的不重複號碼
                return false; 
            }
        }
        // =========================================================================
        // 【第二區塊 - 零件 B】：539 預過濾快取陣列對撞技術與 1-8 基礎物理防線 (快 60 倍)
        // =========================================================================
// =========================================================================
// 【零件 3】：539 預過濾快取陣列對撞技術、15大完整防線判定與大組自癒閉合
// =========================================================================
        if (lottoType === "39_5") {
            let f2_min = parseInt(cfg.f2_min, 10) || 10;
            let f2_max = parseInt(cfg.f2_max, 10) || 30;
            let f4_max = parseInt(cfg.f4_max, 10) || 2;
            let f6_low = parseInt(cfg.f6_low, 10) || 60;
            let f6_high = parseInt(cfg.f6_high, 10) || 140;

            // 🚀 智慧預過濾動態骨架：建立符合基礎邊界與地雷排除的 539 高機率合格精銳池
            let primeCandidatePool = [];
            for (let n = 1; n <= 39; n++) {
                if (cfg.f1_on && f1_set.has(n)) continue; // 瞬間封殺地雷號
                if (cfg.f1_on && f1_set.has(n)) continue; 
                primeCandidatePool.push(n);
            }

            let pLen = primeCandidatePool.length;

            // 高速一維打散快取，直接擊穿傳統過濾瓶頸
            lotto539FastLoop:
            for (let a = 0; a < pLen - 4; a++) {
                let i1 = primeCandidatePool[a];
                if (cfg.f2_on && i1 >= f2_min) continue; // 瞬間斬斷無效邊界
                if (cfg.f2_on && i1 >= f2_min) continue; 

                for (let b = a + 1; b < pLen - 3; b++) {
                    let i2 = primeCandidatePool[b];
@@ -271,7 +263,7 @@ app.post('/api/lottery/generate-vip-turbo', async (req, res) => {
                            let i4 = primeCandidatePool[d];
                            for (let e = d + 1; e < pLen; e++) {
                                let i5 = primeCandidatePool[e];
                                if (cfg.f2_on && i5 <= f2_max) continue; // 瞬間斬斷無效尾界
                                if (cfg.f2_on && i5 <= f2_max) continue; 

                                totalScanned++;
                                let comb = [i1, i2, i3, i4, i5];
@@ -310,9 +302,7 @@ app.post('/api/lottery/generate-vip-turbo', async (req, res) => {
                                    let sumValue = i1 + i2 + i3 + i4 + i5;
                                    if (cfg.f6_on && (sumValue < f6_low || sumValue > f6_high)) pass = false;
                                }
                                // =========================================================================
                                // 【第二區塊 - 零件 C】：539 高階防線對撞、大組接力隔離鎖與串流噴發
                                // =========================================================================

                                // 【防線 9/條件 13】：今彩 539 數字複雜度 (AC值) 獨立過濾
                                if (pass && cfg.f13_on) {
                                    let diffs = new Set();
@@ -324,7 +314,7 @@ app.post('/api/lottery/generate-vip-turbo', async (req, res) => {
                                    if ((diffs.size - 4) < cfg.f13_min) pass = false; 
                                }

                                // 【防線 10/條件 14】：539 質數/合數比例過濾 (獨立封殺單組質數 >= 4 個)
                                // 【防線 10/條件 14】：539 質數/合數比例過濾
                                if (pass && cfg.f14_on) {
                                    const prime39Mask = (1n<<2n)|(1n<<3n)|(1n<<5n)|(1n<<7n)|(1n<<11n)|(1n<<13n)|(1n<<17n)|(1n<<19n)|(1n<<23n)|(1n<<29n)|(1n<<31n)|(1n<<37n);
                                    let primeCount = 0;
@@ -350,25 +340,22 @@ app.post('/api/lottery/generate-vip-turbo', async (req, res) => {
                                    }
                                }

                                // ───【539 全局不重複：大組動梯接力隔離智控鎖】───
                                // ───【539 全局不重複：大組動態接力智控隔離】───
                                if (pass) {
                                    matchCount++; 
                                    if (vipValidPool.length < targetCount) {
                                        // ⚡ 核心修復：調用全局大組自癒接力矩陣，字面上只要被出廠過就絕對不重疊！
                                        if (checkAndRegisterSmart接力(comb)) {
                                            vipValidPool.push(comb);
                                        }
                                    }
                                }

                                // 🌊 539 異步串流進度隨抽樣快取，每 15 萬組實時噴回手機前端 🌊
                                if (totalScanned % 150000 === 0) {
                                    let percent = Math.floor((totalScanned / 575757) * 100);
                                    if (percent > 100) percent = 100;
                                    res.write(JSON.stringify({ isProgress: true, percent: percent, currentMatch: matchCount }) + "\n");
                                }

                                // 限制單次最大產出緩衝，防禦免費記憶體池
                                if (vipValidPool.length >= targetCount) {
                                    break lotto539FastLoop;
                                }
@@ -378,11 +365,10 @@ app.post('/api/lottery/generate-vip-turbo', async (req, res) => {
                }
            }
        } // 🎯 閉合 539 主軌道
        // =========================================================================
        // 【第三區塊 - 零件 A】：大樂透分流起點、火箭筒級預過濾與 1-8 基礎物理防線
        // =========================================================================
// =========================================================================
// 【零件 4】：大樂透超導分流、火箭筒級位元預過濾與 1-8 基礎物理防線
// =========================================================================
        else {
            // 驅動開機預載的 Fisher-Yates 隨機指針陣列，徹底打破覆蓋偏向！
            initLotto49Matrix(); 

            let f2_min = parseInt(cfg.f2_min, 10) || 15;
@@ -394,15 +380,13 @@ app.post('/api/lottery/generate-vip-turbo', async (req, res) => {
            const chunkSize = 3495954; 
            let currentPointerIdx = 0;

            // 🚀 核心黑科技：大樂透超導非同步時間切片 Chunking 核心處理器
            // 🚀 核心黑科技：大樂透非同步時間切片 Chunking 核心處理器
            async function runSliceChunk(startK, endK) {
                for (let k = startK; k < endK; k++) {
                    // 在 0 記憶體負擔下精確擊穿時脈限制，直接解壓一維矩陣資料
                    let matrixId = globalLotto49Indices[currentPointerIdx++];
                    let bytePos = matrixId * 6;

                    let i1 = globalLotto49Matrix[bytePos];
                    // ⚡ 【火箭筒預過濾機制 1】：第一碼直接撞擊地雷號與熱區邊界，不合直接斬斷並跳過！
                    if (cfg.f1_on && f1_set.has(i1)) continue;
                    if (cfg.f2_on && i1 >= f2_min) continue;

@@ -419,18 +403,15 @@ app.post('/api/lottery/generate-vip-turbo', async (req, res) => {
                    if (cfg.f1_on && f1_set.has(i5)) continue;

                    let i6 = globalLotto49Matrix[bytePos + 5];
                    // ⚡ 【火箭筒預過濾機制 2】：尾碼直接撞擊地雷號與尾界熱區，不合直接斬斷！
                    if (cfg.f1_on && f1_set.has(i6)) continue;
                    if (cfg.f2_on && i6 <= f2_max) continue;

                    totalScanned++;
                    let pass = true;
                    let comb = [i1, i2, i3, i4, i5, i6];

                    // 【防線 2】：歷史全中全重疊排除
                    if (historyCacheSet.has(comb.join(','))) pass = false;

                    // 【防線 5/條件 3】：五大物理區塊落點個數控制
                    if (pass && cfg.f3_on) {
                        let zoneSet = new Set();
                        zoneSet.add(Math.min(5, Math.ceil(i1 / 10)))
@@ -442,99 +423,91 @@ app.post('/api/lottery/generate-vip-turbo', async (req, res) => {
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
                        // 【第三區塊 - 零件 B】：大樂透高階防線對撞、階梯大組自癒接力與切片釋放核心
                        // =========================================================================
                        // 【防線 9/條件 13】：大樂透數字複雜度 (AC值) 獨立過濾
                        if (pass && cfg.f13_on) {
                            let diffs = new Set();
                            for (let m = 0; m < 6; m++) {
                                for (let n = m + 1; n < 6; n++) { 
                                    diffs.add(Math.abs(comb[m] - comb[n])); 
                                }
// =========================================================================
// 【零件 5】：大樂透高階防線對撞、大組隔離自癒、串流結果封裝與資料庫啟動監聽
// =========================================================================
                    if (pass && cfg.f13_on) {
                        let diffs = new Set();
                        for (let m = 0; m < 6; m++) {
                            for (let n = m + 1; n < 6; n++) { 
                                diffs.add(Math.abs(comb[m] - comb[n])); 
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
                        if ((diffs.size - 5) < cfg.f13_min) pass = false; 
                    }
                    
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
                        
                        // ───【大樂透全局不重複：大組動梯接力隔離智控鎖】───
                        if (pass) {
                            matchCount++; 
                            if (vipValidPool.length < targetCount) {
                                // ⚡ 核心修復：調用全局大組自癒接力矩陣，字面上只要被出廠過就絕對不重疊！
                                if (checkAndRegisterSmart接力(comb)) {
                                    vipValidPool.push(comb);
                                }
                    }
                    
                    // ───【大樂透全局不重複：大組動態接力智控隔離】───
                    if (pass) {
                        matchCount++; 
                        if (vipValidPool.length < targetCount) {
                            if (checkAndRegisterSmart接力(comb)) {
                                vipValidPool.push(comb);
                            }
                        }
                    }

                } // 🎯 閉合單個 Chunk 的 for 迴圈
                    if (vipValidPool.length >= targetCount) {
                        break;
                    }
                } 

                // 大樂透即時進度％數隨時間切片，不間斷透過 HTTP 管道噴回手機螢幕 🌊 🌊
                let percent = Math.floor((totalScanned / matrixLength) * 100);
                if (percent > 100) percent = 100;
                res.write(JSON.stringify({ isProgress: true, percent: percent, currentMatch: matchCount }) + "\n");

                // 🚀 【時間切片關鍵點】：精確交還執行緒控制權，阻斷硬體中斷與當機 🚀
                if (totalScanned < matrixLength && vipValidPool.length < targetCount) {
                    await new Promise(resolve => setImmediate(resolve));
                }
            }

            // 依序驅動 4 大切片快取，搾乾雲端核心時脈！
            if (vipValidPool.length < targetCount) await runSliceChunk(0, chunkSize);
            if (vipValidPool.length < targetCount) await runSliceChunk(chunkSize, chunkSize * 2);
            if (vipValidPool.length < targetCount) await runSliceChunk(chunkSize * 2, chunkSize * 3);
            if (vipValidPool.length < targetCount) await runSliceChunk(chunkSize * 3, matrixLength);
        } // 🎯 閉合大樂透主軌道 (else 區塊)
        } // 🎯 閉合大樂透主軌道

        // ⚡ 核心補丁：完美閉合零件 A 開頭的 try 結構，徹底拔除 Missing catch 錯誤！
        // ⚡ 終極防護盾牌：100% 完美閉合超導路由的 try 結構，徹底滅殺 Missing catch 惡夢！
        if (vipValidPool.length === 0) {
            return res.write(JSON.stringify({ success: false, message: "符合防線有效組合為 0 組，請放寬過濾標準！" }) + "\n");
        }
@@ -554,7 +527,6 @@ app.post('/api/lottery/generate-vip-turbo', async (req, res) => {
    }
});


// =================【智能備份/同步明牌 API 接口】=================
app.post('/api/tickets/save', async (req, res) => {
    try {
@@ -579,9 +551,8 @@ app.get('/api/tickets/list', async (req, res) => {
    }
});

// =================【環境埠位配置與雙層保險滿血啟動】=================
// =================【環境埠位配置與環境變數激活監聽】=================
const PORT = process.env.PORT || 10000;
// 雙層防禦機制：自動適應 Render 表格變數與代碼內置盾牌
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb+srv://bingooo16888_db_user:bingo19880429@cluster0.t33ebvn.mongodb.net/lotto?retryWrites=true&w=majority&appName=Cluster0";

app.listen(PORT, () => { 
@@ -593,7 +564,3 @@ if (MONGO_URI) {
        .then(() => { console.log("🟢 MongoDB 雲端大腦握手成功！"); })
        .catch(err => { console.error("❌ 資料庫連線跳過:", err.message); });
}

// =========================================================================
// ───【2026 終極原廠融合完全體 server.js 全線正式通車！】───
// =========================================================================
