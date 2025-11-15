// 로컬 개발용 서버 (Vercel API Routes 테스트)
import express from 'express';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Vite 개발 서버 먼저 생성
const vite = await createViteServer({
  server: { middlewareMode: true }
});

// CORS 헤더 설정 (개발 환경)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// JSON 파싱 미들웨어 (API Routes보다 먼저)
app.use(express.json({ limit: '10mb' }));

// .well-known 경로 무시 (Chrome DevTools 관련)
app.get('/.well-known/*', (req, res) => {
  res.status(404).end();
});

// API Routes 처리 (Vite 미들웨어보다 먼저)
app.use('/api', async (req, res, next) => {
  try {
    // 파일명 추출 (예: /api/recognize-barcode -> recognize-barcode)
    const pathParts = req.path.split('/').filter(p => p);
    const fileName = pathParts[0] || 'recognize-barcode';
    
    // Vercel API Routes 형식으로 처리
    const apiPath = join(__dirname, 'api', fileName + '.js');
    
    // Windows에서 file:// URL로 변환
    const apiUrl = pathToFileURL(apiPath).href;
    
    // 동적 import
    const handler = await import(apiUrl);
    
    // Vercel 형식의 req/res 래퍼
    const vercelReq = {
      method: req.method,
      body: req.body,
      query: req.query,
      headers: req.headers
    };
    
    const vercelRes = {
      status: (code) => {
        res.status(code);
        return vercelRes;
      },
      json: (data) => {
        res.json(data);
        return vercelRes;
      },
      text: async (data) => {
        if (typeof data === 'string') {
          res.send(data);
        } else {
          res.send(JSON.stringify(data));
        }
        return vercelRes;
      },
      send: (data) => {
        res.send(data);
        return vercelRes;
      },
      header: (name, value) => {
        res.header(name, value);
        return vercelRes;
      },
      headersSent: false,
      get headersSent() {
        return res.headersSent;
      }
    };
    
    await handler.default(vercelReq, vercelRes);
  } catch (error) {
    console.error('API 라우트 오류:', error);
    console.error('스택:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: error.message || '서버 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
});

// Vite 개발 서버 미들웨어 (모든 다른 요청 처리)
app.use(vite.middlewares);

app.listen(PORT, () => {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  
  console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
  console.log('');
  
  // Google Cloud Vision API 키 확인
  if (apiKey) {
    console.log(`📝 Google Vision API 키: ✅ 설정됨 (${apiKey.substring(0, 20)}...)`);
  } else {
    console.log(`📝 Google Vision API 키: ❌ 설정 필요`);
    console.log(`💡 PowerShell에서 다음 명령어를 실행하세요:`);
    console.log(`   $env:GOOGLE_CLOUD_VISION_API_KEY="your_api_key_here"`);
    console.log(`   또는 npm run dev:set 사용`);
  }
  
  console.log('');
  
  // SMTP 설정 확인
  if (smtpHost && smtpUser && smtpPass) {
    console.log(`📧 SMTP 설정: ✅ 완료`);
    console.log(`   - SMTP_HOST: ${smtpHost}`);
    console.log(`   - SMTP_PORT: ${process.env.SMTP_PORT || '587'}`);
    console.log(`   - SMTP_USER: ${smtpUser}`);
  } else {
    console.log(`📧 SMTP 설정: ❌ 미완료`);
    const missing = [];
    if (!smtpHost) missing.push('SMTP_HOST');
    if (!smtpUser) missing.push('SMTP_USER');
    if (!smtpPass) missing.push('SMTP_PASS');
    console.log(`   누락된 환경 변수: ${missing.join(', ')}`);
    console.log(`💡 PowerShell에서 다음 명령어를 실행하세요:`);
    missing.forEach(v => {
      console.log(`   $env:${v}="your_value_here"`);
    });
  }
  
  console.log('');
});

