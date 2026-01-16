const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
  entryPoints: [path.join(__dirname, '../src/lib/chat-core.ts')],
  bundle: true,
  outfile: path.join(__dirname, '../public/chat-core.js'),
  format: 'iife',
  globalName: 'ChatCore',
  platform: 'browser',
  target: 'es2015',
  minify: true
}).then(() => {
  console.log('✅ chat-core.js 打包完成');
}).catch((err) => {
  console.error('❌ 打包失敗:', err);
  process.exit(1);
});
