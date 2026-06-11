const fs = require('fs');
const vm = require('vm');

try {
  // 精密讀取您的原始程式碼檔案
  const code = fs.readFileSync('server.js', 'utf8');
  
  console.log("正在驅動 Node.js 核心底層解析器進行晶片級掃描...");
  
  // 強制讓 Node.js 底層編譯器進行靜態語法樹結構碰撞
  new vm.Script(code, { filename: 'server.js' });
  
  console.log("語法完全合規！沒有任何括號遺漏！");
} catch (err) {
  console.log("\n==================================================");
  console.log("❌ 成功精確攔截到語法破口！真正答案如下：");
  console.log("==================================================");
  
  // 100% 吐出真正缺失括號的源頭行數與錯誤堆疊
  console.error(err.stack);
  console.log("==================================================");
}
