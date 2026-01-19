/* --------------------------------------------------
   データ管理変数
-------------------------------------------------- */
let allTimetables = [null, null, null, null, null]; 
let currentSlotIndex = 0; 
let currentSlotData = null; 
let currentPeriod = {};

let showMinuteFiveNumbers = true;
let showMinuteOneNumbers = false;
let digitalVisible = true;
let blinkState = true;

const canvas = document.getElementById("analogClock");
const ctx = canvas ? canvas.getContext("2d") : null;
const digitalEl = document.getElementById("digitalClock");
const remainEl = document.getElementById("remainTime");
const listEl = document.getElementById("timetableList");

/* --------------------------------------------------
   初期化処理
-------------------------------------------------- */
function init() {
  try {
    if (!canvas || !ctx) {
      console.error("Canvasが見つかりません");
      return;
    }

    resizeCanvasForDPR();
    
    // データを復元
    loadAllTimetablesFromStorage();
    
    // 右パネル（ボタンなど）を作成
    generateManagerUI();

    // 最初のリストを選択
    switchTimetable(0);

    // 時計を動かす
    drawClock();
    setInterval(() => {
      blinkState = !blinkState;
      updateCurrentPeriod();
      drawClock();
    }, 1000);

    // ボタン設定
    setupButton("btn-toggle-digital", () => { digitalVisible = !digitalVisible; updateDigitalClock(); });
    setupButton("btn-now", speakNow);
    setupButton("btn-remain", speakRemain);
    setupButton("btn-toggle-minutes", () => { showMinuteFiveNumbers = !showMinuteFiveNumbers; drawClock(); });
    setupButton("btn-toggle-minutes1", () => { showMinuteOneNumbers = !showMinuteOneNumbers; drawClock(); });
    setupButton("btn-download-template", downloadSampleCSV);
    setupButton("btn-reset-data", resetAllData); // リセットボタン

    window.addEventListener("resize", () => { resizeCanvasForDPR(); drawClock(); });

  } catch (err) {
    console.error("初期化エラー:", err);
    alert("エラーが発生しました。設定をリセットします。");
    localStorage.removeItem("my_clock_timetables_v2");
    location.reload();
  }
}

function setupButton(id, func) {
  const el = document.getElementById(id);
  if (el) el.onclick = func;
}

document.addEventListener("DOMContentLoaded", init);

/* --------------------------------------------------
   データ保存・読み込み・リセット
-------------------------------------------------- */
function loadAllTimetablesFromStorage() {
  const saved = localStorage.getItem("my_clock_timetables_v2");
  allTimetables = [null, null, null, null, null]; 
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        for (let i = 0; i < 5; i++) {
          if (parsed[i] && Array.isArray(parsed[i].data)) {
            allTimetables[i] = parsed[i];
          }
        }
      }
    } catch (e) { console.error(e); }
  }
}

function saveAllTimetables() {
  try {
    localStorage.setItem("my_clock_timetables_v2", JSON.stringify(allTimetables));
  } catch (e) { alert("保存できませんでした（容量オーバーの可能性があります）"); }
}

function resetAllData() {
  if (confirm("【注意】\n登録されている5つのデータを全て削除して、初期状態に戻しますか？\nこの操作は取り消せません。")) {
    localStorage.removeItem("my_clock_timetables_v2");
    location.reload(); // ページを再読み込みしてリセット完了
  }
}

function switchTimetable(index) {
  currentSlotIndex = index;
  currentSlotData = allTimetables[index];
  updateCurrentPeriod();
  renderTimetable(-1);
  updateManagerUI();
}

function handleFileUpload(file, index) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const parsed = parseCSV(text);
    if (parsed.length > 0) {
      allTimetables[index] = { fileName: file.name, data: parsed };
      saveAllTimetables();
      generateManagerUI();
      if (currentSlotIndex === index) switchTimetable(index);
      else alert(`「${file.name}」をリスト${index + 1}に登録しました`);
    } else {
      alert("データが読み込めませんでした。見本データを確認してください。");
    }
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== "");
  const result = [];
  // 1行目はヘッダーとして無視、2行目から処理
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length >= 3) {
      const name = cols[0].trim();
      const start = cols[1].trim();
      const end = cols[2].trim();
      if (start.includes(":") && end.includes(":")) {
        result.push({ name, start, end });
      }
    }
  }
  return result;
}

function downloadSampleCSV() {
  const content = "名称,開始時刻,終了時刻\n朝の会,08:30,08:45\n1時間目,08:50,09:35\n中休み,09:35,09:55";
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, content], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "見本データ.csv";
  link.click();
}

/* --------------------------------------------------
   右パネルUI (ボタン生成)
-------------------------------------------------- */
function generateManagerUI() {
  const container = document.querySelector(".timetable-manager");
  if (!container) return;
  container.innerHTML = "";

  for (let i = 0; i < 5; i++) {
    const row = document.createElement("div");
    row.className = "manager-row";
    
    const data = allTimetables[i];
    const name = data ? data.fileName : `リスト${i + 1}`;

    // 選択ボタン
    const btn = document.createElement("button");
    btn.className = "select-btn";
    btn.textContent = name;
    btn.dataset.idx = i;
    btn.onclick = () => switchTimetable(i);

    // 登録ボタン(label)
    const label = document.createElement("label");
    label.className = "upload-label";
    label.textContent = data ? "更新" : "登録";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt";
    input.style.display = "none";
    input.onchange = (e) => handleFileUpload(e.target.files[0], i);
    
    label.appendChild(input);
    row.appendChild(btn);
    row.appendChild(label);
    container.appendChild(row);
  }
  updateManagerUI();
}

function updateManagerUI() {
  document.querySelectorAll(".select-btn").forEach(btn => {
    const idx = parseInt(btn.dataset.idx);
    if (idx === currentSlotIndex) btn.classList.add("current");
    else btn.classList.remove("current");
  });
}

/* --------------------------------------------------
   時計描画
-------------------------------------------------- */
function resizeCanvasForDPR() {
  if (!canvas) return;
  const size = Math.min(window.innerWidth * 0.6, 420);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawClock() {
  if (!ctx) return;
  const size = canvas.clientWidth || 300;
  const c = size / 2; // center
  const r = size / 2; // radius

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 盤面
  ctx.beginPath();
  ctx.arc(c, c, r * 0.95, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.lineWidth = Math.max(4, r * 0.03);
  ctx.strokeStyle = "#000";
  ctx.stroke();

  // 残り時間（扇形）
  if (currentPeriod && currentPeriod.end) {
    const now = new Date();
    const curSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const [eh, em] = currentPeriod.end.split(":").map(Number);
    const endSec = eh * 3600 + em * 60;
    
    const startAngle = ((curSec % 3600) / 3600) * 2 * Math.PI - Math.PI / 2;
    let endAngle = ((endSec % 3600) / 3600) * 2 * Math.PI - Math.PI / 2;
    if (endAngle <= startAngle) endAngle += 2 * Math.PI;

    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, r * 0.9, startAngle, endAngle);
    ctx.fillStyle = "rgba(255,182,193,0.6)";
    ctx.fill();
  }

  // 文字盤数字
  drawNumbers(c, r);
  
  // 針
  drawHands(c, r);

  updateDigitalClock();
  updateRemainDisplay();
}

function drawNumbers(c, r) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // 1-12
  ctx.font = `${Math.round(r * 0.16)}px sans-serif`;
  ctx.fillStyle = "#333";
  for (let n = 1; n <= 12; n++) {
    const a = (n * Math.PI) / 6;
    ctx.fillText(n, c + Math.sin(a) * r * 0.72, c - Math.cos(a) * r * 0.72);
  }
  
  // 5分刻み
  if (showMinuteFiveNumbers) {
    ctx.font = `${Math.round(r * 0.1)}px sans-serif`;
    ctx.fillStyle = "#005580";
    for (let m = 5; m <= 60; m += 5) {
      const a = (m * Math.PI) / 30;
      ctx.fillText(m, c + Math.sin(a) * r * 0.88, c - Math.cos(a) * r * 0.88);
    }
  }

  // 1分刻み
  if (showMinuteOneNumbers) {
    const now = new Date();
    const cm = now.getMinutes();
    ctx.font = `${Math.round(r * 0.06)}px sans-serif`;
    for (let m = 1; m <= 60; m++) {
      const a = (m * Math.PI) / 30;
      ctx.fillStyle = (m === cm || (m === 60 && cm === 0)) ? "red" : "#666";
      ctx.fillText(m, c + Math.sin(a) * r * 0.9, c - Math.cos(a) * r * 0.9);
    }
  }
}

function drawHands(c, r) {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();

  const hAng = ((h % 12) + m / 60 + s / 3600) * (Math.PI / 6);
  const mAng = (m + s / 60) * (Math.PI / 30);
  const sAng = s * (Math.PI / 30);

  drawLine(c, hAng, r * 0.5, 6, "#333"); // 短針
  drawLine(c, mAng, r * 0.75, 4, "red"); // 長針
  drawLine(c, sAng, r * 0.88, 2, "#000"); // 秒針
}

function drawLine(c, angle, len, w, color) {
  const x = c + Math.sin(angle) * len;
  const y = c - Math.cos(angle) * len;
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.lineTo(x, y);
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.stroke();
}

/* --------------------------------------------------
   表示更新
-------------------------------------------------- */
function updateDigitalClock() {
  if (!digitalEl) return;
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "午前" : "午後";
  const h12 = h % 12 || 12;
  
  const colon = blinkState ? ":" : "<span style='opacity:0'>:</span>";
  digitalEl.innerHTML = `${ampm}${h12}${colon}${m}`;
  
  const v = digitalVisible ? "visible" : "hidden";
  digitalEl.style.visibility = v;
  if (remainEl) remainEl.style.visibility = v;
}

function updateRemainDisplay() {
  if (!remainEl) return;
  if (!currentPeriod || !currentPeriod.end) {
    remainEl.textContent = "ー";
    return;
  }
  const now = new Date();
  const [eh, em] = currentPeriod.end.split(":").map(Number);
  const end = new Date(); 
  end.setHours(eh, em, 0, 0);
  const diff = Math.floor((end - now) / 60000);
  remainEl.textContent = diff >= 0 ? `あと${diff}分` : "終了";
}

function updateCurrentPeriod() {
  currentPeriod = {};
  if (!currentSlotData || !currentSlotData.data) {
    renderTimetable(-1);
    return;
  }
  
  const now = new Date();
  const cm = now.getHours() * 60 + now.getMinutes();
  let activeIdx = -1;

  currentSlotData.data.forEach((p, i) => {
    const [sh, sm] = p.start.split(":").map(Number);
    const [eh, em] = p.end.split(":").map(Number);
    const st = sh * 60 + sm;
    const et = eh * 60 + em;
    if (cm >= st && cm < et) {
      currentPeriod = p;
      activeIdx = i;
    }
  });
  renderTimetable(activeIdx);
}

function renderTimetable(idx) {
  if (!listEl) return;
  listEl.innerHTML = "";
  
  if (!currentSlotData || !currentSlotData.data || currentSlotData.data.length === 0) {
    listEl.innerHTML = "<div style='padding:10px; color:#999;'>（予定なし）</div>";
    return;
  }

  currentSlotData.data.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "timetable-item" + (i === idx ? " active" : "");
    div.textContent = `${p.start}〜${p.end} ${p.name}`;
    listEl.appendChild(div);
  });
  
  // 自動スクロール
  if (idx >= 0) {
    const active = listEl.querySelector(".active");
    if (active) {
      active.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

/* 音声 */
function speak(t) { const u = new SpeechSynthesisUtterance(t); u.lang = "ja-JP"; speechSynthesis.cancel(); speechSynthesis.speak(u); }
function speakNow() {
  const n = new Date();
  const h = n.getHours() % 12 || 12;
  const m = n.getMinutes();
  const am = n.getHours() < 12 ? "午前" : "午後";
  speak(`今の時刻は、${am}、${h}時、${m}分です`);
}
function speakRemain() {
  if (remainEl && remainEl.textContent.includes("あと")) {
     speak(`${currentPeriod.name}は、${remainEl.textContent}で終わります`);
  } else {
     speak("今は予定がありません");
  }
}