// 测试模块加载
async function testLoad() {
  try {
    console.log('Loading module...');
    
    // 模拟 Workers 环境
    global.fetch = async (url, options) => {
      console.log('Mock fetch:', url);
      return {
        json: async () => ({ ok: true }),
        text: async () => 'OK'
      };
    };
    
    const module = await import('./src/index.debug2.js');
    console.log('✅ Module loaded successfully');
    console.log('Exports:', Object.keys(module));
    console.log('Has default export:', !!module.default);
    console.log('Has fetch:', !!module.default?.fetch);
  } catch (error) {
    console.error('❌ Failed to load module:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testLoad();
