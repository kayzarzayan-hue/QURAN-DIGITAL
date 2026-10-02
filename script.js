const API_BASE = 'https://equran.id/api/v2';
const RECITER_NAMES = {
  '01': 'Abdullah Al-Juhany',
  '02': 'Abdul Muhsin Al-Qasim',
  '03': 'Abdurrahman As-Sudais',
  '04': 'Ibrahim Al-Dossari',
  '05': 'Misyari Rasyid Al-Afasi',
  '06': 'Yasser Al-Dosari'
};

const state = {
  surahs: [],
  selectedSurah: null,
  ayat: [],
  activeView: 'quran',
  mode: 'guess',
  score: 0,
  round: 0,
  question: null,
  answered: false,
  detailRequest: 0
};

const elements = {
  appStatus: document.querySelector('#app-status'),
  surahList: document.querySelector('#surah-list'),
  surahCount: document.querySelector('#surah-count'),
  surahSearch: document.querySelector('#surah-search'),
  quranView: document.querySelector('#quran-view'),
  mentorView: document.querySelector('#mentor-view'),
  readingLoading: document.querySelector('#reading-loading'),
  readingError: document.querySelector('#reading-error'),
  readingContent: document.querySelector('#reading-content'),
  readingEmpty: document.querySelector('#reading-empty'),
  surahTitle: document.querySelector('#surah-title'),
  surahMeta: document.querySelector('#surah-meta'),
  surahArabicName: document.querySelector('#surah-arabic-name'),
  audioPlayer: document.querySelector('#audio-player'),
  reciterSelect: document.querySelector('#reciter-select'),
  surahAudio: document.querySelector('#surah-audio'),
  audioStatus: document.querySelector('#audio-status'),
  ayahList: document.querySelector('#ayah-list'),
  mentorSurahLabel: document.querySelector('#mentor-surah-label'),
  scoreValue: document.querySelector('#score-value'),
  quizContent: document.querySelector('#quiz-content'),
  quizMessage: document.querySelector('#quiz-message'),
  questionLabel: document.querySelector('#question-label'),
  roundNumber: document.querySelector('#round-number'),
  questionArabic: document.querySelector('#question-arabic'),
  questionHint: document.querySelector('#question-hint'),
  answerOptions: document.querySelector('#answer-options'),
  answerFeedback: document.querySelector('#answer-feedback'),
  nextQuestion: document.querySelector('#next-question'),
  restartQuiz: document.querySelector('#restart-quiz')
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Server mengirim status ${response.status}.`);
  return response.json();
}

async function loadSurahs() {
  setAppStatus('Memuat daftar surat...');
  try {
    const response = await fetchJson(`${API_BASE}/surat`);
    if (!Array.isArray(response.data)) throw new Error('Format daftar surat dari API tidak sesuai.');
    state.surahs = response.data;
    elements.surahCount.textContent = String(state.surahs.length).padStart(2, '0');
    renderSurahList();
    setAppStatus(`${state.surahs.length} surat siap dipilih.`);
    if (state.surahs.length > 0) loadSurah(state.surahs[0]);
  } catch (error) {
    elements.surahList.textContent = 'Daftar surat tidak dapat dimuat.';
    setAppStatus(`Gagal memuat daftar surat. ${error.message}`, true);
  }
}

function renderSurahList() {
  const searchTerm = elements.surahSearch.value.trim().toLocaleLowerCase('id');
  const visibleSurahs = state.surahs.filter((surah) => `${surah.nomor} ${surah.namaLatin} ${surah.arti}`.toLocaleLowerCase('id').includes(searchTerm));
  elements.surahList.replaceChildren();
  if (visibleSurahs.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-note';
    empty.textContent = 'Surat tidak ditemukan.';
    elements.surahList.append(empty);
    return;
  }
  visibleSurahs.forEach((surah) => {
    const button = document.createElement('button');
    const selected = state.selectedSurah?.nomor === surah.nomor;
    button.type = 'button';
    button.className = `surah-item${selected ? ' is-selected' : ''}`;
    button.setAttribute('aria-pressed', String(selected));
    button.innerHTML = `<span class="surah-number">${surah.nomor}</span><span class="surah-item-copy"><strong>${escapeHtml(surah.namaLatin)}</strong><small>${escapeHtml(surah.arti)} · ${surah.jumlahAyat} ayat</small></span><span class="surah-item-arabic" lang="ar" dir="rtl">${escapeHtml(surah.nama)}</span>`;
    button.addEventListener('click', () => loadSurah(surah));
    elements.surahList.append(button);
  });
}

async function loadSurah(surah) {
  const requestId = ++state.detailRequest;
  state.selectedSurah = surah;
  state.ayat = [];
  state.question = null;
  state.round = 0;
  state.score = 0;
  elements.scoreValue.textContent = '0';
  renderSurahList();
  elements.readingLoading.hidden = false;
  elements.readingError.hidden = true;
  elements.readingContent.hidden = true;
  elements.readingEmpty.hidden = true;
  resetAudioPlayer();
  elements.mentorSurahLabel.textContent = `Memuat ${surah.namaLatin}...`;
  renderQuizMessage('Memuat surat', 'Ayat sedang disiapkan dari sumber API.');
  setAppStatus(`Memuat surat ${surah.namaLatin}...`);
  try {
    const response = await fetchJson(`${API_BASE}/surat/${surah.nomor}`);
    if (requestId !== state.detailRequest) return;
    if (!response.data || !Array.isArray(response.data.ayat)) throw new Error('Format ayat dari API tidak sesuai.');
    state.selectedSurah = response.data;
    state.ayat = response.data.ayat;
    renderReading(response.data);
    elements.readingLoading.hidden = true;
    elements.readingContent.hidden = false;
    elements.mentorSurahLabel.textContent = `${response.data.namaLatin} · ${state.ayat.length} ayat`;
    renderQuizMessage('Siap untuk murajaah', 'Pilih mode latihan untuk membuat soal dari ayat surat ini.');
    setAppStatus(`Surat ${response.data.namaLatin} berhasil dimuat.`);
  } catch (error) {
    if (requestId !== state.detailRequest) return;
    elements.readingLoading.hidden = true;
    elements.readingError.hidden = false;
    elements.readingError.textContent = `Surat tidak dapat dimuat. ${error.message} Periksa koneksi lalu pilih surat lagi.`;
    elements.mentorSurahLabel.textContent = 'Surat belum berhasil dimuat.';
    renderQuizMessage('Surat belum tersedia', 'Periksa koneksi internet, lalu pilih surat lagi dari menu Al-Qur\'an.');
    setAppStatus(`Gagal memuat surat ${surah.namaLatin}.`, true);
  }
}

function renderReading(surah) {
  elements.surahTitle.textContent = surah.namaLatin;
  elements.surahMeta.textContent = `${surah.arti} · ${surah.jumlahAyat} ayat · ${surah.tempatTurun}`;
  elements.surahArabicName.textContent = surah.nama;
  renderAudioPlayer(surah.audioFull);
  elements.ayahList.replaceChildren();
  surah.ayat.forEach((ayah, index) => {
    const row = document.createElement('article');
    row.className = 'ayah-row';
    row.style.animationDelay = `${Math.min(index * 35, 280)}ms`;
    const number = document.createElement('span');
    number.className = 'ayah-number';
    number.textContent = ayah.nomorAyat;
    const copy = document.createElement('div');
    copy.className = 'ayah-copy';
    const arabic = document.createElement('p');
    arabic.className = 'ayah-arabic';
    arabic.lang = 'ar';
    arabic.dir = 'rtl';
    arabic.textContent = ayah.teksArab;
    copy.append(arabic);
    if (ayah.teksIndonesia) {
      const translation = document.createElement('p');
      translation.className = 'ayah-translation';
      translation.textContent = ayah.teksIndonesia;
      copy.append(translation);
    }
    row.append(number, copy);
    elements.ayahList.append(row);
  });
}

function renderAudioPlayer(audioFull) {
  const tracks = Object.entries(audioFull || {}).filter(([, url]) => typeof url === 'string' && url.trim());
  elements.reciterSelect.replaceChildren();
  elements.audioPlayer.hidden = false;

  if (tracks.length === 0) {
    elements.reciterSelect.hidden = true;
    elements.surahAudio.hidden = true;
    elements.audioStatus.textContent = 'Audio tidak tersedia untuk surat ini.';
    return;
  }

  elements.reciterSelect.hidden = false;
  elements.surahAudio.hidden = false;
  tracks.forEach(([key, url]) => {
    const option = document.createElement('option');
    option.value = url;
    option.textContent = RECITER_NAMES[key] || `Qari ${key}`;
    elements.reciterSelect.append(option);
  });
  updateAudioTrack();
}

function resetAudioPlayer() {
  elements.surahAudio.pause();
  elements.surahAudio.removeAttribute('src');
  elements.surahAudio.load();
  elements.audioPlayer.hidden = true;
  elements.audioStatus.textContent = '';
}

function updateAudioTrack() {
  const selectedReciter = elements.reciterSelect.selectedOptions[0];
  if (!selectedReciter) return;
  elements.surahAudio.pause();
  elements.surahAudio.src = selectedReciter.value;
  elements.surahAudio.load();
  elements.audioStatus.textContent = `Audio surat siap diputar · ${selectedReciter.textContent}.`;
}

function makeQuestion() {
  if (state.ayat.length < 4) {
    state.question = null;
    elements.quizContent.hidden = true;
    renderQuizMessage('Pilih surat lain', 'Surat ini memiliki kurang dari empat ayat. Pilih surat lain agar tersedia tiga pilihan jawaban yang tidak ambigu.');
    return;
  }
  const question = state.mode === 'guess' ? createNumberQuestion(state.ayat) : createContinuationQuestion(state.ayat);
  if (!question) {
    state.question = null;
    elements.quizContent.hidden = true;
    renderQuizMessage('Soal belum dapat dibuat', 'API belum menyediakan tiga pilihan yang berbeda untuk mode ini. Pilih surat lain.');
    return;
  }
  state.question = question;
  state.round += 1;
  state.answered = false;
  renderQuestion(question);
}

function createNumberQuestion(ayat) {
  const prompt = pickRandom(ayat);
  const distractors = shuffleArray(ayat.filter((ayah) => ayah.nomorAyat !== prompt.nomorAyat)).slice(0, 2);
  const options = [
    { value: prompt.nomorAyat, label: String(prompt.nomorAyat), correct: true },
    ...distractors.map((ayah) => ({ value: ayah.nomorAyat, label: String(ayah.nomorAyat), correct: false }))
  ];
  return { prompt, options: shuffleArray(options), correctValue: prompt.nomorAyat };
}

function createContinuationQuestion(ayat) {
  const prompt = pickRandom(ayat.slice(0, -1));
  const correctAyah = ayat.find((ayah) => ayah.nomorAyat === prompt.nomorAyat + 1);
  if (!correctAyah) return null;
  const usedTexts = new Set([prompt.teksArab, correctAyah.teksArab]);
  const distractors = shuffleArray(ayat.filter((ayah) => {
    if (ayah.nomorAyat === prompt.nomorAyat || ayah.nomorAyat === correctAyah.nomorAyat || usedTexts.has(ayah.teksArab)) return false;
    usedTexts.add(ayah.teksArab);
    return true;
  })).slice(0, 2);
  if (distractors.length < 2) return null;
  const options = [
    { value: correctAyah.teksArab, label: correctAyah.teksArab, correct: true },
    ...distractors.map((ayah) => ({ value: ayah.teksArab, label: ayah.teksArab, correct: false }))
  ];
  return { prompt, options: shuffleArray(options), correctValue: correctAyah.teksArab };
}

function renderQuestion(question) {
  elements.quizMessage.hidden = true;
  elements.quizContent.hidden = false;
  elements.questionLabel.textContent = state.mode === 'guess' ? 'TEBAK NOMOR AYAT' : 'SAMBUNG AYAT BERIKUTNYA';
  elements.roundNumber.textContent = `RONDE ${String(state.round).padStart(2, '0')}`;
  elements.questionArabic.textContent = question.prompt.teksArab;
  elements.questionHint.textContent = state.mode === 'guess' ? 'Ayat ini adalah nomor berapa dalam surat yang dipilih?' : 'Pilih teks ayat yang tepat sesudah ayat di atas.';
  elements.answerFeedback.textContent = '';
  elements.answerFeedback.className = 'answer-feedback';
  elements.answerOptions.replaceChildren();
  question.options.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer-option';
    if (state.mode === 'continue') button.innerHTML = `<span class="answer-option-arabic" lang="ar" dir="rtl">${escapeHtml(option.label)}</span>`;
    else button.textContent = option.label;
    button.addEventListener('click', () => checkAnswer(button, option));
    elements.answerOptions.append(button);
  });
}

function checkAnswer(button, option) {
  if (state.answered) return;
  state.answered = true;
  elements.answerOptions.querySelectorAll('button').forEach((answerButton) => { answerButton.disabled = true; });
  if (option.value === state.question.correctValue) {
    state.score += 10;
    elements.scoreValue.textContent = String(state.score);
    button.classList.add('is-correct');
    elements.answerFeedback.textContent = 'Benar! Skor bertambah 10 poin.';
    elements.answerFeedback.classList.add('is-correct');
  } else {
    button.classList.add('is-wrong');
    const correctOption = state.question.options.find((answer) => answer.correct);
    elements.answerOptions.querySelectorAll('button').forEach((answerButton, index) => {
      if (state.question.options[index] === correctOption) answerButton.classList.add('is-correct');
    });
    elements.answerFeedback.textContent = `Belum tepat. Jawaban benar: ${correctOption.label}`;
    elements.answerFeedback.classList.add('is-wrong');
  }
}

function renderQuizMessage(title, message) {
  elements.quizContent.hidden = true;
  elements.quizMessage.hidden = false;
  elements.quizMessage.replaceChildren();
  const symbol = document.createElement('span');
  symbol.className = 'empty-symbol';
  symbol.setAttribute('aria-hidden', 'true');
  symbol.textContent = '۞';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const text = document.createElement('p');
  text.textContent = message;
  elements.quizMessage.append(symbol, heading, text);
}

function setAppStatus(message, isError = false) {
  elements.appStatus.textContent = message;
  elements.appStatus.classList.toggle('is-error', isError);
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

document.querySelectorAll('.nav-tab').forEach((button) => {
  button.addEventListener('click', () => {
    state.activeView = button.dataset.view;
    document.querySelectorAll('.nav-tab').forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    elements.quranView.hidden = state.activeView !== 'quran';
    elements.mentorView.hidden = state.activeView !== 'mentor';
  });
});

document.querySelectorAll('.mode-button').forEach((button) => {
  button.addEventListener('click', () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll('.mode-button').forEach((modeButton) => {
      const active = modeButton === button;
      modeButton.classList.toggle('is-active', active);
      modeButton.setAttribute('aria-pressed', String(active));
    });
    if (state.ayat.length > 0) makeQuestion();
  });
});

elements.surahSearch.addEventListener('input', renderSurahList);
elements.reciterSelect.addEventListener('change', updateAudioTrack);
elements.surahAudio.addEventListener('playing', () => {
  elements.audioStatus.textContent = 'Audio sedang diputar.';
});
elements.surahAudio.addEventListener('error', () => {
  elements.audioStatus.textContent = 'Audio gagal dimuat. Periksa koneksi internet atau pilih qari lain.';
});
elements.nextQuestion.addEventListener('click', makeQuestion);
elements.restartQuiz.addEventListener('click', () => {
  state.score = 0;
  state.round = 0;
  elements.scoreValue.textContent = '0';
  if (state.ayat.length > 0) makeQuestion();
});

loadSurahs();