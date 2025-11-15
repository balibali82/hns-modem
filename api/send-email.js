import nodemailer from 'nodemailer';
import sharp from 'sharp';

export default async function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 환경 변수에서 SMTP 설정 가져오기
    const smtpConfig = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    // 필수 환경 변수 확인 및 로깅
    const missingVars = [];
    if (!smtpConfig.host) missingVars.push('SMTP_HOST');
    if (!smtpConfig.auth.user) missingVars.push('SMTP_USER');
    if (!smtpConfig.auth.pass) missingVars.push('SMTP_PASS');
    
    if (missingVars.length > 0) {
      console.error('❌ SMTP 환경 변수 누락:', missingVars.join(', '));
      console.log('현재 설정된 환경 변수:');
      console.log('- SMTP_HOST:', smtpConfig.host ? '✅ 설정됨' : '❌ 없음');
      console.log('- SMTP_PORT:', smtpConfig.port);
      console.log('- SMTP_SECURE:', smtpConfig.secure);
      console.log('- SMTP_USER:', smtpConfig.auth.user ? '✅ 설정됨' : '❌ 없음');
      console.log('- SMTP_PASS:', smtpConfig.auth.pass ? '✅ 설정됨' : '❌ 없음');
      
      return res.status(500).json({ 
        error: 'SMTP 설정이 완료되지 않았습니다.',
        details: `누락된 환경 변수: ${missingVars.join(', ')}`,
        help: 'PowerShell에서 다음 명령어로 환경 변수를 설정하세요:\n' +
              missingVars.map(v => `  $env:${v}="your_value_here"`).join('\n')
      });
    }
    
    console.log('✅ SMTP 설정 확인 완료');
    console.log('- SMTP_HOST:', smtpConfig.host);
    console.log('- SMTP_PORT:', smtpConfig.port);
    console.log('- SMTP_USER:', smtpConfig.auth.user);

    // JSON 데이터 추출 (클라이언트에서 base64로 변환하여 전송)
    const { employeeId, employeeName, emailAddress, barcodes: barcodeData, qrCodeBase64 } = req.body;

    if (!employeeId || !employeeName || !emailAddress) {
      return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
    }

    // 바코드 데이터 확인
    if (!Array.isArray(barcodeData) || barcodeData.length === 0) {
      return res.status(400).json({ error: '바코드 데이터가 없습니다.' });
    }

    // Nodemailer transporter 생성
    const transporter = nodemailer.createTransport(smtpConfig);

    // 이메일 본문 생성
    const validBarcodes = barcodeData
      .map(b => b.number)
      .filter(num => num && num.trim() !== '');
    
    const barcodeList = barcodeData
      .map((b, index) => `${index + 1}. ${b.number || '인식 실패'}`)
      .join('<br>');
    
    // 바코드 번호를 한 줄로 모은 텍스트 (복사용)
    const allBarcodeNumbers = validBarcodes.join('\n');
    
    // 바코드 복사용 텍스트 영역 (선택하기 쉽게)
    const barcodeCopySection = validBarcodes.length > 0
      ? `<div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border: 2px dashed #6200ee; border-radius: 8px;">
           <h4 style="margin: 0 0 10px 0; color: #6200ee; font-size: 14px;">📋 바코드 번호 전체 복사</h4>
           <div style="background-color: #fff; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.8; color: #333; user-select: all; -webkit-user-select: all; cursor: text;">
             ${allBarcodeNumbers.replace(/\n/g, '<br>')}
           </div>
           <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">
             💡 위의 바코드 번호를 드래그하여 선택한 후 복사(Ctrl+C)하세요.
           </p>
         </div>`
      : '';
    
    // QR 코드를 본문에 삽입하기 위한 base64 이미지 태그
    const qrCodeImageTag = qrCodeBase64 
      ? `<div style="text-align: center; margin-top: 30px; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
           <h3 style="margin-bottom: 15px; color: #333;">QR 코드</h3>
           <img src="${qrCodeBase64}" alt="QR Code" style="max-width: 300px; height: auto; border: 1px solid #ddd; border-radius: 4px;" />
         </div>`
      : '';

    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>요청자 정보</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>SwingID:</strong> ${employeeId}</p>
            <p><strong>이름:</strong> ${employeeName}</p>
            <p><strong>발송 시간:</strong> ${new Date().toLocaleString('ko-KR')}</p>
          </div>
          <h3>바코드 목록 (총 ${barcodeData.length}개)</h3>
          <div style="background-color: #fff; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
            ${barcodeList}
          </div>
          ${barcodeCopySection}
          ${qrCodeImageTag}
          <p style="margin-top: 20px; color: #666; font-size: 14px;">
            첨부된 파일에는 바코드 사진이 포함되어 있습니다.
          </p>
        </body>
      </html>
    `;

    const textContent = `
요청자 정보

SwingID: ${employeeId}
이름: ${employeeName}
발송 시간: ${new Date().toLocaleString('ko-KR')}

바코드 목록 (총 ${barcodeData.length}개):
${barcodeData.map((b, index) => `${index + 1}. ${b.number || '인식 실패'}`).join('\n')}

바코드 번호 전체:
${allBarcodeNumbers}

첨부된 파일에는 바코드 사진이 포함되어 있습니다.
    `;

    // 첨부 파일 준비 (base64 이미지들을 압축하여 Buffer로 변환)
    const attachments = [];

    // 바코드 이미지 파일들 추가 (압축)
    for (let index = 0; index < barcodeData.length; index++) {
      const barcode = barcodeData[index];
      if (barcode.imageBase64) {
        try {
          const base64Data = barcode.imageBase64.replace(/^data:image\/\w+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          // 이미지 압축: 최대 너비 1200px, 품질 60%
          const compressedBuffer = await sharp(imageBuffer)
            .resize(1200, null, {
              withoutEnlargement: true,
              fit: 'inside'
            })
            .jpeg({ 
              quality: 60,
              mozjpeg: true 
            })
            .toBuffer();
          
          console.log(`이미지 ${index + 1} 압축: ${Math.round(imageBuffer.length / 1024)}KB → ${Math.round(compressedBuffer.length / 1024)}KB`);
          
          attachments.push({
            filename: `barcode_${index + 1}_${barcode.number || 'unknown'}.jpg`,
            content: compressedBuffer,
            contentType: 'image/jpeg'
          });
        } catch (error) {
          console.error(`이미지 ${index + 1} 압축 실패, 원본 사용:`, error.message);
          // 압축 실패 시 원본 사용
          const base64Data = barcode.imageBase64.replace(/^data:image\/\w+;base64,/, '');
          attachments.push({
            filename: `barcode_${index + 1}_${barcode.number || 'unknown'}.jpg`,
            content: Buffer.from(base64Data, 'base64'),
            contentType: 'image/jpeg'
          });
        }
      }
    }

    // QR 코드 이미지 추가 (PNG는 압축률이 낮지만 크기가 작으므로 그대로 사용)
    if (qrCodeBase64) {
      const qrBase64Data = qrCodeBase64.replace(/^data:image\/\w+;base64,/, '');
      attachments.push({
        filename: 'barcode_qr_code.png',
        content: Buffer.from(qrBase64Data, 'base64'),
        contentType: 'image/png'
      });
    }

    // 이메일 옵션 설정
    const mailOptions = {
      from: `"재불출 시스템" <${smtpConfig.auth.user}>`,
      to: emailAddress,
      subject: `[재불출요청] ${employeeId}/${employeeName}`,
      text: textContent,
      html: htmlContent,
      attachments: attachments,
    };

    // 이메일 발송
    const info = await transporter.sendMail(mailOptions);

    return res.status(200).json({ 
      success: true, 
      messageId: info.messageId,
      message: '이메일이 성공적으로 발송되었습니다.' 
    });

  } catch (error) {
    console.error('이메일 발송 오류:', error);
    console.error('오류 상세:', error.message);
    console.error('오류 코드:', error.code);
    
    let errorMessage = '이메일 발송 중 오류가 발생했습니다.';
    let errorDetails = error.message;
    let helpText = null;
    
    // Gmail 앱 비밀번호 오류 감지
    if (error.message && error.message.includes('Application-specific password required')) {
      errorMessage = 'Gmail 앱 비밀번호가 필요합니다.';
      errorDetails = 'Gmail 2단계 인증이 활성화된 경우 앱 비밀번호를 사용해야 합니다.';
      helpText = 'Gmail 앱 비밀번호 설정 방법:\n' +
                 '1. Google 계정 설정 → 보안 → 2단계 인증 확인\n' +
                 '2. 앱 비밀번호 생성: https://myaccount.google.com/apppasswords\n' +
                 '3. 생성된 16자리 앱 비밀번호를 SMTP_PASS 환경 변수에 설정\n' +
                 '4. PowerShell: $env:SMTP_PASS="xxxx xxxx xxxx xxxx" (공백 포함)';
    } else if (error.message && error.message.includes('Invalid login')) {
      errorMessage = 'SMTP 로그인 실패';
      errorDetails = '이메일 주소 또는 비밀번호가 올바르지 않습니다.';
      helpText = 'Gmail 사용 시:\n' +
                 '- 일반 비밀번호 대신 앱 비밀번호를 사용하세요\n' +
                 '- 앱 비밀번호 생성: https://myaccount.google.com/apppasswords';
    } else if (error.code === 'EAUTH') {
      errorMessage = 'SMTP 인증 실패';
      errorDetails = '이메일 주소 또는 비밀번호가 올바르지 않습니다.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'SMTP 서버 연결 실패';
      errorDetails = 'SMTP 서버에 연결할 수 없습니다. 호스트와 포트를 확인하세요.';
    }
    
    return res.status(500).json({ 
      error: errorMessage,
      details: errorDetails,
      help: helpText,
      errorCode: error.code
    });
  }
}

