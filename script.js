/* --------------------------------------------------
   データ管理変数・定数
-------------------------------------------------- */
// デフォルトのデータ（初回起動時やリセット用）
const DEFAULT_TIMETABLE = [
  { name: "朝の会", start: "08:30", end: "08:45" },
  { name: "1時間目", start: "08:50", end: "09:35" },
  { name: "2時間目", start: "09:45", end: "10:30" },
  { name: "給食", start: "12:15", end: "13:00" }
];

// 5枠分のデータを管理する配列
let allTimetables = [null, null, null, null, null]; // index 0~4
let currentSlotIndex = 0; // 現在選択中のリスト(0~4)

let timetable = []; // 現在表示中のリストデータ
let currentPeriod = {};
let showMinuteFiveNumbers = true;
let showMinuteOneNumbers = false;
let digitalVisible = true;
let blinkState = true;

const canvas = document.getElementById("analogClock");
const ctx = canvas.getContext("2d");
const digitalEl = document.getElementById("digitalClock");
const remainEl = document.getElementById("remainTime");
const listEl = document.getElementById("timetableList");

/* --------------------------------------------------
   初期化処理
-------------------------------------------------- */
function init() {
  resizeCanvasForDPR();
  
  // 保存されたデータの読み込み
  loadAllTimetablesFromStorage();
  
  // UI生成（右パネルのボタンなど）
  generateManagerUI();

  // 最初のリストを表示
  switchTimetable(0);

  // 時計更新ループ
  drawClock();
  setInterval(() => {
    blinkState = !blinkState;
    updateCurrentPeriod();
    drawClock();
  }, 1000);

  // ボタンイベント設定
  document.getElementById("btn-toggle-digital").onclick = () => { digitalVisible = !digitalVisible; updateDigitalClock(); };
  document.getElementById("btn-now").onclick = speakNow;
  document.getElementById("btn-remain").onclick = speakRemain;
  document.getElementById("btn-toggle-minutes").onclick = () => { showMinuteFiveNumbers = !showMinuteFiveNumbers; drawClock(); };
  document.getElementById("btn-toggle-minutes1").onclick = () => { showMinuteOneNumbers = !showMinuteOneNumbers; drawClock(); };
  
  // テンプレートダウンロード
  document.getElementById("btn-download-template").onclick = downloadSampleCSV;

  window.addEventListener("resize", () => { resizeCanvasForDPR(); drawClock(); });
}

document.addEventListener("DOMContentLoaded", init);


/* --------------------------------------------------
   データ管理・CSV処理
-------------------------------------------------- */

// LocalStorageから全リストを復元
function loadAllTimetablesFromStorage() {
  const saved = localStorage.getItem("my_clock_timetables");
  if (saved) {
    allTimetables = JSON.parse(saved);
  }
  // データが無い枠はデフォルトを入れる
  for (let i = 0; i < 5; i++) {
    if (!allTimetables[i]) {
      allTimetables[i] = JSON.parse(JSON.stringify(DEFAULT_TIMETABLE));
    }
  }
}

// データを保存
function saveAllTimetables() {
  localStorage.setItem("my_clock_timetables", JSON.stringify(allTimetables));
}

// リスト切り替え
function switchTimetable(index) {
  currentSlotIndex = index;
  timetable = allTimetables[index];
  updateCurrentPeriod();
  renderTimetable(-1); // リスト描画更新
  updateManagerUI(); // ボタンの見た目更新
}

// テンプレートCSVダウンロード (Excelで文字化けしないようBOM付き)
function downloadSampleCSV() {
  const csvText = "名称,開始時刻,終了時刻\n朝の会,08:30,08:45\n1時間目,08:50,09:35\n中休み,09:35,09:55\n2時間目,09:55,10:40";
  // BOM (0xEF, 0xBB, 0xBF) を付与してUTF-8として認識させる
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, csvText], { type: "text/csv" });
  
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "見本データ.csv";
  link.click();
}

// ファイルアップロード処理
function handleFileUpload(file, index) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const parsedData = parseCSV(text);
      if (parsedData.length > 0) {
        allTimetables[index] = parsedData;
        saveAllTimetables();
        if (currentSlotIndex === index) {
          switchTimetable(index);
        } else {
            alert(`リスト${index + 1}にデータを登録しました！`);
        }
      } else {
        alert("データの読み込みに失敗しました。書式を確認してください。");
      }
    } catch (err) {
      console.error(err);
      alert("ファイル形式が正しくありません。");
    }
    // inputをリセット（同じファイルを再度選べるように）
    generateManagerUI(); 
  };
  reader.readAsText(file);
}

// CSVパース（簡易版）
function parseCSV(text) {
  // 改行で分割し、空行を除去
  const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== "");
  const result = [];
  
  // 1行目はヘッダーとみなしてスキップ、2行目から処理
  for (let i = 1; i < lines.length; i++) {
    // カンマで分割
    const cols = lines[i].split(",");
    if (cols.length >= 3) {
      const name = cols[0].trim();
      const start = cols[1].trim();
      const end = cols[2].trim();
      // 時刻形式(HH:MM)か簡易チェック
      if (start.includes(":") && end.includes(":")) {
        result.push({ name, start, end });
      }
    }
  }
  return result;
}

/* --------------------------------------------------
   右パネルUI生成
-------------------------------------------------- */
function generateManagerUI() {
  const container = document.querySelector(".timetable-manager");
  container.innerHTML = "";

  for (let i = 0; i < 5; i++) {
    const row = document.createElement("div");
    row.className = "manager-row";

    // 切り替えボタン
    const selectBtn = document.createElement("button");
    selectBtn.className = "select-btn";
    selectBtn.textContent = `リスト${i + 1}`;
    selectBtn.dataset.idx = i;
    selectBtn.onclick = () => switchTimetable(i);
    
    // アップロードボタン（labelタグを使用してinput[type=file]を装飾）
    const uploadLabel = document.createElement("label");
    uploadLabel.className = "upload-label";
    uploadLabel.textContent = "変更";
    
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".csv,.txt";
    fileInput.style.display = "none"; // 非表示
    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileUpload(e.target.files[0], i);
      }
    };

    uploadLabel.appendChild(fileInput);
    
    row.appendChild(selectBtn);
    row.appendChild(uploadLabel);
    container.appendChild(row);
  }
  updateManagerUI();
}

function updateManagerUI() {
  const btns = document.querySelectorAll(".select-btn");
  btns.forEach(btn => {
    const idx = parseInt(btn.dataset.idx);
    if (idx === currentSlotIndex) {
      btn.classList.add("current");
    } else {
      btn.classList.remove("current");
    }
  });
}

/* --------------------------------------------------
   時計・描画関連（元のコードを維持）
-------------------------------------------------- */
function resizeCanvasForDPR() {
  const cssSize = Math.min(window.innerWidth * 0.6, 420);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = cssSize + "px";
  canvas.style.height = cssSize + "px";
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function getCanvasMetrics() {
  const cssSize = canvas.clientWidth;
  return { center: cssSize / 2, radius: cssSize / 2 };
}

function drawClock() {
  const { center, radius } = getCanvasMetrics();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.arc(center, center, radius * 0.95, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = Math.max(4, radius * 0.03);
  ctx.strokeStyle = "#000";
  ctx.stroke();

  if (currentPeriod.start && currentPeriod.end) {
    const now = new Date();
    const totalSecsNow = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const [eh, em] = currentPeriod.end.split(":").map(Number);
    const endSecs = eh * 3600 + em * 60;

    const nowAngle = ((totalSecsNow % 3600) / 3600) * 2 * Math.PI - Math.PI / 2;
    let endAngle = ((endSecs % 3600) / 3600) * 2 * Math.PI - Math.PI / 2;
    if (endAngle <= nowAngle) endAngle += 2 * Math.PI;

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius * 0.9, nowAngle, endAngle, false);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,182,193,0.6)";
    ctx.fill();
  }

  drawHourNumbers(center, radius);
  if (showMinuteFiveNumbers) drawMinuteFiveNumbers(center, radius);
  if (showMinuteOneNumbers) drawMinuteOneNumbers(center, radius);
  drawHands(center, radius);
  updateDigitalClock();
  updateRemainDisplay();
}

function drawHourNumbers(c, r) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(r * 0.16)}px "Noto Sans JP"`;
  ctx.fillStyle = "#082737";
  for (let n = 1; n <= 12; n++) {
    const ang = (n * Math.PI) / 6;
    const x = c + Math.sin(ang) * r * 0.72;
    const y = c - Math.cos(ang) * r * 0.72;
    ctx.fillText(n, x, y);
  }
}
function drawMinuteFiveNumbers(c, r) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(r * 0.1)}px "Noto Sans JP"`;
  ctx.fillStyle = "#0b4766";
  for (let m = 5; m <= 60; m += 5) {
    const ang = (m * Math.PI) / 30;
    const x = c + Math.sin(ang) * r * 0.88;
    const y = c - Math.cos(ang) * r * 0.88;
    ctx.fillText(m, x, y);
  }
}
function drawMinuteOneNumbers(c, r) {
  const now = new Date();
  const cm = now.getMinutes() % 60;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(r * 0.06)}px "Noto Sans JP"`;
  for (let m = 1; m <= 60; m++) {
    const ang = (m * Math.PI) / 30;
    const x = c + Math.sin(ang) * r * 0.9;
    const y = c - Math.cos(ang) * r * 0.9;
    ctx.fillStyle = m === cm || (m === 60 && cm === 0) ? "red" : "#333";
    ctx.fillText(m, x, y);
  }
}
function drawHands(c, r) {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  const hA = ((h % 12) + m / 60 + s / 3600) * (Math.PI / 6);
  const mA = (m + s / 60) * (Math.PI / 30);
  const sA = s * (Math.PI / 30);
  function hand(a, l, w, col) {
    const x = c + Math.sin(a) * r * l;
    const y = c - Math.cos(a) * r * l;
    ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(x, y);
    ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = "round"; ctx.stroke();
  }
  hand(hA, 0.5, 6, "#143241");
  hand(mA, 0.75, 4, "red");
  hand(sA, 0.88, 2, "#000");
}

function updateDigitalClock() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  const ampm = h < 12 ? "午前" : "午後";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const colonClass = blinkState ? "colon" : "colon off";
  digitalEl.innerHTML = `${ampm}${h12}<span class="${colonClass}">:</span>${String(m).padStart(2, "0")}`;

  if (digitalVisible) {
    digitalEl.classList.remove("hidden");
    remainEl.classList.remove("hidden");
  } else {
    digitalEl.classList.add("hidden");
    remainEl.classList.add("hidden");
  }
}

function updateRemainDisplay() {
  if (!currentPeriod.end) return (remainEl.textContent = "ー");
  const now = new Date();
  const [eh, em] = currentPeriod.end.split(":").map(Number);
  const end = new Date(); end.setHours(eh, em, 0, 0);
  const diff = Math.max(0, Math.floor((end - now) / 60000));
  remainEl.textContent = `あと${diff}分`;
}

function updateCurrentPeriod() {
  const now = new Date(), curM = now.getHours() * 60 + now.getMinutes();
  currentPeriod = {};
  let idx = -1;
  for (let i = 0; i < timetable.length; i++) {
    const [sh, sm] = timetable[i].start.split(":").map(Number);
    const [eh, em] = timetable[i].end.split(":").map(Number);
    const st = sh * 60 + sm, et = eh * 60 + em;
    if (curM >= st && curM < et) { idx = i; currentPeriod = timetable[i]; break; }
  }
  renderTimetable(idx);
}
function renderTimetable(activeIndex) {
  listEl.innerHTML = "";
  if (!timetable || timetable.length === 0) {
      listEl.innerHTML = "<div class='timetable-item'>予定なし</div>";
      return;
  }
  timetable.forEach((p, i) => {
    const d = document.createElement("div");
    d.className = "timetable-item";
    d.textContent = `${p.start}〜${p.end} ${p.name}`;
    if (i === activeIndex) d.classList.add("active");
    listEl.appendChild(d);
  });
  if (activeIndex >= 0) {
    requestAnimationFrame(() => {
      const active = listEl.querySelector(".active");
      if (active) {
        const offsetTop = active.offsetTop;
        const elHeight = listEl.clientHeight;
        const target = offsetTop - elHeight / 2 + active.clientHeight / 2;
        listEl.scrollTo({ top: target, behavior: "smooth" });
      }
    });
  }
}

function speak(t) { const u = new SpeechSynthesisUtterance(t); u.lang = "ja-JP"; speechSynthesis.cancel(); speechSynthesis.speak(u); }
function speakNow() {
  const n = new Date(), h = n.getHours(), m = n.getMinutes();
  const am = h < 12 ? "午前" : "午後", h12 = h % 12 === 0 ? 12 : h % 12;
  speak(`今の時刻は、${am}${h12}時${m}分です`);
}
function speakRemain() {
  if (currentPeriod.end) {
    const n = new Date(); const [eh, em] = currentPeriod.end.split(":").map(Number);
    const e = new Date(); e.setHours(eh, em, 0, 0);
    const d = Math.max(0, Math.floor((e - n) / 60000));
    speak(`${currentPeriod.name}は、あと${d}分で終わります`);
  } else speak("今の時間の予定はありません");
}