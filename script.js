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
  try {
    resizeCanvasForDPR();
    
    // 保存されたデータの読み込み（エラー対策済み）
    loadAllTimetablesFromStorage();
    
    // UI生成（右パネルのボタンなど）
    generateManagerUI();

    // 最初のリストを表示（データがなければ何もしない）
    switchTimetable(0);

    // 時計更新ループ
    drawClock();
    setInterval(() => {
      try {
        blinkState = !blinkState;
        updateCurrentPeriod();
        drawClock();
      } catch (e) {
        console.error("Loop Error:", e);
      }
    }, 1000);

    // ボタンイベント設定
    const setClick = (id, func) => {
      const el = document.getElementById(id);
      if (el) el.onclick = func;
    };

    setClick("btn-toggle-digital", () => { digitalVisible = !digitalVisible; updateDigitalClock(); });
    setClick("btn-now", speakNow);
    setClick("btn-remain", speakRemain);
    setClick("btn-toggle-minutes", () => { showMinuteFiveNumbers = !showMinuteFiveNumbers; drawClock(); });
    setClick("btn-toggle-minutes1", () => { showMinuteOneNumbers = !showMinuteOneNumbers; drawClock(); });
    setClick("btn-download-template", downloadSampleCSV);

    window.addEventListener("resize", () => { resizeCanvasForDPR(); drawClock(); });

  } catch (err) {
    console.error("Init Error:", err);
    alert("アプリの起動に失敗しました。データをリセットします。");
    localStorage.removeItem("my_clock_timetables_v2");
    location.reload();
  }
}

document.addEventListener("DOMContentLoaded", init);


/* --------------------------------------------------
   データ管理・CSV処理
-------------------------------------------------- */

// LocalStorageから全リストを復元（データ不整合対策）
function loadAllTimetablesFromStorage() {
  const saved = localStorage.getItem("my_clock_timetables_v2");
  
  // まず初期値でリセット
  allTimetables = [null, null, null, null, null];

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // 配列であり、かつデータ構造が正しいかチェック
      if (Array.isArray(parsed)) {
        for (let i = 0; i < 5; i++) {
          const item = parsed[i];
          // itemが有効なオブジェクトで、data配列を持っている場合のみ採用
          if (item && typeof item === "object" && Array.isArray(item.data)) {
            allTimetables[i] = item;
          }
        }
      }
    } catch (e) {
      console.error("データ読み込みエラー（初期化します）", e);
      localStorage.removeItem("my_clock_timetables_v2");
    }
  }
}

// データを保存
function saveAllTimetables() {
  try {
    localStorage.setItem("my_clock_timetables_v2", JSON.stringify(allTimetables));
  } catch (e) {
    console.error("保存エラー:", e);
    alert("データの保存に失敗しました（容量オーバーなどの可能性があります）。");
  }
}

// リスト切り替え
function switchTimetable(index) {
  currentSlotIndex = index;
  currentSlotData = allTimetables[index]; // データがない場合は null
  
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
  if (!file) return;
  
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
        alert("有効なデータが見つかりませんでした。見本データを参考にしてください。");
      }
    } catch (err) {
      console.error(err);
      alert("ファイルの読み込みに失敗しました。");
    }
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
      // 簡易チェック
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
  if (!container) return;
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
    selectBtn.title = btnText; 
    selectBtn.dataset.idx = i;
    selectBtn.onclick = () => switchTimetable(i);
    
    // アップロードボタン
    const uploadLabel = document.createElement("label");
    uploadLabel.className = "upload-label";
    uploadLabel.textContent = slotData ? "更新" : "登録"; 
    
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
  if (!canvas) return;
  const cssSize = Math.min(window.innerWidth * 0.6, 420);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width =
