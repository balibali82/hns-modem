import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

const QRCodeDisplay = ({ barcodes }) => {
  const canvasRef = useRef(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const generateQRCode = async () => {
      if (barcodes.length === 0) {
        setQrDataUrl(null);
        return;
      }

      try {
        // 모든 바코드 번호를 배열로 JSON 변환
        const barcodeNumbers = barcodes
          .map(b => b.number)
          .filter(num => num && num.trim() !== '');

        if (barcodeNumbers.length === 0) {
          setQrDataUrl(null);
          return;
        }

        const data = JSON.stringify({
          barcodes: barcodeNumbers,
          count: barcodeNumbers.length,
          timestamp: new Date().toISOString()
        });

        // QR 코드 생성
        const dataUrl = await QRCode.toDataURL(data, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        setQrDataUrl(dataUrl);
        setError(null);
      } catch (err) {
        console.error('QR 코드 생성 실패:', err);
        setError('QR 코드 생성에 실패했습니다.');
      }
    };

    generateQRCode();
  }, [barcodes]);

  const downloadQRCode = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.download = `barcode_qr_${Date.now()}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  if (barcodes.length === 0) {
    return null;
  }

  const validBarcodes = barcodes.filter(b => b.number && b.number.trim() !== '');

  if (validBarcodes.length === 0) {
    return (
      <div className="qr-section">
        <h2>QR 코드</h2>
        <p style={{ color: '#666' }}>인식된 바코드가 없어 QR 코드를 생성할 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="qr-section">
      {error && (
        <div className="error-message">{error}</div>
      )}
      {qrDataUrl && (
        <button 
          className="qr-download-icon" 
          onClick={downloadQRCode}
          title="QR 코드 다운로드"
          aria-label="QR 코드 다운로드"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
          </svg>
        </button>
      )}
    </div>
  );
};

export default QRCodeDisplay;

