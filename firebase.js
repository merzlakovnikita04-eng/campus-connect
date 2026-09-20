// ============================================================
// 🔥 FIREBASE — ПОЛНАЯ КОНФИГУРАЦИЯ
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  updateDoc,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ============================================================
// 🔑 КОНФИГУРАЦИЯ
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyDKHRV3fd6-C5x5yYMi0PJXQErFs0jWwUo",
  authDomain: "campus-connect-23674.firebaseapp.com",
  projectId: "campus-connect-23674",
  storageBucket: "campus-connect-23674.firebasestorage.app",
  messagingSenderId: "588298166044",
  appId: "1:588298166044:web:fd0c8b894ec29b3cae64d9"
};

// ============================================================
// 🚀 ИНИЦИАЛИЗАЦИЯ
// ============================================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log('✅ Firebase подключён');
console.log('📦 Проект:', firebaseConfig.projectId);

// ============================================================
// 🔧 УТИЛИТЫ
// ============================================================

function convertIdToEmail(studentId) {
  return studentId.toLowerCase().replace(/[^a-z0-9-]/g, '') + '@campus-connect.ru';
}

function hashPassword(password) {
  let hash = 0;
  const salt = "college_salt_2026";
  const str = salt + password + salt;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + password.length;
}

// ============================================================
// 🔢 СЧЁТЧИК СТУДЕНЧЕСКИХ (в Firestore — один для всех)
// ============================================================

async function getNextStudentNumber() {
  try {
    const counterRef = doc(db, "system", "counter");
    const counterDoc = await getDoc(counterRef);

    let nextNum = 1;
    if (counterDoc.exists()) {
      nextNum = (counterDoc.data().lastNumber || 0) + 1;
    }

    await setDoc(counterRef, { lastNumber: nextNum }, { merge: true });

    const year = new Date().getFullYear();
    const padded = String(nextNum).padStart(3, '0');
    console.log('🔢 Следующий номер:', `СТ-${year}-${padded}`);
    return `СТ-${year}-${padded}`;
  } catch (error) {
    console.error('❌ Ошибка счётчика:', error);
    const year = new Date().getFullYear();
    const fallback = String(Date.now()).slice(-3);
    return `СТ-${year}-${fallback}`;
  }
}

// ============================================================
// 👤 РЕГИСТРАЦИЯ
// ============================================================

async function registerStudent(studentId, password, userData) {
  try {
    const email = convertIdToEmail(studentId);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "students", studentId), {
      name: userData.name,
      group: userData.group,
      spec: userData.spec,
      premium: false,
      createdAt: new Date().toISOString(),
      uid: user.uid
    });

    console.log('✅ Студент зарегистрирован:', studentId);
    return { success: true, user: user, studentId: studentId };
  } catch (error) {
    console.error('❌ Ошибка регистрации:', error.message);
    let message = 'Ошибка регистрации';
    if (error.code === 'auth/email-already-in-use') message = 'Этот номер уже зарегистрирован';
    else if (error.code === 'auth/weak-password') message = 'Слабый пароль';
    else if (error.code === 'auth/invalid-email') message = 'Неверный номер студенческого';
    return { success: false, error: message };
  }
}

// ============================================================
// 🔑 ВХОД
// ============================================================

async function loginStudent(studentId, password) {
  try {
    const email = convertIdToEmail(studentId);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const studentDoc = await getDoc(doc(db, "students", studentId));
    if (!studentDoc.exists()) {
      return { success: false, error: 'Студент не найден в базе' };
    }

    localStorage.setItem('studentId', studentId);
    console.log('✅ Вход выполнен:', studentId);
    return { success: true, user: user, studentId: studentId };
  } catch (error) {
    console.error('❌ Ошибка входа:', error.message);
    let message = 'Ошибка входа';
    if (error.code === 'auth/user-not-found') message = 'Студент не найден';
    else if (error.code === 'auth/wrong-password') message = 'Неверный пароль';
    else if (error.code === 'auth/invalid-credential') message = 'Неверный номер или пароль';
    else if (error.code === 'auth/too-many-requests') message = 'Слишком много попыток';
    return { success: false, error: message };
  }
}

// ============================================================
// 🚪 ВЫХОД
// ============================================================

async function logoutStudent() {
  try {
    await signOut(auth);
    localStorage.removeItem('studentId');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// 📝 ЗАЯВКИ
// ============================================================

async function savePending(studentId, data) {
  try {
    console.log('📝 Сохраняем заявку:', studentId);
    await setDoc(doc(db, "pending", studentId), {
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    console.log('✅ Заявка сохранена');
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка savePending:', error.message);
    return { success: false, error: error.message };
  }
}

async function getPending() {
  try {
    const snapshot = await getDocs(collection(db, "pending"));
    const pending = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return { success: true, pending: pending };
  } catch (error) {
    return { success: false, error: error.message, pending: [] };
  }
}

async function deletePending(studentId) {
  try {
    await deleteDoc(doc(db, "pending", studentId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// 👥 СТУДЕНТЫ
// ============================================================

async function getStudents() {
  try {
    const snapshot = await getDocs(collection(db, "students"));
    const students = {};
    snapshot.docs.forEach(d => {
      students[d.id] = d.data();
    });
    return { success: true, students: students };
  } catch (error) {
    return { success: false, error: error.message, students: {} };
  }
}

async function saveStudent(studentId, data) {
  try {
    await setDoc(doc(db, "students", studentId), data, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deleteStudent(studentId) {
  try {
    await deleteDoc(doc(db, "students", studentId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// 📢 РЕКЛАМА
// ============================================================

async function getAds() {
  try {
    const snapshot = await getDocs(collection(db, "ads"));
    const ads = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return { success: true, ads: ads };
  } catch (error) {
    return { success: false, error: error.message, ads: [] };
  }
}

async function saveAd(adId, data) {
  try {
    await setDoc(doc(db, "ads", adId), data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deleteAd(adId) {
  try {
    await deleteDoc(doc(db, "ads", adId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// 🛒 ОБЪЯВЛЕНИЯ
// ============================================================

async function getListings() {
  try {
    const snapshot = await getDocs(collection(db, "listings"));
    const listings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return { success: true, listings: listings };
  } catch (error) {
    return { success: false, error: error.message, listings: [] };
  }
}

async function saveListing(listingId, data) {
  try {
    await setDoc(doc(db, "listings", listingId), data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deleteListing(listingId) {
  try {
    await deleteDoc(doc(db, "listings", listingId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// 📅 ОТСУТСТВИЯ
// ============================================================

async function getAbsences() {
  try {
    const snapshot = await getDocs(collection(db, "absences"));
    const absences = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return { success: true, absences: absences };
  } catch (error) {
    return { success: false, error: error.message, absences: [] };
  }
}

async function saveAbsence(absenceId, data) {
  try {
    await setDoc(doc(db, "absences", absenceId), data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deleteAbsence(absenceId) {
  try {
    await deleteDoc(doc(db, "absences", absenceId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// 🏆 ГОЛОСОВАНИЕ
// ============================================================

async function getVotes() {
  try {
    const snapshot = await getDocs(collection(db, "votes"));
    const votes = {};
    snapshot.docs.forEach(d => {
      votes[d.id] = d.data();
    });
    return { success: true, votes: votes };
  } catch (error) {
    return { success: false, error: error.message, votes: {} };
  }
}

async function saveVotes(votes) {
  try {
    for (const category in votes) {
      await setDoc(doc(db, "votes", category), { options: votes[category] });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// 📤 ЭКСПОРТ
// ============================================================

export {
  app,
  auth,
  db,
  firebaseConfig,
  convertIdToEmail,
  hashPassword,
  getNextStudentNumber,
  registerStudent,
  loginStudent,
  logoutStudent,
  onAuthStateChanged,
  savePending,
  getPending,
  deletePending,
  getStudents,
  saveStudent,
  deleteStudent,
  getAds,
  saveAd,
  deleteAd,
  getListings,
  saveListing,
  deleteListing,
  getAbsences,
  saveAbsence,
  deleteAbsence,
  getVotes,
  saveVotes,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  onSnapshot
};
