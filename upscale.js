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
  const stage = document.getElementById('stage');
  const slider = document.getElementById('slider');
  const tool = document.querySelector('.tool');

  // 비교 슬라이더: 막대 왼쪽은 원본, 오른쪽은 결과
  slider.addEventListener('input', function () {
    stage.style.setProperty('--pos', slider.value + '%');
  });

  // 배율별 AI 모델 (보통 = medium, 최고·최대 = thick)
  const MODELS = {
    medium: { 2: window.ESRGANMedium2x, 4: window.ESRGANMedium4x },
    thick: { 2: window.ESRGANThick2x, 4: window.ESRGANThick4x },
  };

  // 화질 단계별 설정
  // patchSize/padding: 사진을 조각내 처리할 때 조각 크기와 겹치는 폭. 많이 겹칠수록 조각 경계 자국이 사라짐
  // sharpen: 마지막에 더하는 선명도 보정 세기 (0이면 안 함)
  const QUALITY = {
    medium: { model: 'medium', patchSize: 64, padding: 8, sharpen: 0 },
    thick: { model: 'thick', patchSize: 64, padding: 8, sharpen: 0 },
    max: { model: 'thick', patchSize: 96, padding: 16, sharpen: 0.45 },
  };

  // 배율 → AI를 몇 번 돌릴지 (8배는 4배 후 2배)
  const PASSES = { 1: [2], 2: [2], 4: [4], 8: [4, 2] };

  // 결과가 이보다 크면 기기 메모리가 부족해질 수 있음
  const MAX_SIDE = 8000;

  // 모델은 한 번만 만들어 재사용
  const upscalers = {};
  function getUpscaler(model, scale) {
    const key = model + scale;
    if (!upscalers[key]) {
      upscalers[key] = new window.Upscaler({ model: MODELS[model][scale] });
    }
    return upscalers[key];
  }

  // 언샤프 마스크: 흐린 사본과의 차이를 더해 윤곽을 또렷하게
  async function sharpen(dataUrl, amount) {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h);
    const src = data.data;
    const out = new Uint8ClampedArray(src);
    const row = w * 4;
    // 3×3 가우시안(1 2 1 / 2 4 2 / 1 2 1)으로 흐린 값과 비교 (가장자리 1픽셀은 그대로)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * row + x * 4;
        for (let c = 0; c < 3; c++) {
          const k = i + c;
          const blur = (
            src[k - row - 4] + 2 * src[k - row] + src[k - row + 4] +
            2 * src[k - 4] + 4 * src[k] + 2 * src[k + 4] +
            src[k + row - 4] + 2 * src[k + row] + src[k + row + 4]
          ) / 16;
          out[k] = src[k] + amount * (src[k] - blur);
        }
      }
    }
    data.data.set(out);
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL('image/png');
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
        stage.classList.remove('has-result');
        afterLabel.textContent = '결과';
        download.hidden = true;
        progress.hidden = true;
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
    const q = QUALITY[quality];
    const passes = PASSES[scale];

    const longest = Math.max(before.naturalWidth, before.naturalHeight);
    if (longest * scale > MAX_SIDE) {
      progress.hidden = false;
      fill.style.width = '0%';
      status.textContent = '사진이 너무 커서 ' + scale + '배는 어려워요. 더 작은 배율을 고르거나 사진을 줄여서 올려 주세요.';
      return;
    }

    runBtn.disabled = true;
    progress.hidden = false;
    fill.style.width = '0%';
    status.textContent = 'AI 모델 불러오는 중… (처음 한 번만 오래 걸려요)';

    try {
      // 화면에 표시된 크기가 아니라 원본 크기로 처리하도록 img 요소 대신 src를 넘김
      let result = before.src;
      for (let n = 0; n < passes.length; n++) {
        const upscaler = getUpscaler(q.model, passes[n]);
        await upscaler.getModel();
        const step = passes.length > 1 ? ' (' + (n + 1) + '/' + passes.length + '단계)' : '';
        result = await upscaler.upscale(result, {
          patchSize: q.patchSize,   // 작은 조각으로 나눠 처리해 메모리 부족을 막음
          padding: q.padding,
          progress: function (p) {
            const pct = Math.round(((n + p) / passes.length) * 100);
            fill.style.width = pct + '%';
            status.textContent = '처리 중… ' + pct + '%' + step;
          },
        });
      }
      // "그대로"는 2배로 키운 뒤 원래 크기로 되돌림
      if (scale === 1) {
        result = await resizeTo(result, before.naturalWidth, before.naturalHeight);
      }
      if (q.sharpen) {
        status.textContent = '선명도 마무리 중…';
        result = await sharpen(result, q.sharpen);
      }

      after.onload = function () {
        afterLabel.textContent = '결과 (' + after.naturalWidth + ' × ' + after.naturalHeight + ')';
      };
      after.src = result;
      download.href = result;
      download.download = fileName + (scale === 1 ? '_enhanced' : '_x' + scale) + '.png';
      download.hidden = false;
      fill.style.width = '100%';
      slider.value = 50;
      stage.style.setProperty('--pos', '50%');
      stage.classList.add('has-result');
      tool.classList.remove('done-pop');
      void tool.offsetWidth; // 애니메이션 다시 시작
      tool.classList.add('done-pop');
      status.textContent = '🎉 완료!';
    } catch (err) {
      console.error(err);
      status.textContent = '오류가 났어요. 사진을 더 작게 줄여서 다시 시도해 보세요.';
    } finally {
      runBtn.disabled = false;
    }
  });
})();
