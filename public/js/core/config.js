// Firebase + Cloudinary configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeFirestore, persistentLocalCache } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDjWCcfJbOQjfsiY7d0d-4HnPsO7OSYPuQ',
  authDomain: 'vestiairedevetement.firebaseapp.com',
  projectId: 'vestiairedevetement',
  storageBucket: 'vestiairedevetement.firebasestorage.app',
  messagingSenderId: '43682056639',
  appId: '1:43682056639:web:569f4b32856b33f887b90a',
  measurementId: 'G-CM087Y8MQK'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Keep a local IndexedDB cache so returning users see their wardrobe immediately
// while Firestore refreshes it in the background.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});

export const CLOUDINARY_CLOUD_NAME = 'spiwowan';
export const CLOUDINARY_UPLOAD_PRESET = 'vestiaire_upload';
