import { useState } from 'react';

const BarcodeScanner = ({ onBarcodeScanned, onBarcodesBatch, isMobile, maxCount, currentCount }) => {
  const [error, setError] = useState(null);
  const [scanStatus, setScanStatus] = useState('');
  const [processingFiles, setProcessingFiles] = useState([]);

  const recognizeBarcodeFromImage = async (imageBase64) => {
    try {
      const response = await fetch('/api/recognize-barcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64 })
      });

      // 응답 본문 읽기 (한 번만 읽을 수 있음)
      const text = await response.text();
      
      // 응답 상태 확인
      if (!response.ok) {
        let errorMessage = '바코드 인식에 실패했습니다.';
        if (text && text.trim() !== '') {
          try {
            const errorJson = JSON.parse(text);
            errorMessage = errorJson.error || errorMessage;
            if (errorJson.details) {
              console.error('서버 에러 상세:', errorJson.details);
            }
          } catch (e) {
            errorMessage = text || errorMessage;
          }
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // 응답 본문 확인
      if (!text || text.trim() === '') {
        throw new Error('서버에서 빈 응답을 받았습니다.');
      }

      // JSON 파싱
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseError) {
        console.error('JSON 파싱 오류:', parseError, '응답:', text);
        throw new Error('서버 응답을 파싱할 수 없습니다.');
      }

      if (result.success && result.barcode) {
        return result.barcode;
      } else {
        // 디버깅: 서버 응답 확인
        console.error('서버 응답:', result);
        console.error('서버 응답 상세:', JSON.stringify(result, null, 2));
        if (result.details) {
          console.error('서버 응답 details:', result.details);
        }
        throw new Error(result.error || '바코드를 인식할 수 없습니다.');
      }
    } catch (error) {
      console.error('바코드 인식 API 오류:', error);
      throw error;
    }
  };

  // 이미지 압축 함수
  const compressImage = (file, maxWidth = 1920, maxHeight = 1920, quality = 0.7) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 비율 유지하면서 리사이즈
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            } else {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // 압축된 이미지를 base64로 변환
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
    });
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const processFile = async (file, index, total) => {
    try {
      setScanStatus(`처리 중: ${index + 1}/${total} - ${file.name}`);

      // 모바일 사진은 크기가 크므로 압축
      let imageBase64;
      if (file.size > 1024 * 1024) { // 1MB 이상이면 압축
        imageBase64 = await compressImage(file, 1920, 1920, 0.7);
      } else {
        imageBase64 = await fileToBase64(file);
      }
      
      setScanStatus(`바코드 분석 중: ${index + 1}/${total} - ${file.name}`);
      
      // Google Vision API로 바코드 인식
      const barcodeText = await recognizeBarcodeFromImage(imageBase64);

      if (barcodeText) {
        // 숫자로 시작하는 22자리 바코드 검증
        if (/^[0-9][A-Za-z0-9]{21}$/.test(barcodeText)) {
          return { success: true, file, barcode: barcodeText };
        } else {
          // 바코드 형식이 맞지 않아도 파일은 추가 (바코드 번호 없이)
          return { success: false, file, barcode: null, error: `인식된 번호: "${barcodeText}" (${barcodeText.length}자리) - 숫자로 시작하는 22자리 바코드가 아닙니다.` };
        }
      } else {
        // 바코드를 인식하지 못해도 파일은 추가 (바코드 번호 없이)
        return { success: false, file, barcode: null, error: '바코드를 인식할 수 없습니다.' };
      }
    } catch (err) {
      console.error('바코드 인식 오류:', err);
      // 에러가 발생해도 파일은 추가 (바코드 번호 없이)
      return { success: false, file, barcode: null, error: err.message || '바코드를 인식할 수 없습니다.' };
    }
  };

  const handleFileInput = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 최대 개수 체크
    const remainingSlots = maxCount - currentCount;
    if (remainingSlots <= 0) {
      setError(`최대 ${maxCount}개까지 업로드할 수 있습니다.`);
      e.target.value = ''; // input 초기화
      return;
    }

    // 선택한 파일 수가 남은 슬롯보다 많으면 제한
    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setError(`${files.length}개를 선택했지만, 최대 ${maxCount}개까지만 업로드 가능합니다. ${remainingSlots}개만 처리합니다.`);
    } else {
      setError(null);
    }

    setScanStatus('');
    setProcessingFiles(filesToProcess.map(f => f.name));

    // 각 파일을 순차적으로 처리
    const results = [];
    for (let i = 0; i < filesToProcess.length; i++) {
      const result = await processFile(filesToProcess[i], i, filesToProcess.length);
      results.push(result);
    }

    // 처리 완료
    setScanStatus('');
    setProcessingFiles([]);
    
    // 일괄 추가를 위한 데이터 준비
    const itemsToAdd = results.map(r => ({
      file: r.file,
      barcodeNumber: r.barcode || null
    }));

    // 일괄 추가 함수가 있으면 사용, 없으면 개별 추가
    if (onBarcodesBatch) {
      onBarcodesBatch(itemsToAdd);
    } else {
      // 개별 추가 (하위 호환성)
      results.forEach(result => {
        onBarcodeScanned(result.file, result.barcode || null);
      });
    }
    
    // 성공/실패 요약
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    if (failCount > 0 && successCount > 0) {
      // 에러는 일괄 추가 함수에서 처리하므로 여기서는 정보만 표시
      setError(null);
    } else if (successCount === 0 && failCount > 0) {
      setError('모든 파일에서 바코드를 인식하지 못했습니다. (이미지는 추가되었습니다)');
    } else {
      setError(null);
    }

    // input 초기화 (같은 파일을 다시 선택할 수 있도록)
    e.target.value = '';
  };

  return (
    <div className="barcode-section">
      <h2>바코드 스캔</h2>
      
      {error && (
        <div className="error-message">{error}</div>
      )}
      
      {scanStatus && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#e3f2fd', 
          borderRadius: '8px', 
          marginBottom: '15px',
          fontSize: '14px',
          color: '#1976d2'
        }}>
          {scanStatus}
        </div>
      )}

      {processingFiles.length > 0 && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#fff3e0', 
          borderRadius: '8px', 
          marginBottom: '15px',
          fontSize: '13px',
          color: '#e65100'
        }}>
          <div>처리 중인 파일:</div>
          <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
            {processingFiles.map((name, idx) => (
              <li key={idx} style={{ fontSize: '12px' }}>{name}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        {/* 사진 선택 (갤러리) */}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInput}
          style={{ display: 'none' }}
          id="file-input"
        />
        {/* 사진 촬영 (카메라) - 모바일 전용, 여러 장 촬영 가능 */}
        {isMobile && (
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handleFileInput}
            style={{ display: 'none' }}
            id="camera-input"
          />
        )}
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              document.getElementById('file-input').click();
            }}
            disabled={currentCount >= maxCount}
          >
            사진 선택
          </button>
          {isMobile && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                document.getElementById('camera-input').click();
              }}
              disabled={currentCount >= maxCount}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span>📷</span>
              <span>사진 촬영</span>
            </button>
          )}
        </div>
        
        {currentCount >= maxCount && (
          <div style={{ 
            marginTop: '10px', 
            padding: '10px', 
            backgroundColor: '#fff3e0', 
            borderRadius: '8px',
            fontSize: '13px',
            color: '#e65100'
          }}>
            최대 {maxCount}개까지 업로드할 수 있습니다.
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;
