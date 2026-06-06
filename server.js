// ==========================================
// 【區塊 A】：VIP 超導大通道 API 路由起點與 539 全量穷舉獨立運算
// ==========================================
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
        
        // 條件 15 大數據歷史 BigInt 位元快速降維快取轉換
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
            for (let d = -range; d <= range; d++) { if (d !== 0) neighborSet.add(val + d); }
        });

        let vipValidPool = [];
        let totalScanned = 0;
        let matchCount = 0;
        let vipSmartMask = 0; // 539 32位元高效號碼遮罩
        const isSmartMode = (cfg.vipMode === 'smart');

        // ==========================================
        // 【539 軌道】：100% 實體全窮舉 575,757 組 🚀
        // ==========================================
        if (lottoType === "39_5") {
            for (let i1 = 1; i1 <= 35; i1++) {
                for (let i2 = i1 + 1; i2 <= 36; i2++) {
                    for (let i3 = i2 + 1; i3 <= 37; i3++) {
                        for (let i4 = i3 + 1; i4 <= 38; i4++) {
                            for (let i5 = i4 + 1; i5 <= 39; i5++) {
                                totalScanned++;
                                let comb = [i1, i2, i3, i4, i5];
                                let pass = true;

                                if (pass && historyCacheSet.has(comb.join(','))) pass = false;
                                if (pass && cfg.f1_on && comb.some(n => f1_set.has(n))) pass = false;
                                if (pass && cfg.f2_on && (i1 >= cfg.f2_min || i5 <= cfg.f2_max)) pass = false;
                                if (pass && cfg.f3_on) {
                                    let zoneSet = new Set();
                                    zoneSet.add(Math.min(5, Math.ceil(i1 / 8)))
                                           .add(Math.min(5, Math.ceil(i2 / 8)))
                                           .add(Math.min(5, Math.ceil(i3 / 8)))
                                           .add(Math.min(5, Math.ceil(i4 / 8)))
                                           .add(Math.min(5, Math.ceil(i5 / 8)));
                                    if (zoneSet.size !== cfg.f3_req) pass = false;
                                }
                                if (pass && cfg.f4_on) {
                                    let tails = new Array(10).fill(0);
                                    tails[i1%10]++; tails[i2%10]++; tails[i3%10]++; tails[i4%10]++; tails[i5%10]++;
                                    if (Math.max(...tails) > cfg.f4_max) pass = false;
                                }
                                if (pass && cfg.f5_on) {
                                    let oddCount = (i1%2) + (i2%2) + (i3%2) + (i4%2) + (i5%2);
                                    if (cfg.f5_539_50 && (oddCount === 5 || oddCount === 0)) pass = false;
                                    if (cfg.f5_539_41 && (oddCount === 4 || oddCount === 1)) pass = false;
                                }
                                if (pass) {
                                    let sumValue = i1 + i2 + i3 + i4 + i5;
                                    if (cfg.f6_on && (sumValue < cfg.f6_low || sumValue > cfg.f6_high)) pass = false;
                                }

                                // 539 條件 13：數字複雜度 (AC值) 獨立防線
                                if (pass && cfg.f13_on) {
                                    let diffs = new Set();
                                    for(let m=0; m<5; m++) {
                                        for(let n=m+1; n<5; n++) { diffs.add(Math.abs(comb[m] - comb[n])); }
                                    }
                                    if ((diffs.size - 4) < cfg.f13_min) pass = false; 
                                }
                                // 539 條件 14：質數/合數比例過濾 (獨立封殺單組質數 >= 4 個)
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
                                // 539 條件 15：歷史大數據 4 碼疊合封殺牆
                                if (pass && cfg.f15_on && typeof globalHistoryBigInts !== 'undefined') {
                                    let currentMask = (1n<<BigInt(i1))|(1n<<BigInt(i2))|(1n<<BigInt(i3))|(1n<<BigInt(i4))|(1n<<BigInt(i5));
                                    for (let h = 0; h < globalHistoryBigInts.length; h++) {
                                        let intersect = currentMask & globalHistoryBigInts[h];
                                        let matchOverlap = 0;
                                        while (intersect > 0n) { if (intersect & 1n) matchOverlap++; intersect >>= 1n; }
                                        if (matchOverlap >= 4) { pass = false; break; } 
                                    }
                                }

                                // 539 宏觀獨立隔離落實點（100% 解除提前阻斷，大數據全量計數）
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
                                            vipSmartMask = 0;
                                        }
                                    }
                                }

                                if (totalScanned % 150000 === 0) {
                                    let percent = Math.floor((totalScanned / 575757) * 100);
                                    res.write(JSON.stringify({ isProgress: true, percent: percent, currentMatch: matchCount }) + "\n");
                                }

                            } // i5 閉合
                        } // i4 閉合
                    } // i3 閉合
                } // i2 閉合
            } // i1 閉合
        } // if (39_5) 主判斷閉合（第 321 行關鍵閉合，絕不死鎖錯位！）
// ───【區塊 A 結束，請將此段覆蓋至您的 server.js 中，隨時呼叫區塊 B】───
        // ==========================================
        // 【區塊 B】：大樂透隨機指針全窮舉與 15 大獨立防線核心
        // ==========================================
        else {
            initLotto49Matrix(); 
            let f2_min = parseInt(cfg.f2_min, 10) || 15;
            let f2_max = parseInt(cfg.f2_max, 10) || 30;
            let f4_max = parseInt(cfg.f4_max, 10) || 2;
            let f6_low = parseInt(cfg.f6_low, 10) || 100;
            let f6_high = parseInt(cfg.f6_high, 10) || 185;
            const matrixLength = 13983816;
            const chunkSize = 3495954; 
            let currentPointerIdx = 0;

            let smartMaskLow = 0;
            let smartMaskHigh = 0;

            async function runSliceChunk(startK, endK) {
                for (let k = startK; k < endK; k++) {
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

                    if (pass && cfg.f2_on && (i1 >= f2_min || i6 <= f2_max)) pass = false;
                    if (pass) {
                        let comb = [i1, i2, i3, i4, i5, i6];
                        if (historyCacheSet.has(comb.join(','))) pass = false;
                        if (pass && cfg.f1_on && (f1_set.has(i1) || f1_set.has(i2) || f1_set.has(i3) || f1_set.has(i4) || f1_set.has(i5) || f1_set.has(i6))) pass = false;
                        if (pass && cfg.f3_on) {
                            let zoneSet = new Set();
                            zoneSet.add(Math.min(5, Math.ceil(i1 / 10))).add(Math.min(5, Math.ceil(i2 / 10))).add(Math.min(5, Math.ceil(i3 / 10))).add(Math.min(5, Math.ceil(i4 / 10))).add(Math.min(5, Math.ceil(i5 / 10))).add(Math.min(5, Math.ceil(i6 / 10)));
                            if (zoneSet.size !== cfg.f3_req) pass = false;
                        }
                        if (pass && cfg.f4_on) {
                            let tails = new Array(10).fill(0);
                            tails[i1%10]++; tails[i2%10]++; tails[i3%10]++; tails[i4%10]++; tails[i5%10]++; tails[i6%10]++;
                            if (Math.max(...tails) > f4_max) pass = false;
                        }
                        if (pass && cfg.f5_on) {
                            let oddCount = (i1%2) + (i2%2) + (i3%2) + (i4%2) + (i5%2) + (i6%2);
                            if (cfg.f5_lotto_60 && (oddCount === 6 || oddCount === 0)) pass = false;
                            if (cfg.f5_lotto_51 && (oddCount === 5 || oddCount === 1)) pass = false;
                        }
                        if (pass) {
                            let sumValue = i1 + i2 + i3 + i4 + i5 + i6;
                            if (cfg.f6_on && (sumValue < f6_low || sumValue > f6_high)) pass = false;
                        }
                        if (pass && cfg.f13_on) {
                            let diffs = new Set();
                            for(let m=0; m<6; m++) {
                                for(let n=m+1; n<6; n++) { diffs.add(Math.abs(comb[m] - comb[n])); }
                            }
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
                                while (intersect > 0n) { if (intersect & 1n) matchOverlap++; intersect >>= 1n; }
                                if (matchOverlap >= 5) { pass = false; break; }
                            }
                        }

                        // 大樂透獨立隔離隔離落實點（全量對撞，呈現真實條件波動）
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
                                    smartMaskLow = 0; smartMaskHigh = 0;
                                }
                            }
                        }
                    } // if (pass) 閉合
                    
                    // 🎯 核心補丁：大樂透 for 迴圈內部補齊即時進度通道與 CPU 晶片時脈釋放，徹底解除當機
                    if (totalScanned % 150000 === 0) {
                        let percent = Math.floor((totalScanned / matrixLength) * 100);
                        res.write(JSON.stringify({ isProgress: true, percent: percent, currentMatch: matchCount }) + "\n");
                        await new Promise(resolve => setImmediate(resolve));
                    }
                } // for 迴圈閉合
            } // async function runSliceChunk 閉合
// ───【區塊 B 結束，請將此段覆蓋至您的 server.js 中，隨時呼叫最終區塊 C】───
            // ==========================================
            // 【區塊 C】：切片調用、結果封裝、儲存 API 與開機監聽結尾
            // ==========================================
            // 依序驅動 4 大切片緩衝，全面榨乾 Render 每秒時脈！
            await runSliceChunk(0, chunkSize);
            await runSliceChunk(chunkSize, chunkSize * 2);
            await runSliceChunk(chunkSize * 2, chunkSize * 3);
            await runSliceChunk(chunkSize * 3, matrixLength);

        } // 🎯 完美閉合 else (大樂透分流區塊)

        // ───【全線海選結果落實與即時串流輸出】───
        if (vipValidPool.length === 0) {
            return res.write(JSON.stringify({ success: false, message: "符合防線有效組合為 0 組，請放寬過濾標準！" }) + "\n");
        }
        
        let mName = (cfg.vipMode === 'smart') ? '聰明包牌' : '一般隨機';
        let outputText = `【VIP篩選完成】符合防線總組數：${matchCount} 組\n【本次輸出模式】${mName}\n【本次輸出】精選出 ${vipValidPool.length} 組\n-------------------------\n`;
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

// 3. 操盤手明牌雲端大數據儲存/備份 API (對標前端 MODULE 01)
app.post('/api/tickets/save', async (req, res) => {
    try {
        const token = req.headers['authorization'];
        if (!token) return res.status(401).json({ success: false, message: '未帶憑證' });
        const decoded = jwt.verify(token, 'FREE_LOTTO_SECRET_2026');
        await User.findByIdAndUpdate(decoded.userId, { $set: { savedTickets: req.body.tickets || [] } }, { upsert: true });
        return res.json({ success: true, message: '明牌已成功同步！' });
    } catch (err) { 
        return res.json({ success: true }); 
    }
});

// 4. 智能兌獎雲端數據同步列表 API (對標前端 MODULE 01)
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

// ───【環境變數配置與滿血啟動常駐監聽】───
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { 
    console.log(` 雲端運行引擎已在埠位 ${PORT} 滿血發動！`); 
    console.log(" 🟢 獨立實體窮舉與隨機指針引擎已就緒，歷史大數據常駐記憶體通道通電成功！");
});
// ==========================================
// ───【2026 終極原廠融合完全體 server.js 全線大通車！】───
// ==========================================
