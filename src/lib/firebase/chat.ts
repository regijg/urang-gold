import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export async function sendMessage(agentId: string, message: string, sender: 'agent') {
  if (!agentId) throw new Error('agentId harus ada');

  const chatroomRef = doc(db, 'chatrooms', agentId);

  // Cek apakah chatroom sudah ada
  const chatroomSnap = await getDoc(chatroomRef);

  if (!chatroomSnap.exists()) {
    // Kalau belum ada, buat dokumen baru dengan data awal
    await setDoc(chatroomRef, {
      lastMessage: message,
      lastTime: serverTimestamp(),
      unreadCount: sender ? 0 : 1,
      agentName: agentId, // bisa diubah sesuai data sebenarnya
      avatarUrl: '/default-avatar.png', // default avatar
    });
  } else {
    // Kalau sudah ada, update data chatroom
    await updateDoc(chatroomRef, {
      lastMessage: message,
      lastTime: serverTimestamp(),
      unreadCount: sender ? 0 : (chatroomSnap.data().unreadCount + 1 || 1),
    });
  }

  // Tambahkan pesan ke subcollection messages
  const messagesRef = collection(db, 'chatrooms', agentId, 'messages');
  await addDoc(messagesRef, {
    sender,
    message,
    type: 'text',
    createdAt: serverTimestamp(),
  });
}
