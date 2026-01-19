/* --------------------------------------------------
   データ管理変数・定数
-------------------------------------------------- */
// 5枠分のデータを管理する配列
// 構造: { fileName: "hoge.csv", data: [...] } または null
let allTimetables = [null, null, null, null, null]; 
let currentSlotIndex = 0; // 現在選択中のリスト(0~4)

// 現在表示中のリスト情報（ { fileName:..., data:[...] } または null ）
let currentSlotData = null; 

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

  // 最初のリストを表示（データがなければ何もしない）
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
  const saved = localStorage.getItem("my_clock_timetables_v2"); // キー名を変更（構造変化のため）
  if (saved) {
    try {
      allTimetables = JSON.parse(saved);
      // 配列長が5未満の場合のガード
      while (allTimetables.length < 5) {
        allTimetables.push(null);
      }
    } catch (e) {
      console.error("データ読み込みエラー", e);
      allTimetables = [null, null, null, null, null];
    }
  } else {
    // データがない場合は全てnull（初期状態）
    allTimetables = [null, null, null, null, null];
  }
}

// データを保存
function saveAllTimetables() {
  localStorage.setItem("my_clock_timetables_v2", JSON.stringify(allTimetables));
}

// リスト切り替え
function switchTimetable(index) {
  currentSlotIndex = index;
  currentSlotData = allTimetables[index]; // データがない場合は null になる
  
  updateCurrentPeriod();
  renderTimetable(-1); // リスト描画更新
  updateManagerUI();   // ボタンの見た目更新
}

// テンプレートCSVダウンロード
function downloadSampleCSV() {
  const csvText = "名称,開始時刻,終了時刻\n朝の会,08:30,08:45\n1時間目,08:50,09:35\n中休み,09:35,09:55\n2時間目,09:55,10:40";
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
        // データとファイル名をオブジェクトとして保存
        allTimetables[index] = {
          fileName: file.name,
          data: parsedData
        };
        saveAllTimetables();
        
        // UI再生成（ボタン名を更新するため）
        generateManagerUI();

        // 選択中のスロットなら画面も更新
        if (currentSlotIndex === index) {
          switchTimetable(index);
        } else {
            alert(`「${file.name}」を登録しました！`);
        }
      } else {
        alert("有効なデータが見つかりませんでした。");
      }
    } catch (err) {
      console.error(err);
      alert("ファイル形式が正しくありません。");
    }
    // inputをリセット（同じファイルを再度選べるように再生成で対応済）
  };
  reader.readAsText(file);
}

// CSVパース
function parseCSV(text) {
  const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== "");
  const result = [];
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

/* --------------------------------------------------
   右パネルUI生成
-------------------------------------------------- */
function generateManagerUI() {
  const container = document.querySelector(".timetable-manager");
  container.innerHTML = "";

  for (let i = 0; i < 5; i++) {
    const row = document.createElement("div");
    row.className = "manager-row";

    // 登録データがあるか確認
    const slotData = allTimetables[i];
    // ボタンのテキスト：データがあればファイル名、なければ「リストX」
    const btnText = slotData ? slotData.fileName : `リスト${i + 1}`;

    // 切り替えボタン
    const selectBtn = document.createElement("button");
    selectBtn.className = "select-btn";
    selectBtn.textContent = btnText;
    selectBtn.title = btnText; // ホバー時にフルネーム表示
    selectBtn.dataset.idx = i;
    selectBtn.onclick = () => switchTimetable(i);
    
    // アップロードボタン
    const uploadLabel = document.createElement("label");
    uploadLabel.className = "upload-label";
    uploadLabel.textContent = slotData ? "更新" : "登録"; // 文言を少し変更
    
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".csv,.txt";
    fileInput.style.display = "none";
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
   時計・描画関連
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

  // 文字盤
  ctx.beginPath();
  ctx.arc(center, center, radius * 0.95, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = Math.max(4, radius * 0.03);
  ctx.strokeStyle = "#000";
  ctx.stroke();

  // 予定の残り時間（ピンク扇形）描画
  // データがあり、かつ現在進行中の予定がある場合のみ描画
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
    const x = c + Math.sin(a
