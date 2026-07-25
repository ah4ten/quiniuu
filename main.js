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

let currentTopic = 'General';
let topicsArray = ['General'];
let allWords = [];

window.toggleMenu = () => {
  document.getElementById('sidebar').classList.toggle('active');
  document.getElementById('mobileOverlay').classList.toggle('active');
};

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
  const topicList = document.getElementById('topicList');
  topicList.innerHTML = '';

  topicsArray.forEach((topic) => {
    const li = document.createElement('li');
    li.className = `topic-item ${topic === currentTopic ? 'active' : ''}`;
    li.onclick = () => window.switchTopic(topic);

    const span = document.createElement('span');
    span.innerText = topic;
    li.appendChild(span);

    if (topic !== 'General') {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-topic-btn';
      deleteBtn.innerHTML = '✕';
      deleteBtn.onclick = (e) => window.deleteTopic(topic, e);
      li.appendChild(deleteBtn);
    }

    topicList.appendChild(li);
  });
  document.getElementById('currentTopicTitle').innerText =
    `Chủ đề: ${currentTopic}`;
}

window.switchTopic = (topic) => {
  currentTopic = topic;
  renderTopics();
  renderVocab();
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('mobileOverlay').classList.remove('active');
  }
};

window.addTopic = () => {
  const input = document.getElementById('newTopicInput');
  const newTopic = input.value.trim();
  if (newTopic && !topicsArray.includes(newTopic)) {
    topicsArray.push(newTopic);
    input.value = '';
    window.switchTopic(newTopic);
  }
};

window.deleteTopic = async (topicToDelete, event) => {
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
        window.switchTopic('General');
      } else {
        renderTopics();
      }
    } catch (error) {
      console.error('Lỗi xóa chủ đề: ', error);
    }
  }
};

window.addWord = async () => {
  const word = document.getElementById('wordInput').value.trim();
  const type = document.getElementById('typeInput').value;
  const meaning = document.getElementById('meaningInput').value.trim();

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
    document.getElementById('wordInput').value = '';
    document.getElementById('typeInput').value = 'Danh từ'; // Trả về mặc định là Danh từ
    document.getElementById('meaningInput').value = '';
  } catch (error) {
    console.error('Lỗi thêm từ vựng: ', error);
  }
};

window.deleteWord = async (docId) => {
  if (confirm('Bạn có chắc chắn muốn xóa từ này?')) {
    try {
      await deleteDoc(doc(db, 'vocabularies', docId));
    } catch (error) {
      console.error('Lỗi xóa từ vựng: ', error);
    }
  }
};

function renderVocab() {
  const grid = document.getElementById('vocabGrid');
  grid.innerHTML = '';
  const currentWords = allWords.filter((item) => item.topic === currentTopic);

  if (currentWords.length === 0) {
    grid.innerHTML =
      '<p style="color: var(--text-muted); grid-column: 1 / -1;">Chưa có từ vựng nào trong chủ đề này.</p>';
    return;
  }

  const reversedWords = [...currentWords].reverse();
  reversedWords.forEach((item, index) => {
    const stt = currentWords.length - index;
    const card = document.createElement('div');
    card.className = 'vocab-card';
    card.innerHTML = `
            <button class="delete-btn" onclick="window.deleteWord('${item.id}')">✕</button>
            <div class="word-kr">
                <span class="word-stt">#${stt}</span> 
                ${item.word}
            </div>
            <div class="word-type">(${item.type})</div>
            <div class="word-vi">${item.meaning}</div>
        `;
    grid.appendChild(card);
  });
}

window.exportExcel = () => {
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
};

window.importExcel = (event) => {
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
};
