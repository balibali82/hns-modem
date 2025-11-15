import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

const BarcodeList = ({ barcodes, onDelete, maxCount = 30 }) => {
  const [imageUrls, setImageUrls] = useState({});
  const [qrDataUrl, setQrDataUrl] = useState(null);

  useEffect(() => {
    // 각 바코드의 이미지 URL 생성
    const urls = {};
    barcodes.forEach((barcode, index) => {
      if (barcode.file) {
        urls[index] = URL.createObjectURL(barcode.file);
      }
    });

    setImageUrls(urls);

    // 클린업
    return () => {
      Object.values(urls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [barcodes]);

  useEffect(() => {
    // QR 코드 생성
    const generateQRCode = async () => {
      const validBarcodes = barcodes
        .map(b => b.number)
        .filter(num => num && num.trim() !== '');

      if (validBarcodes.length === 0) {
        setQrDataUrl(null);
        return;
      }

      try {
        const data = JSON.stringify({
          barcodes: validBarcodes,
          count: validBarcodes.length,
          timestamp: new Date().toISOString()
        });

        const dataUrl = await QRCode.toDataURL(data, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error('QR 코드 생성 실패:', err);
        setQrDataUrl(null);
      }
    };

    generateQRCode();
  }, [barcodes]);

  if (barcodes.length === 0) {
    return (
      <div className="barcode-section">
        <h2>바코드 목록</h2>
        <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
          바코드가 없습니다. 스캔을 시작해주세요.
        </p>
      </div>
    );
  }

  const copyAllBarcodes = () => {
    const validBarcodes = barcodes
      .map(b => b.number)
      .filter(num => num && num.trim() !== '');
    
    if (validBarcodes.length === 0) {
      alert('복사할 바코드가 없습니다.');
      return;
    }
    
    const barcodeText = validBarcodes.join('\n');
    navigator.clipboard.writeText(barcodeText).then(() => {
      alert(`${validBarcodes.length}개의 바코드 번호가 클립보드에 복사되었습니다.`);
    }).catch(err => {
      console.error('복사 실패:', err);
      alert('복사에 실패했습니다.');
    });
  };

  const downloadQRCode = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.download = `barcode_qr_${Date.now()}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <div className="barcode-section">
      <div className="barcode-list-header">
        <h2 style={{ margin: 0 }}>바코드 목록</h2>
        <div className="barcode-list-actions">
          {qrDataUrl && (
            <button
              className="qr-download-button"
              onClick={downloadQRCode}
              title="QR 코드 다운로드"
              aria-label="QR 코드 다운로드"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
              </svg>
              <span>QR</span>
            </button>
          )}
          <button
            onClick={copyAllBarcodes}
            className="btn-copy-all"
          >
            전체 복사
          </button>
        </div>
      </div>
      <div className="barcode-count">
        {barcodes.length} / {maxCount}개
      </div>
      <div className="barcode-list">
        {barcodes.map((barcode, index) => (
          <div key={index} className="barcode-item">
            <button
              className="barcode-item-delete"
              onClick={() => onDelete(index)}
              aria-label="삭제"
              title="삭제"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="barcode-item-content">
              {imageUrls[index] && (
                <img
                  src={imageUrls[index]}
                  alt={`바코드 ${index + 1}`}
                  className="barcode-item-image"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
              <div className="barcode-item-info">
                <div className="barcode-item-number">
                  {barcode.number || '인식 실패'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {barcodes.length >= maxCount && (
        <div className="error-message" style={{ marginTop: '15px' }}>
          최대 {maxCount}개까지 업로드할 수 있습니다.
        </div>
      )}
    </div>
  );
};

export default BarcodeList;

