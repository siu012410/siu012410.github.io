// ===== 광고 설정 (이 부분만 바꾸면 됩니다) =====
// AdSense 게시자 ID. 비워 두면 광고 대신 "광고 자리" 상자가 보입니다.
// AdSense 기본 코드는 index.html·privacy.html의 <head>에 직접 들어 있습니다 (사이트 확인용).
const ADSENSE_CLIENT = 'ca-pub-7787868266002256';

// 광고 단위(슬롯) ID는 index.html의 각 <div class="ad-slot" data-ad-slot-id="...">에 넣으세요.
// 슬롯 ID를 비워 두면 AdSense "자동 광고"가 알아서 위치를 정합니다.
// ==============================================

(function () {
  const slots = document.querySelectorAll('.ad-slot');

  if (!ADSENSE_CLIENT) {
    slots.forEach(function (slot) {
      slot.innerHTML = '<div class="ad-placeholder">광고 자리</div>';
    });
    return;
  }

  // <head>에 AdSense 코드가 없을 때만 넣음 (두 번 불러오지 않도록)
  if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADSENSE_CLIENT;
    document.head.appendChild(script);
  }

  slots.forEach(function (slot) {
    const slotId = slot.getAttribute('data-ad-slot-id');
    if (!slotId) return;
    slot.innerHTML =
      '<ins class="adsbygoogle" style="display:block"' +
      ' data-ad-client="' + ADSENSE_CLIENT + '"' +
      ' data-ad-slot="' + slotId + '"' +
      ' data-ad-format="auto" data-full-width-responsive="true"></ins>';
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  });
})();
