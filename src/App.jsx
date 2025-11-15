import { useState, useEffect } from 'react';
import BarcodeScanner from './components/BarcodeScanner';
import BarcodeList from './components/BarcodeList';

const MAX_BARCODES = 30;

function App() {
  const [isMobile, setIsMobile] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [barcodes, setBarcodes] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    // 모바일 감지
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      const isMobileDevice = mobileRegex.test(userAgent.toLowerCase());
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleBarcodeScanned = (file, barcodeNumber) => {
    if (barcodes.length >= MAX_BARCODES) {
      setMessage({ type: 'error', text: `최대 ${MAX_BARCODES}개까지 업로드할 수 있습니다.` });
      return;
    }

    // 중복 바코드 번호 체크
    if (barcodeNumber) {
      const isDuplicate = barcodes.some(barcode => 
        barcode.number && barcode.number.trim() === barcodeNumber.trim()
      );
      
      if (isDuplicate) {
        setMessage({ 
          type: 'error', 
          text: `이미 등록된 바코드 번호입니다: ${barcodeNumber}` 
        });
        return;
      }
    }

    setBarcodes(prev => [...prev, { file, number: barcodeNumber || null }]);
    setMessage(null);
  };

  // 일괄 추가 함수 (중복 검증 포함)
  const handleBarcodesBatch = (items) => {
    if (barcodes.length + items.length > MAX_BARCODES) {
      setMessage({ type: 'error', text: `최대 ${MAX_BARCODES}개까지 업로드할 수 있습니다.` });
      return;
    }

    const existingBarcodes = new Set(
      barcodes
        .filter(b => b.number)
        .map(b => b.number.trim())
    );

    const newBarcodes = [];
    const duplicateBarcodes = [];
    const seenInBatch = new Set();

    for (const item of items) {
      const { file, barcodeNumber } = item;
      
      if (barcodeNumber) {
        const trimmedBarcode = barcodeNumber.trim();
        
        // 기존 목록과 중복 체크
        if (existingBarcodes.has(trimmedBarcode)) {
          duplicateBarcodes.push(trimmedBarcode);
          continue;
        }
        
        // 같은 일괄 처리 내에서 중복 체크
        if (seenInBatch.has(trimmedBarcode)) {
          duplicateBarcodes.push(trimmedBarcode);
          continue;
        }
        
        seenInBatch.add(trimmedBarcode);
      }
      
      newBarcodes.push({ file, number: barcodeNumber || null });
    }

    if (duplicateBarcodes.length > 0) {
      setMessage({ 
        type: 'error', 
        text: `중복된 바코드 번호가 있습니다: ${duplicateBarcodes.join(', ')}` 
      });
    }

    if (newBarcodes.length > 0) {
      setBarcodes(prev => [...prev, ...newBarcodes]);
      if (duplicateBarcodes.length === 0) {
        setMessage(null);
      }
    }
  };

  const handleDeleteBarcode = (index) => {
    setBarcodes(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!employeeId || !/^[A-Za-z0-9]+$/.test(employeeId)) {
      setMessage({ type: 'error', text: 'SwingID는 숫자와 영문 조합이어야 합니다.' });
      return false;
    }

    if (!employeeName || employeeName.trim() === '') {
      setMessage({ type: 'error', text: '이름을 입력해주세요.' });
      return false;
    }

    if (!emailAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
      setMessage({ type: 'error', text: '유효한 이메일 주소를 입력해주세요.' });
      return false;
    }

    if (barcodes.length === 0) {
      setMessage({ type: 'error', text: '최소 1개 이상의 바코드를 업로드해주세요.' });
      return false;
    }

    const validBarcodes = barcodes.filter(b => b.number && b.number.trim() !== '');
    if (validBarcodes.length === 0) {
      setMessage({ type: 'error', text: '인식된 바코드가 없습니다.' });
      return false;
    }

    return true;
  };

  // 이미지 압축 함수 (메일 발송용)
  const compressImageForEmail = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.6) => {
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

  const handleSendEmail = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSending(true);
    setMessage(null);

    try {
      // 바코드 이미지들을 압축하여 base64로 변환 (메일 발송용)
      setMessage({ type: 'info', text: '이미지 압축 중...' });
      
      const barcodeDataWithImages = await Promise.all(
        barcodes.map(async (barcode, index) => {
          let imageBase64 = null;
          if (barcode.file) {
            try {
              // 메일 발송 전에 이미지 압축 (최대 1200px, 품질 60%)
              imageBase64 = await compressImageForEmail(barcode.file, 1200, 1200, 0.6);
              console.log(`이미지 ${index + 1} 압축 완료: ${barcode.file.size} bytes → ${Math.round(imageBase64.length * 0.75)} bytes (예상)`);
            } catch (error) {
              console.error(`이미지 ${index + 1} 압축 실패, 원본 사용:`, error);
              // 압축 실패 시 원본 사용
              imageBase64 = await fileToBase64(barcode.file);
            }
          }
          return {
            number: barcode.number || '',
            imageBase64: imageBase64
          };
        })
      );

      // QR 코드 생성
      const validBarcodes = barcodes
        .map(b => b.number)
        .filter(num => num && num.trim() !== '');
      
      let qrCodeBase64 = null;
      if (validBarcodes.length > 0) {
        const QRCode = (await import('qrcode')).default;
        const qrData = JSON.stringify({
          barcodes: validBarcodes,
          count: validBarcodes.length,
          timestamp: new Date().toISOString()
        });
        qrCodeBase64 = await QRCode.toDataURL(qrData, { width: 300 });
      }

      // JSON 데이터로 전송
      const requestData = {
        employeeId,
        employeeName,
        emailAddress,
        barcodes: barcodeDataWithImages,
        qrCodeBase64
      };

      // 요청 크기 확인 (디버깅용)
      const requestBody = JSON.stringify(requestData);
      const requestSizeKB = Math.round(requestBody.length / 1024);
      console.log(`요청 크기: ${requestSizeKB}KB`);
      
      if (requestSizeKB > 5000) {
        console.warn('⚠️ 요청 크기가 매우 큽니다:', requestSizeKB, 'KB');
        setMessage({ type: 'info', text: '이미지가 많아 전송에 시간이 걸릴 수 있습니다...' });
      }

      setMessage({ type: 'info', text: '이메일 발송 중...' });

      // API 호출 (타임아웃 설정)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초 타임아웃

      let response;
      try {
        response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: requestBody,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('요청 시간이 초과되었습니다. 네트워크 연결을 확인하거나 이미지 크기를 줄여주세요.');
        }
        throw fetchError;
      }

      let result;
      try {
        const text = await response.text();
        result = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('응답 파싱 오류:', parseError);
        throw new Error('서버 응답을 처리할 수 없습니다.');
      }

      if (response.ok) {
        setMessage({ type: 'success', text: '이메일이 성공적으로 발송되었습니다.' });
        // 폼 초기화 (선택사항)
        // setEmployeeId('');
        // setEmployeeName('');
        // setEmailAddress('');
        // setBarcodes([]);
      } else {
        let errorMessage = result.error || '이메일 발송에 실패했습니다.';
        if (result.details) {
          errorMessage += `\n\n${result.details}`;
        }
        if (result.help) {
          console.error('도움말:', result.help);
          errorMessage += `\n\n도움말:\n${result.help}`;
        }
        setMessage({ type: 'error', text: errorMessage });
      }
    } catch (error) {
      console.error('이메일 발송 오류:', error);
      let errorMessage = '이메일 발송 중 오류가 발생했습니다.';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.name === 'NetworkError' || error.message?.includes('Failed to fetch')) {
        errorMessage = '네트워크 연결을 확인해주세요. 모바일 데이터를 사용 중이라면 Wi-Fi로 전환해보세요.';
      } else if (error.message?.includes('시간이 초과')) {
        errorMessage = error.message;
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="app">
      <div className="header">
        <h1>재불출해주세요!!</h1>
      </div>

      <div className="form-group form-group-inline">
        <div className="form-field">
          <label htmlFor="employeeId">SwingID (숫자와 영문 조합) *</label>
          <input
            type="text"
            id="employeeId"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
            placeholder="ABC123"
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="employeeName">이름 *</label>
          <input
            type="text"
            id="employeeName"
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            placeholder="홍길동"
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="emailAddress">메일 주소 *</label>
        <input
          type="email"
          id="emailAddress"
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          placeholder="example@email.com"
          required
        />
      </div>

      {message && (
        <div className={
          message.type === 'error' ? 'error-message' : 
          message.type === 'info' ? 'info-message' : 
          'success-message'
        }>
          {message.text}
        </div>
      )}

      <BarcodeScanner 
        onBarcodeScanned={handleBarcodeScanned}
        onBarcodesBatch={handleBarcodesBatch}
        isMobile={isMobile}
        maxCount={MAX_BARCODES}
        currentCount={barcodes.length}
      />

      <BarcodeList 
        barcodes={barcodes}
        onDelete={handleDeleteBarcode}
        maxCount={MAX_BARCODES}
      />

      <div className="send-section">
        <button
          className="send-button"
          onClick={handleSendEmail}
          disabled={isSending || barcodes.length === 0}
        >
          {isSending ? '발송 중...' : '메일 발송'}
        </button>
      </div>
    </div>
  );
}

export default App;

