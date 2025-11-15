import { useState, useRef, useEffect } from 'react';

const BarcodeScanner = ({ onBarcodeScanned, isMobile }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [scanStatus, setScanStatus] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const imageTimeoutRef = useRef(null);
  const scanIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

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

  const startScanning = async () => {
    try {
      setError(null);
      
      const constraints = {
        video: {
          facingMode: 'environment', // 후면 카메라 사용
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', true);
        videoRef.current.setAttribute('webkit-playsinline', true);
        videoRef.current.muted = true;
        
        // 비디오가 로드될 때까지 대기
        await new Promise((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('비디오 요소가 없습니다.'));
            return;
          }
          
          const video = videoRef.current;
          
          const onLoadedMetadata = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            resolve();
          };
          
          const onError = (e) => {
            video.removeEventListener('error', onError);
            reject(new Error('비디오 로드 실패'));
          };
          
          video.addEventListener('loadedmetadata', onLoadedMetadata);
          video.addEventListener('error', onError);
          
          // 타임아웃 설정 (5초)
          setTimeout(() => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            reject(new Error('비디오 로드 타임아웃'));
          }, 5000);
        });
        
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.error('비디오 재생 오류:', playError);
          throw new Error('비디오 재생에 실패했습니다. 브라우저 권한을 확인해주세요.');
        }
      }

      setIsScanning(true);
      setScanStatus('바코드를 스캔 중... (Google Vision API 사용)');

      // 주기적으로 프레임을 캡처하여 바코드 인식
      let scanAttempts = 0;
      let isProcessing = false;
      scanIntervalRef.current = setInterval(async () => {
        if (isProcessing || !videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
          return;
        }

        try {
          isProcessing = true;
          scanAttempts++;

          // 비디오 프레임을 캔버스에 그리기
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(videoRef.current, 0, 0);
          
          // base64로 변환
          const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

          // Google Vision API로 바코드 인식
          const barcodeText = await recognizeBarcodeFromImage(imageBase64);
          
          if (barcodeText) {
            setScanStatus(`인식 시도: ${scanAttempts}회 - "${barcodeText}"`);
            
            // 숫자로 시작하는 22자리 바코드 패턴 검증
            if (/^[0-9][A-Za-z0-9]{21}$/.test(barcodeText)) {
              if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current);
                scanIntervalRef.current = null;
              }
              setScanStatus('바코드 인식 성공!');
              handleBarcodeFound(barcodeText);
            } else if (barcodeText.length > 0) {
              setScanStatus(`인식된 번호: "${barcodeText}" (${barcodeText.length}자리) - 숫자로 시작하는 22자리 바코드가 아닙니다.`);
              isProcessing = false;
            } else {
              isProcessing = false;
            }
          } else {
            isProcessing = false;
          }
        } catch (err) {
          // 인식 실패는 무시하고 계속 시도
          if (scanAttempts % 10 === 0) {
            setScanStatus(`스캔 중... (${scanAttempts}회 시도)`);
          }
          isProcessing = false;
        }
      }, 1000); // 1초마다 스캔
    } catch (err) {
      setError('카메라 접근에 실패했습니다. 카메라 권한을 확인해주세요.');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    setScanStatus('');
  };

  const capturePhoto = () => {
    if (!videoRef.current || !isScanning) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `barcode_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onBarcodeScanned(file, null);
      }
    }, 'image/jpeg', 0.9);
  };

  const handleBarcodeFound = async (barcodeText) => {
    // 바코드 번호를 찾았을 때 사진 캡처
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `barcode_${Date.now()}.jpg`, { type: 'image/jpeg' });
          onBarcodeScanned(file, barcodeText);
          stopScanning();
        }
      }, 'image/jpeg', 0.9);
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

  const handleFileInput = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null);
    setScanStatus('이미지 압축 중...');

    try {
      // 모바일 사진은 크기가 크므로 압축
      let imageBase64;
      if (file.size > 1024 * 1024) { // 1MB 이상이면 압축
        setScanStatus('이미지 압축 중... (큰 이미지)');
        imageBase64 = await compressImage(file, 1920, 1920, 0.7);
      } else {
        imageBase64 = await fileToBase64(file);
      }
      
      setScanStatus('Google Vision API로 바코드 분석 중...');
      
      // Google Vision API로 바코드 인식
      const barcodeText = await recognizeBarcodeFromImage(imageBase64);

      if (barcodeText) {
        setScanStatus(`인식된 번호: "${barcodeText}"`);
        
        // 잠시 표시 후 처리
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 숫자로 시작하는 22자리 바코드 검증
        if (/^[0-9][A-Za-z0-9]{21}$/.test(barcodeText)) {
          onBarcodeScanned(file, barcodeText);
          setScanStatus('');
        } else {
          setError(`인식된 번호: "${barcodeText}" (${barcodeText.length}자리) - 숫자로 시작하는 22자리 바코드가 아닙니다.`);
          setScanStatus('');
        }
      } else {
        setError('바코드를 인식할 수 없습니다. 바코드가 선명하고 전체가 보이는지 확인해주세요.');
        setScanStatus('');
      }
    } catch (err) {
      console.error('바코드 인식 오류:', err);
      setError(err.message || '바코드를 인식할 수 없습니다. 이미지 품질을 확인해주세요.');
      setScanStatus('');
    }
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

      {!isScanning ? (
        <div>
          {isMobile ? (
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileInput}
              style={{ display: 'none' }}
              id="camera-input"
            />
          ) : (
            <input
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              style={{ display: 'none' }}
              id="file-input"
            />
          )}
          <button
            className="btn btn-primary"
            onClick={() => {
              if (isMobile) {
                document.getElementById('camera-input').click();
              } else {
                document.getElementById('file-input').click();
              }
            }}
          >
            {isMobile ? '카메라로 촬영' : '사진 선택'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={startScanning}
            style={{ marginLeft: '10px' }}
          >
            실시간 스캔 시작
          </button>
        </div>
      ) : (
        <div>
          <div className="scanner-container">
            <video
              ref={videoRef}
              className="scanner-video"
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: 'auto',
                backgroundColor: '#000',
                display: 'block',
                minHeight: '300px'
              }}
            />
            <div className="scanner-overlay">
              <div className="scanner-frame"></div>
            </div>
          </div>
          <div className="scanner-controls">
            <button className="btn btn-primary" onClick={capturePhoto}>
              사진 촬영 (수동)
            </button>
            <button className="btn btn-danger" onClick={stopScanning}>
              중지
            </button>
          </div>
          <div style={{ 
            marginTop: '10px', 
            padding: '10px', 
            backgroundColor: '#fff3e0', 
            borderRadius: '8px',
            fontSize: '13px',
            color: '#e65100'
          }}>
            💡 팁: 바코드를 스캔 프레임 중앙에 맞추고 카메라를 바코드에 가까이 대세요.
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;


