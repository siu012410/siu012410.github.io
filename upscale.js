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

  // 모델은 배율별로 한 번만 만들어 재사용
  const upscalers = {};
  function getUpscaler(scale) {
    if (!upscalers[scale]) {
      const model = scale === 4 ? window.ESRGANMedium4x : window.ESRGANMedium2x;
      upscalers[scale] = new window.Upscaler({ model: model });
    }
    return upscalers[scale];
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
    runBtn.disabled = true;
    progress.hidden = false;
    fill.style.width = '0%';
    status.textContent = 'AI 모델 불러오는 중… (처음 한 번만 오래 걸려요)';

    try {
      const upscaler = getUpscaler(scale);
      await upscaler.getModel();
      status.textContent = '처리 중… 0%';
      const result = await upscaler.upscale(before, {
        patchSize: 64,   // 작은 조각으로 나눠 처리해 메모리 부족을 막음
        padding: 4,
        progress: function (p) {
          const pct = Math.round(p * 100);
          fill.style.width = pct + '%';
          status.textContent = '처리 중… ' + pct + '%';
        },
      });

      after.onload = function () {
        afterLabel.textContent = '결과 (' + after.naturalWidth + ' × ' + after.naturalHeight + ')';
      };
      after.src = result;
      download.href = result;
      download.download = fileName + '_x' + scale + '.png';
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
