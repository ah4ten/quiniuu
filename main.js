import './style.css';
import { db } from './firebase.js';
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import * as XLSX from 'xlsx';

// ==========================================
// TÍNH NĂNG MẬT KHẨU
// ==========================================
const MY_PASSWORD = '11122003'; // <--- BẠN ĐỔI MẬT KHẨU CỦA BẠN Ở ĐÂY

const loginOverlay = document.getElementById('loginOverlay');
const passwordInput = document.getElementById('passwordInput');
const btnLogin = document.getElementById('btnLogin');
const loginError = document.getElementById('loginError');

// 1. Kiểm tra xem máy này đã từng đăng nhập đúng chưa
if (localStorage.getItem('isUnlocked') === 'true') {
  loginOverlay.style.display = 'none'; // Nếu đúng rồi thì giấu màn hình login đi
} else {
  loginOverlay.style.display = 'flex'; // Nếu chưa thì hiện lên bắt nhập
}

// 2. Xử lý khi bấm nút Đăng nhập
btnLogin.addEventListener('click', () => {
  if (passwordInput.value === MY_PASSWORD) {
    localStorage.setItem('isUnlocked', 'true'); // Lưu vào bộ nhớ trình duyệt
    loginOverlay.style.display = 'none'; // Mở khóa
  } else {
    loginError.style.display = 'block'; // Báo lỗi
  }
});

// 3. Hỗ trợ bấm phím Enter cho nhanh
passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    btnLogin.click();
  }
});
// ==========================================

let currentTopic = 'General';
let topicsArray = ['General'];
let allWords = [];

// Lấy các phần tử tĩnh từ HTML
const sidebar = document.getElementById('sidebar');
const mobileOverlay = document.getElementById('mobileOverlay');
const topicList = document.getElementById('topicList');
const vocabGrid = document.getElementById('vocabGrid');

// Gắn sự kiện cho các nút tĩnh
document.getElementById('btnToggleMenu').addEventListener('click', toggleMenu);
mobileOverlay.addEventListener('click', toggleMenu);
document.getElementById('btnAddTopic').addEventListener('click', addTopic);
document.getElementById('btnAddWord').addEventListener('click', addWord);
document
  .getElementById('btnExportExcel')
  .addEventListener('click', exportExcel);

const excelInput = document.getElementById('excelInput');
document
  .getElementById('btnImportExcel')
  .addEventListener('click', () => excelInput.click());
excelInput.addEventListener('change', importExcel);

// Các hàm xử lý
function toggleMenu() {
  sidebar.classList.toggle('active');
  mobileOverlay.classList.toggle('active');
}

const q = query(collection(db, 'vocabularies'), orderBy('createdAt', 'asc'));
onSnapshot(q, (snapshot) => {
  allWords = [];
  let tempTopics = new Set(['General']);

  snapshot.forEach((doc) => {
    const wordData = { id: doc.id, ...doc.data() };
    allWords.push(wordData);
    if (wordData.topic) tempTopics.add(wordData.topic);
  });

  if (!tempTopics.has(currentTopic)) {
    tempTopics.add(currentTopic);
  }

  topicsArray = Array.from(tempTopics);
  renderTopics();
  renderVocab();
});

function renderTopics() {
  topicList.innerHTML = '';

  topicsArray.forEach((topic) => {
    const li = document.createElement('li');
    li.className = `topic-item ${topic === currentTopic ? 'active' : ''}`;

    // Click vào tên chủ đề để chuyển đổi
    li.addEventListener('click', () => switchTopic(topic));

    const span = document.createElement('span');
    span.innerText = topic;
    li.appendChild(span);

    if (topic !== 'General') {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-topic-btn';
      deleteBtn.innerHTML = '✕';

      // Click vào dấu X để xóa chủ đề
      deleteBtn.addEventListener('click', (e) => deleteTopic(topic, e));
      li.appendChild(deleteBtn);
    }

    topicList.appendChild(li);
  });
  document.getElementById('currentTopicTitle').innerText =
    `Chủ đề: ${currentTopic}`;
}

function switchTopic(topic) {
  currentTopic = topic;
  renderTopics();
  renderVocab();
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('active');
    mobileOverlay.classList.remove('active');
  }
}

function addTopic() {
  const input = document.getElementById('newTopicInput');
  const newTopic = input.value.trim();
  if (newTopic && !topicsArray.includes(newTopic)) {
    topicsArray.push(newTopic);
    input.value = '';
    switchTopic(newTopic);
  }
}

async function deleteTopic(topicToDelete, event) {
  event.stopPropagation();
  if (topicToDelete === 'General') {
    alert('Bạn không thể xóa chủ đề mặc định!');
    return;
  }
  const confirmMsg = `Bạn có chắc chắn muốn xóa chủ đề "${topicToDelete}" không?\nToàn bộ từ vựng trong chủ đề này sẽ bị xóa vĩnh viễn.`;
  if (confirm(confirmMsg)) {
    try {
      const wordsToDelete = allWords.filter((w) => w.topic === topicToDelete);
      for (const word of wordsToDelete) {
        await deleteDoc(doc(db, 'vocabularies', word.id));
      }
      topicsArray = topicsArray.filter((t) => t !== topicToDelete);
      if (currentTopic === topicToDelete) {
        switchTopic('General');
      } else {
        renderTopics();
      }
    } catch (error) {
      console.error('Lỗi xóa chủ đề: ', error);
    }
  }
}

async function addWord() {
  const wordInput = document.getElementById('wordInput');
  const typeInput = document.getElementById('typeInput');
  const meaningInput = document.getElementById('meaningInput');

  const word = wordInput.value.trim();
  const type = typeInput.value;
  const meaning = meaningInput.value.trim();

  if (!word || !meaning) {
    alert('Vui lòng nhập Từ tiếng Hàn và Nghĩa tiếng Việt!');
    return;
  }

  try {
    await addDoc(collection(db, 'vocabularies'), {
      word: word,
      type: type,
      meaning: meaning,
      topic: currentTopic,
      createdAt: serverTimestamp()
    });

    wordInput.value = '';
    typeInput.value = 'Danh từ';
    meaningInput.value = '';
  } catch (error) {
    console.error('Lỗi thêm từ vựng: ', error);
  }
}

async function deleteWord(docId) {
  if (confirm('Bạn có chắc chắn muốn xóa từ này?')) {
    try {
      await deleteDoc(doc(db, 'vocabularies', docId));
    } catch (error) {
      console.error('Lỗi xóa từ vựng: ', error);
    }
  }
}

function renderVocab() {
  vocabGrid.innerHTML = '';
  const currentWords = allWords.filter((item) => item.topic === currentTopic);

  if (currentWords.length === 0) {
    vocabGrid.innerHTML =
      '<p style="color: var(--text-muted); grid-column: 1 / -1;">Chưa có từ vựng nào trong chủ đề này.</p>';
    return;
  }

  const reversedWords = [...currentWords].reverse();
  reversedWords.forEach((item, index) => {
    const stt = currentWords.length - index;
    const card = document.createElement('div');
    card.className = 'vocab-card';

    card.innerHTML = `
            <button class="delete-btn">✕</button>
            <div class="word-kr">
                <span class="word-stt">#${stt}</span> 
                ${item.word}
            </div>
            <div class="word-type">(${item.type})</div>
            <div class="word-vi">${item.meaning}</div>
        `;

    // Gắn sự kiện xóa từ vựng
    const delBtn = card.querySelector('.delete-btn');
    delBtn.addEventListener('click', () => deleteWord(item.id));

    vocabGrid.appendChild(card);
  });
}

function exportExcel() {
  if (allWords.length === 0) {
    alert('Bạn chưa có từ vựng nào để xuất Excel!');
    return;
  }
  const excelData = allWords.map((w, index) => ({
    STT: index + 1,
    'Chủ đề': w.topic,
    'Từ vựng': w.word,
    'Loại từ': w.type,
    'Nghĩa tiếng Việt': w.meaning
  }));
  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TuVung');
  XLSX.writeFile(wb, 'DanhSachTuVungHq.xlsx');
}

function importExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet);

      if (rows.length === 0) return alert('File trống!');
      if (!confirm(`Tìm thấy ${rows.length} từ. Bắt đầu nhập?`)) return;

      let successCount = 0;
      for (const row of rows) {
        const topic = row['Chủ đề'] || 'General';
        const word = row['Từ vựng'];
        const type = row['Loại từ'] || 'Danh từ';
        const meaning = row['Nghĩa tiếng Việt'];

        if (word && meaning) {
          await addDoc(collection(db, 'vocabularies'), {
            word: word.toString().trim(),
            type: type.toString().trim(),
            meaning: meaning.toString().trim(),
            topic: topic.toString().trim(),
            createdAt: serverTimestamp()
          });
          successCount++;
        }
      }
      alert(`✅ Đã nhập thành công ${successCount} từ vựng!`);
      event.target.value = '';
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra khi đọc file.');
    }
  };
  reader.readAsArrayBuffer(file);
}
