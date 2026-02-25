#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 构建脚本：安全地优化worker.js为worker.bundle.js
 * 只移除注释，保留代码结构完整性
 */
function buildWorker() {
  console.log('🔨 开始构建 worker.bundle.js...');
  
  const workerPath = path.join(__dirname, '../src/worker.js');
  const bundlePath = path.join(__dirname, '../src/worker.bundle.js');
  
  try {
    // 读取源文件
    const sourceCode = fs.readFileSync(workerPath, 'utf8');
    
    console.log(`📄 读取源文件: ${workerPath} (${sourceCode.length} 字符)`);
    
    // 安全地移除注释，不破坏代码结构
    let optimizedCode = removeCommentsSafely(sourceCode);
    
    // 添加构建信息头
    const buildInfo = `/**
 * Telegram Verification Bot - Bundled Version
 * Built: ${new Date().toISOString()}
 * Source: worker.js
 * Size: ${optimizedCode.length} characters
 */

`;
    
    optimizedCode = buildInfo + optimizedCode;
    
    // 写入bundle文件
    fs.writeFileSync(bundlePath, optimizedCode, 'utf8');
    
    console.log(`✅ 构建完成: ${bundlePath}`);
    console.log(`📊 文件大小: ${sourceCode.length} -> ${optimizedCode.length} 字符`);
    console.log(`📈 压缩率: ${((1 - optimizedCode.length / sourceCode.length) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ 构建失败:', error.message);
    process.exit(1);
  }
}

/**
 * 安全地移除注释，不破坏代码结构
 */
function removeCommentsSafely(code) {
  let result = '';
  let i = 0;
  const len = code.length;
  
  while (i < len) {
    // 检查单行注释
    if (code[i] === '/' && code[i + 1] === '/') {
      // 跳过直到行尾
      while (i < len && code[i] !== '\n') {
        i++;
      }
      continue;
    }
    
    // 检查多行注释
    if (code[i] === '/' && code[i + 1] === '*') {
      // 跳过直到注释结束
      i += 2;
      while (i < len - 1 && !(code[i] === '*' && code[i + 1] === '/')) {
        i++;
      }
      i += 2;
      continue;
    }
    
    // 检查字符串字面量，避免在字符串内误删注释标记
    if (code[i] === '"' || code[i] === '\'' || code[i] === '`') {
      const quote = code[i];
      result += quote;
      i++;
      
      // 处理转义字符
      while (i < len && code[i] !== quote) {
        if (code[i] === '\\') {
          result += code[i];
          i++;
          if (i < len) {
            result += code[i];
            i++;
          }
        } else {
          result += code[i];
          i++;
        }
      }
      
      if (i < len) {
        result += code[i];
        i++;
      }
      continue;
    }
    
    // 普通字符
    result += code[i];
    i++;
  }
  
  // 移除多余的空行，但保留必要的换行
  result = result.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return result;
}

// 执行构建
if (require.main === module) {
  buildWorker();
}

module.exports = { buildWorker, removeCommentsSafely };