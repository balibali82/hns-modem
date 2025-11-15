// Google Cloud Vision API를 사용한 바코드 인식
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ 
        success: false,
        error: '이미지 데이터가 없습니다.' 
      });
    }

    // base64 데이터에서 data URL prefix 제거
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    
    // 이미지 데이터 크기 확인
    const imageSizeKB = Math.round((base64Data.length * 3) / 4 / 1024);
    console.log('이미지 크기:', imageSizeKB, 'KB');
    
    // Vision API는 최대 20MB까지 지원하지만, 너무 크면 문제가 될 수 있음
    if (imageSizeKB > 20000) {
      console.warn('⚠️ 이미지가 너무 큽니다:', imageSizeKB, 'KB');
    }

    // Google Cloud Vision API 호출
    // 환경 변수에서 API 키 가져오기
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ 
        success: false,
        error: 'Google Cloud Vision API 키가 설정되지 않았습니다. 환경 변수 GOOGLE_CLOUD_VISION_API_KEY를 설정해주세요.' 
      });
    }

    // Vision API 요청
    const visionApiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    
    const requestBody = {
      requests: [
        {
          image: {
            content: base64Data
          },
          features: [
            {
              type: 'TEXT_DETECTION',
              maxResults: 10
            }
          ]
        }
      ]
    };

    const response = await fetch(visionApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorData;
      let errorJson = null;
      try {
        errorData = await response.text();
        // JSON 형식인 경우 파싱
        try {
          errorJson = JSON.parse(errorData);
          errorData = errorJson.error?.message || errorJson.error || errorData;
        } catch (e) {
          // 텍스트 그대로 사용
        }
      } catch (e) {
        errorData = '알 수 없는 오류가 발생했습니다.';
      }
      console.error('Vision API 오류:', errorData);
      console.error('전체 응답:', errorJson || errorData);
      
      // 결제 관련 오류인 경우 사용자 친화적인 메시지
      let errorMessage = '바코드 인식에 실패했습니다.';
      if (errorData && (errorData.includes('billing') || errorData.includes('Billing'))) {
        errorMessage = '결제 계정이 활성화되지 않았거나 아직 전파 중입니다. 다음을 확인해주세요:\n' +
          '1. Google Cloud Console에서 프로젝트에 결제 계정이 연결되었는지 확인\n' +
          '2. Cloud Vision API가 활성화되었는지 확인\n' +
          '3. 결제 계정 연결 후 5-10분 정도 기다린 후 다시 시도';
      }
      
      return res.status(500).json({ 
        success: false,
        error: errorMessage,
        details: errorData,
        fullError: process.env.NODE_ENV === 'development' ? (errorJson || errorData) : undefined
      });
    }

    const result = await response.json();

    // 디버깅: Vision API 응답 확인
    console.log('Vision API 응답 구조 확인:');
    console.log('- result.responses 존재:', !!result.responses);
    console.log('- result.responses[0] 존재:', !!(result.responses && result.responses[0]));
    console.log('- textAnnotations 존재:', !!(result.responses && result.responses[0] && result.responses[0].textAnnotations));
    
    if (result.responses && result.responses[0]) {
      const responseData = result.responses[0];
      const textAnnotations = responseData.textAnnotations || [];
      
      console.log('응답 데이터 키들:', Object.keys(responseData));
      console.log('텍스트 개수:', textAnnotations.length);
      
      // Vision API 응답에 에러가 있는지 확인
      if (responseData.error) {
        console.error('Vision API 에러:', responseData.error);
      }
      
      if (textAnnotations.length > 0) {
        // 첫 번째 텍스트는 전체 텍스트, 나머지는 개별 단어/라인
        const fullText = textAnnotations[0].description || '';
        console.log('인식된 전체 텍스트:', fullText.substring(0, 200));
        
        // 모든 텍스트에서 숫자로 시작하는 22자리 패턴 찾기
        const allTexts = textAnnotations.map(t => t.description || '').filter(t => t.length > 0);
        
        // 방법 1: 각 텍스트 블록에서 직접 검색
        for (const text of allTexts) {
          // 공백, 하이픈, 콜론 등 특수문자 제거 후 검색
          const cleanedText = text.replace(/[^A-Za-z0-9]/g, '');
          
          // 숫자로 시작하는 22자리 패턴 찾기 (숫자가 무조건 맨 앞)
          // 부분 문자열에서도 찾을 수 있도록 ^ $ 제거
          const pattern = /[0-9][A-Za-z0-9]{21}/g;
          const matches = cleanedText.match(pattern);
          
          if (matches) {
            for (const match of matches) {
              // 숫자로 시작하는 정확히 22자리인지 확인
              if (match.length === 22 && /^[0-9]/.test(match)) {
                console.log('✅ 22자리 텍스트 발견:', match);
                return res.status(200).json({
                  success: true,
                  barcode: match,
                  format: 'TEXT_DETECTED',
                  source: 'text_detection',
                  allTexts: allTexts.slice(0, 5) // 처음 5개만 반환
                });
              }
            }
          }
        }
        
        // 방법 2: 전체 텍스트를 합쳐서 검색 (숫자가 무조건 맨 앞)
        const combinedText = allTexts.join(' ').replace(/[^A-Za-z0-9]/g, '');
        const combinedMatches = combinedText.match(/[0-9][A-Za-z0-9]{21}/g);
        
        if (combinedMatches) {
          for (const match of combinedMatches) {
            // 숫자로 시작하는 22자리인지 확인
            if (match.length === 22 && /^[0-9]/.test(match)) {
              console.log('✅ 22자리 텍스트 발견 (전체 텍스트에서):', match);
              return res.status(200).json({
                success: true,
                barcode: match,
                format: 'TEXT_DETECTED',
                source: 'text_detection',
                allTexts: allTexts.slice(0, 5)
              });
            }
          }
        }
        
        // 숫자로 시작하는 22자리를 찾지 못한 경우
        console.log('⚠️ 숫자로 시작하는 22자리 텍스트 없음');
        console.log('인식된 텍스트 샘플:', allTexts.slice(0, 3));
        return res.status(200).json({
          success: false,
          error: '숫자로 시작하는 22자리 텍스트를 찾을 수 없습니다.',
          details: {
            textCount: textAnnotations.length,
            sampleTexts: allTexts.slice(0, 5)
          }
        });
      } else {
        console.log('⚠️ Vision API가 텍스트를 찾지 못함');
        return res.status(200).json({
          success: false,
          error: '이미지에서 텍스트를 찾을 수 없습니다.',
          details: {
            textCount: 0
          }
        });
      }
    } else {
      console.log('⚠️ Vision API 응답 구조가 예상과 다름');
      console.log('전체 응답:', JSON.stringify(result, null, 2));
      return res.status(200).json({
        success: false,
        error: '바코드를 인식할 수 없습니다.',
        details: {
          hasResponses: !!result.responses,
          hasFirstResponse: !!(result.responses && result.responses[0]),
          fullResponse: process.env.NODE_ENV === 'development' ? result : undefined
        }
      });
    }

  } catch (error) {
    console.error('바코드 인식 오류:', error);
    console.error('오류 스택:', error.stack);
    return res.status(500).json({ 
      success: false,
      error: '바코드 인식 중 오류가 발생했습니다.',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

