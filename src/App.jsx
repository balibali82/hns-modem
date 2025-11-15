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
      // 바코드 이미지들을 base64로 변환
      const barcodeDataWithImages = await Promise.all(
        barcodes.map(async (barcode) => {
          let imageBase64 = null;
          if (barcode.file) {
            imageBase64 = await fileToBase64(barcode.file);
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

      // API 호출
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

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
      setMessage({ type: 'error', text: '이메일 발송 중 오류가 발생했습니다.' });
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
        <div className={message.type === 'error' ? 'error-message' : 'success-message'}>
          {message.text}
        </div>
      )}

      <BarcodeScanner 
        onBarcodeScanned={handleBarcodeScanned}
        isMobile={isMobile}
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

