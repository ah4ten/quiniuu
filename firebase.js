import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCgYw_m6q8ktcolQwpnaJZyLAsxrmp47hw',
  authDomain: 'quiniuu.firebaseapp.com',
  projectId: 'quiniuu',
  storageBucket: 'quiniuu.firebasestorage.app',
  messagingSenderId: '765160656501',
  appId: '1:765160656501:web:95265915aa06fab59a323c',
  measurementId: 'G-9581LPG0YM'
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
