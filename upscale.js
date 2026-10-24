// AI 이미지 확대 (UpscalerJS, 브라우저 안에서만 처리)
(function () {
  const fileInput = document.getElementById('file');
  const drop = document.getElementById('drop');
  const dropText = document.getElementById('drop-text');
  const runBtn = document.getElementById('run');
  const progress = document.getElementById('progress');
  const fill = document.getElementById('fill');
  const status = document.getElementById('status');
  const compare = document.getElementById('compare');
  const before = document.getElementById('before');
  const after = document.getElementById('after');
  const beforeLabel = document.getElementById('before-label');
  const afterLabel = document.getElementById('after-label');
  const download = document.getElementById('download');

  // 화질(보통/최고)과 배율별 AI 모델
  const MODELS = {
    medium: { 2: window.ESRGANMedium2x, 4: window.ESRGANMedium4x },
    thick: { 2: window.ESRGANThick2x, 4: window.ESRGANThick4x },
  };

  // 모델은 한 번만 만들어 재사용
  const upscalers = {};
  function getUpscaler(quality, scale) {
    const key = quality + scale;
    if (!upscalers[key]) {
      upscalers[key] = new window.Upscaler({ model: MODELS[quality][scale] });
    }
    return upscalers[key];
  }

  // AI로 키운 이미지를 원본 크기로 다시 줄임 (흐림·노이즈만 줄어든 효과)
  async function resizeTo(dataUrl, width, height) {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  }

  let fileName = 'image';

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    fileName = file.name.replace(/\.[^.]+$/, '');
    const reader = new FileReader();
    reader.onload = function () {
      before.onload = function () {
        beforeLabel.textContent = '원본 (' + before.naturalWidth + ' × ' + before.naturalHeight + ')';
        compare.hidden = false;
        after.removeAttribute('src');
        afterLabel.textContent = '결과';
        download.hidden = true;
        runBtn.disabled = false;
      };
      before.src = reader.result;
      dropText.textContent = file.name + ' (다른 사진을 고르려면 다시 누르세요)';
    };
    reader.readAsDataURL(file);
  }

  fileInput.addEventListener('change', function () { loadFile(fileInput.files[0]); });
  drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
  drop.addEventListener('drop', function (e) {
    e.preventDefault();
    drop.classList.remove('over');
    loadFile(e.dataTransfer.files[0]);
  });

  runBtn.addEventListener('click', async function () {
    const scale = Number(document.querySelector('input[name="scale"]:checked').value);
    const quality = document.querySelector('input[name="quality"]:checked').value;
    runBtn.disabled = true;
    progress.hidden = false;
    fill.style.width = '0%';
    status.textContent = 'AI 모델 불러오는 중… (처음 한 번만 오래 걸려요)';

    try {
      // "그대로"는 2배로 키운 뒤 원래 크기로 되돌림
      const upscaler = getUpscaler(quality, scale === 1 ? 2 : scale);
      await upscaler.getModel();
      status.textContent = '처리 중… 0%';
      // 화면에 표시된 크기가 아니라 원본 크기로 처리하도록 img 요소 대신 src를 넘김
      let result = await upscaler.upscale(before.src, {
        patchSize: 64,   // 작은 조각으로 나눠 처리해 메모리 부족을 막음
        padding: 4,
        progress: function (p) {
          const pct = Math.round(p * 100);
          fill.style.width = pct + '%';
          status.textContent = '처리 중… ' + pct + '%';
        },
      });
      if (scale === 1) {
        result = await resizeTo(result, before.naturalWidth, before.naturalHeight);
      }

      after.onload = function () {
        afterLabel.textContent = '결과 (' + after.naturalWidth + ' × ' + after.naturalHeight + ')';
      };
      after.src = result;
      download.href = result;
      download.download = fileName + (scale === 1 ? '_enhanced' : '_x' + scale) + '.png';
      download.hidden = false;
      fill.style.width = '100%';
      status.textContent = '완료!';
    } catch (err) {
      console.error(err);
      status.textContent = '오류가 났어요. 사진을 더 작게 줄여서 다시 시도해 보세요.';
    } finally {
      runBtn.disabled = false;
    }
  });
})();
