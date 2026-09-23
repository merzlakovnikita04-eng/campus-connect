// ============================================================
// 🔥 FIREBASE — ПОЛНАЯ КОНФИГУРАЦИЯ (v7)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser
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
  onSnapshot,
  runTransaction
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

// ============================================================
// 👑 UID АДМИНА
// ============================================================

const ADMIN_UID = "FGCxozIMIEhz5ZTJAFhRWH7BJhe2";

// ============================================================
// 🔧 УТИЛИТЫ
// ============================================================

function convertIdToEmail(studentId) {
  const clean = studentId
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  return clean + '@campus-connect.ru';
}

// ============================================================
// 🔢 СЧЁТЧИК — через транзакцию
// ============================================================

async function getNextStudentNumber() {
  try {
    const counterRef = doc(db, "system", "counter");

    const nextNum = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      const last = counterDoc.exists() ? (counterDoc.data().lastNumber || 0) : 0;
      const next = last + 1;
      transaction.set(counterRef, { lastNumber: next }, { merge: true });
      return next;
    });

    const year = new Date().getFullYear();
    const padded = String(nextNum).padStart(3, '0');
    return `СТ-${year}-${padded}`;
  } catch (error) {
    console.error('❌ Ошибка счётчика:', error);
    throw new Error('Не удалось получить номер студенческого. Попробуйте позже.');
  }
}

// ============================================================
// 👤 РЕГИСТРАЦИЯ
// ============================================================

async function createPendingAccount(studentId, password, userData) {
  let createdUser = null;
  try {
    const email = convertIdToEmail(studentId);

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    createdUser = userCredential.user;

    await setDoc(doc(db, "pending", studentId), {
      name: userData.name,
      group: userData.group,
      spec: userData.spec,
      photo: userData.photo || null,
      uid: createdUser.uid,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    return { success: true, studentId, user: createdUser };
  } catch (error) {
    if (createdUser) {
      try { await deleteUser(createdUser); }
      catch (e) { console.warn('⚠️ Не удалось откатить Auth:', e.message); }
    }

    let message = 'Ошибка регистрации';
    if (error.code === 'auth/email-already-in-use') message = 'Этот номер уже зарегистрирован';
    else if (error.code === 'auth/weak-password') message = 'Слабый пароль (минимум 6 символов)';
    else if (error.code === 'auth/invalid-email') message = 'Неверный номер студенческого';
    else if (error.code === 'permission-denied') message = 'Ошибка доступа к базе. Обратитесь к админу.';
    else if (error.message) message = error.message;

    return { success: false, error: message };
  }
}

async function approvePending(studentId) {
  try {
    const pendingRef = doc(db, "pending", studentId);
    const pendingDoc = await getDoc(pendingRef);

    if (!pendingDoc.exists()) {
      return { success: false, error: 'Заявка не найдена' };
    }

    const p = pendingDoc.data();

    await setDoc(doc(db, "students", studentId), {
      name: p.name,
      group: p.group,
      spec: p.spec,
      premium: false,
      uid: p.uid || null,
      createdAt: new Date().toISOString()
    });

    await deleteDoc(pendingRef);

    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка одобрения:', error);
    return { success: false, error: error.message };
  }
}

async function registerStudent(studentId, password, userData) {
  let createdUser = null;
  try {
    const email = convertIdToEmail(studentId);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    createdUser = userCredential.user;

    await setDoc(doc(db, "students", studentId), {
      name: userData.name,
      group: userData.group,
      spec: userData.spec,
      premium: false,
      uid: createdUser.uid,
      createdAt: new Date().toISOString()
    });

    return { success: true, user: createdUser, studentId };
  } catch (error) {
    if (createdUser) {
      try { await deleteUser(createdUser); }
      catch (e) { console.warn('⚠️ Не удалось откатить Auth:', e.message); }
    }

    let message = 'Ошибка регистрации';
    if (error.code === 'auth/email-already-in-use') message = 'Этот номер уже зарегистрирован';
    else if (error.code === 'auth/weak-password') message = 'Слабый пароль';
    else if (error.code === 'auth/invalid-email') message = 'Неверный номер студенческого';
    return { success: false, error: message };
  }
}

// ============================================================
// 🔑 ВХОД СТУДЕНТА
// ============================================================

async function loginStudent(studentId, password) {
  try {
    const email = convertIdToEmail(studentId);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const studentDoc = await getDoc(doc(db, "students", studentId));
    if (!studentDoc.exists()) {
      const pendingDoc = await getDoc(doc(db, "pending", studentId));
      if (pendingDoc.exists()) {
        return { success: false, error: 'Заявка ещё не одобрена админом' };
      }
      return { success: false, error: 'Студент не найден в базе' };
    }

    return { success: true, user, studentId };
  } catch (error) {
    let message = 'Ошибка входа';
    if (error.code === 'auth/user-not-found') message = 'Студент не найден';
    else if (error.code === 'auth/wrong-password') message = 'Неверный пароль';
    else if (error.code === 'auth/invalid-credential') message = 'Неверный номер или пароль';
    else if (error.code === 'auth/too-many-requests') message = 'Слишком много попыток. Попробуйте позже.';
    return { success: false, error: message };
  }
}

// ============================================================
// 👑 ВХОД АДМИНА
// ============================================================

async function loginAdmin(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (user.uid !== ADMIN_UID) {
      await signOut(auth);
      return { success: false, error: 'Это не админский аккаунт' };
    }

    return { success: true, user };
  } catch (error) {
    let message = 'Ошибка входа';
    if (error.code === 'auth/user-not-found') message = 'Админ не найден';
    else if (error.code === 'auth/wrong-password') message = 'Неверный пароль';
    else if (error.code === 'auth/invalid-credential') message = 'Неверный email или пароль';
    else if (error.code === 'auth/invalid-email') message = 'Неверный email';
    return { success: false, error: message };
  }
}

// ============================================================
// 🚪 ВЫХОД
// ============================================================

async function logoutStudent() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// 🔍 ПОИСК СТУДЕНТА ПО UID
// ============================================================

async function getStudentByUid(uid) {
  try {
    const q = query(collection(db, "students"), where("uid", "==", uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: false, error: 'Студент не найден' };
    }

    const docSnap = snapshot.docs[0];
    return {
      success: true,
      studentId: docSnap.id,
      data: docSnap.data()
    };
  } catch (error) {
    console.error('❌ Ошибка поиска по uid:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// 📝 ЗАЯВКИ
// ============================================================

async function savePending(studentId, data) {
  try {
    await setDoc(doc(db, "pending", studentId), {
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getPending() {
  try {
    const snapshot = await getDocs(collection(db, "pending"));
    const pending = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return { success: true, pending };
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
    snapshot.docs.forEach(d => { students[d.id] = d.data(); });
    return { success: true, students };
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
    return { success: true, ads };
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
    return { success: true, listings };
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
    return { success: true, absences };
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
// 📍 РЯДОМ (где народ)
// ============================================================

async function setWhereabout(studentId, studentName, uid, place, classroom) {
  try {
    await setDoc(doc(db, "whereabouts", uid), {
      studentId: studentId,
      studentName: studentName,
      uid: uid,
      place: place,
      classroom: classroom || '',
      timestamp: Date.now()
    });
    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка отметки:', error);
    return { success: false, error: error.message };
  }
}

async function getWhereabouts() {
  try {
    const snapshot = await getDocs(collection(db, "whereabouts"));
    const now = Date.now();
    const fifteenMin = 15 * 60 * 1000;

    const fresh = snapshot.docs
      .map(d => d.data())
      .filter(w => (now - (w.timestamp || 0)) < fifteenMin);

    return { success: true, whereabouts: fresh };
  } catch (error) {
    return { success: false, error: error.message, whereabouts: [] };
  }
}

async function clearMyWhereabout(uid) {
  try {
    await deleteDoc(doc(db, "whereabouts", uid));
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
    snapshot.docs.forEach(d => { votes[d.id] = d.data(); });
    return { success: true, votes };
  } catch (error) {
    return { success: false, error: error.message, votes: {} };
  }
}

async function saveVotes(votes) {
  try {
    for (const category in votes) {
      const data = votes[category];
      await setDoc(doc(db, "votes", category), {
        options: data.options || []
      });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function hasVotedToday(uid, category) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const logId = uid + '_' + category + '_' + today;
    const logDoc = await getDoc(doc(db, "votes_log", logId));
    return { success: true, voted: logDoc.exists() };
  } catch (error) {
    console.error('❌ Ошибка проверки голоса:', error);
    return { success: false, voted: false, error: error.message };
  }
}

async function getMyVotesToday(uid) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const q = query(
      collection(db, "votes_log"),
      where("uid", "==", uid),
      where("date", "==", today)
    );
    const snapshot = await getDocs(q);
    const voted = {};
    snapshot.docs.forEach(d => {
      voted[d.data().category] = true;
    });
    return { success: true, voted };
  } catch (error) {
    return { success: false, voted: {}, error: error.message };
  }
}

async function voteForCandidate(category, index, uid) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const logId = uid + '_' + category + '_' + today;
    const logRef = doc(db, "votes_log", logId);
    const voteRef = doc(db, "votes", category);

    await runTransaction(db, async (transaction) => {
      const logDoc = await transaction.get(logRef);
      if (logDoc.exists()) {
        throw new Error('ALREADY_VOTED');
      }

      const voteDoc = await transaction.get(voteRef);
      if (!voteDoc.exists()) {
        throw new Error('CATEGORY_NOT_FOUND');
      }

      const data = voteDoc.data();
      if (!data.options || !data.options[index]) {
        throw new Error('CANDIDATE_NOT_FOUND');
      }

      const options = [...data.options];
      options[index] = {
        ...options[index],
        votes: (options[index].votes || 0) + 1
      };

      transaction.set(voteRef, { options });
      transaction.set(logRef, {
        uid: uid,
        category: category,
        candidateIndex: index,
        candidateName: options[index].name,
        date: today,
        timestamp: new Date().toISOString()
      });
    });

    return { success: true };
  } catch (error) {
    if (error.message === 'ALREADY_VOTED') {
      return { success: false, error: 'Вы уже голосовали сегодня в этой категории' };
    }
    if (error.message === 'CATEGORY_NOT_FOUND') {
      return { success: false, error: 'Категория не найдена' };
    }
    if (error.message === 'CANDIDATE_NOT_FOUND') {
      return { success: false, error: 'Кандидат не найден' };
    }
    console.error('❌ Ошибка голосования:', error);
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
  ADMIN_UID,
  convertIdToEmail,
  getNextStudentNumber,
  createPendingAccount,
  approvePending,
  registerStudent,
  loginStudent,
  loginAdmin,
  logoutStudent,
  getStudentByUid,
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
  setWhereabout,
  getWhereabouts,
  clearMyWhereabout,
  getVotes,
  saveVotes,
  hasVotedToday,
  getMyVotesToday,
  voteForCandidate,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  runTransaction,
  deleteUser,
  query,
  where,
  onSnapshot
};
