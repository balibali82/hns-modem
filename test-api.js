// Google Cloud Vision API 테스트 스크립트
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API 키 확인
const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

if (!apiKey || apiKey === 'your_api_key_here') {
  console.error('❌ API 키가 설정되지 않았습니다.');
  console.log('환경 변수를 설정하세요:');
  console.log('PowerShell: $env:GOOGLE_CLOUD_VISION_API_KEY="your_api_key"');
  console.log('CMD: set GOOGLE_CLOUD_VISION_API_KEY=your_api_key');
  process.exit(1);
}

console.log('✅ API 키 확인됨:', apiKey.substring(0, 20) + '...');

// 테스트 이미지가 있는지 확인 (선택사항)
// 실제 바코드 이미지가 있다면 base64로 변환하여 테스트 가능

console.log('\n📝 API 엔드포인트 테스트 준비 완료');
console.log('브라우저에서 http://localhost:3000 접속하여 바코드 스캔을 테스트하세요.\n');

// 간단한 API 테스트 (더미 이미지)
async function testAPI() {
  try {
    // 더미 base64 이미지 (1x1 픽셀 PNG)
    const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    const response = await fetch('http://localhost:3000/api/recognize-barcode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64: dummyImage })
    });

    const result = await response.json();
    console.log('API 응답:', result);
    
    if (result.error && result.error.includes('API 키')) {
      console.log('⚠️  API 키 설정을 확인하세요.');
    } else {
      console.log('✅ API 엔드포인트가 정상적으로 작동합니다.');
    }
  } catch (error) {
    console.error('❌ API 테스트 실패:', error.message);
    console.log('💡 개발 서버가 실행 중인지 확인하세요: npm run dev');
  }
}

// 개발 서버가 실행 중일 때만 테스트
setTimeout(() => {
  testAPI();
}, 2000);

