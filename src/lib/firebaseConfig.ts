import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAUIbY2I-Iprb6qsNQ-qutre0qffJxVwOg',
  authDomain: 'umrohan-64e06.firebaseapp.com',
  projectId: 'umrohan-64e06',
  storageBucket: 'umrohan-64e06.firebasestorage.app',
  messagingSenderId: '785734169801',
  appId: '1:785734169801:web:7e0dfc6100990294854918',
};

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export { db };
