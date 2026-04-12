  function generateQRCode(url) {
    const el = document.getElementById('qr-canvas');
    if (!el || !url || url === '—') return;
    el.innerHTML = '';
    new QRCode(el, {
      text: url,
      width: 160,
      height: 160,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  function downloadQR() {
    const url = document.getElementById('qr-link').textContent;
    if (!url || url === '—') { showToast('Geen QR-code beschikbaar', 'error'); return; }
    const el = document.getElementById('qr-canvas');
    const canvas = el?.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'jukestage-qr.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('QR code gedownload! 📲', 'success');
    } else {
      generateQRCode(url);
      setTimeout(() => downloadQR(), 300);
    }
  }
