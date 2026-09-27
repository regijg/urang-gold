"use client";

import Image from "next/image";
import {
  PhoneIcon,
  VideoCameraIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import React, { useState, useEffect, useRef } from "react";
import { post } from "@/lib/api";

type Sender = "agent" | "customer";

type Customers = {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
  lastSeen: string;
  status: "online" | "offline" | "away";
};

type Message = {
  id: string;
  sender: Sender;
  message: string;
  type: "text";
  createdAt?: any;
  timestamp?: any;
  senderId: string;
  imageUrl?: string;
};

type Chatroom = {
  id: string;
  customer_name?: string;
  room_id?: string;
  agentId?: number;
  lastMessage?: string;
  messages?: Message[];
};

export default function ChatPage() {
  const [customers, setCustomers] = useState<Customers[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Customers | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [chatrooms, setChatrooms] = useState<Chatroom[]>([]);
  const [userInfo, setUserInfo] = useState<{ id: string; parent_agent_id: string } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [buttonPosition, setButtonPosition] = useState({ x: 16, y: 80 });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const userStorage = localStorage.getItem("userData");
    const userAgent = userStorage ? JSON.parse(userStorage) : null;

    if (userAgent && userAgent.parent_agent_id) {
      setUserInfo({ id: userAgent.id, parent_agent_id: String(userAgent.parent_agent_id) });
    }
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted || !userInfo?.parent_agent_id) return;

    const fetchChatrooms = async () => {
      const chatroomsCol = collection(db, "agent", userInfo.parent_agent_id, "chatrooms");
      const chatroomDocs = await getDocs(chatroomsCol);

      const chatroomsData = chatroomDocs.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const rooms: Chatroom[] = [];

      for (const room of chatroomsData) {
        const messagesCol = collection(
          db,
          "agent",
          userInfo.parent_agent_id,
          "chatrooms",
          room.id,
          "chatrooms"
        );

        const messagesSnap = await getDocs(messagesCol);
        const messages = messagesSnap.docs.map((doc) => doc.data());
        const firstMessage = messages.length > 0 ? messages[0] : null;

        rooms.push({
          ...room,
          customer_name: firstMessage?.customer_name ?? "Unknown",
          room_id: firstMessage?.room_id ?? room.id,
        });
      }

      setChatrooms(rooms);
    };

    fetchChatrooms();
  }, [userInfo, isMounted]);

  useEffect(() => {
    const agent = customers.find((a) => a.id === selectedAgentId);
    setSelectedAgent(agent || null);
  }, [selectedAgentId, customers]);

  useEffect(() => {
    if (!isMounted || !selectedAgentId) return;

    const messagesRef = collection(db, "chatrooms", selectedAgentId, "messages");
    const q = query(messagesRef, orderBy("timestamp"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          sender: data.sender,
          message: data.message,
          type: data.type,
          createdAt: data.createdAt,
          timestamp: data.timestamp,
          senderId: data.senderId,
        } as Message;
      });
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });

    return () => unsubscribe();
  }, [selectedAgentId, isMounted]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedAgentId || !userInfo?.parent_agent_id) return;

    const payload = {
      roomId: selectedAgentId,
      message: messageInput,
      type: "text",
    };

    try {
      await post(`chat`, payload);
    } catch (err) {
      console.error(err);
    }
    setMessageInput("");
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();

    // mencegah scroll ikut gerak
    e.stopPropagation();

    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const moveHandler = (moveEvent: MouseEvent | TouchEvent) => {
      // block scroll di chat content
      moveEvent.preventDefault();
      moveEvent.stopPropagation();

      const moveX =
        'touches' in moveEvent
          ? moveEvent.touches[0].clientX
          : (moveEvent as MouseEvent).clientX;
      const moveY =
        'touches' in moveEvent
          ? moveEvent.touches[0].clientY
          : (moveEvent as MouseEvent).clientY;

      setButtonPosition({
        x: moveX - 24,
        y: moveY - 24,
      });
    };

    const upHandler = () => {
      document.removeEventListener("mousemove", moveHandler);
      document.removeEventListener("mouseup", upHandler);
      document.removeEventListener("touchmove", moveHandler);
      document.removeEventListener("touchend", upHandler);
    };

    document.addEventListener("mousemove", moveHandler, { passive: false });
    document.addEventListener("mouseup", upHandler);
    document.addEventListener("touchmove", moveHandler, { passive: false });
    document.addEventListener("touchend", upHandler);
  };


  if (!isMounted) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 relative">
      {/* SIDEBAR */}
      <div
        className={`fixed inset-y-0 left-0 z-30 bg-white w-64 transform ${
          showSidebar ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 ease-in-out md:static md:translate-x-0 md:w-1/3 max-w-xs border-r border-gray-200 flex flex-col`}
      >
        <div className="p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Chats</h2>
          <button
            className="p-2 rounded-full hover:bg-gray-100 md:hidden"
            onClick={() => setShowSidebar(false)}
          >
            <XMarkIcon className="h-6 w-6 text-gray-500" />
          </button>
        </div>
        <div className="px-4">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {/* ArrowLeft Button */}
        <div className="px-4 mt-2 md:hidden">
          <button
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg py-2 transition-all"
            onClick={() => setShowSidebar(false)}
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            <span className="font-medium">Tutup Daftar Chat</span>
          </button>
        </div>
        <ul className="overflow-y-auto flex-1 mt-4">
          {chatrooms.map((room) => (
            <li
              key={room.room_id}
              className={`flex items-center px-4 py-3 cursor-pointer hover:bg-gray-100 ${
                selectedAgentId === room.room_id ? "bg-gray-100" : ""
              }`}
              onClick={() => {
                setSelectedAgentId(room.room_id ?? null);
                setShowSidebar(false);
              }}
            >
              <div className="relative flex-shrink-0 w-10 h-10 bg-blue-500 text-white flex items-center justify-center font-semibold text-lg rounded-md select-none">
                {room.customer_name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">{room.customer_name}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* CHAT CONTENT */}
      <div className="flex-1 flex flex-col h-screen relative">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 bg-white">
          <div className="flex items-center">
            {selectedAgent && (
              <>
                <div className="relative flex-shrink-0 w-10 h-10 bg-blue-500 text-white flex items-center justify-center font-semibold text-lg rounded-md select-none">
                  {selectedAgent.name.charAt(0).toUpperCase()}
                </div>
                <div className="ml-4">
                  <p className="text-lg font-semibold text-gray-900">{selectedAgent.name}</p>
                  <p className="text-xs text-gray-500">{selectedAgent.role}</p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-full hover:bg-gray-100">
              <PhoneIcon className="h-5 w-5 text-gray-600" />
            </button>
            <button className="p-2 rounded-full hover:bg-gray-100">
              <VideoCameraIcon className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {selectedAgentId ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 bg-gray-50">
              {messages.map((msg, index) => {
                const currentDate = msg.timestamp?.toDate ? msg.timestamp.toDate() : null;
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const prevDate = prevMsg?.timestamp?.toDate ? prevMsg.timestamp.toDate() : null;
                const isNewDay =
                  !prevDate ||
                  (currentDate && currentDate.toDateString() !== prevDate.toDateString());

                let dateLabel = "";
                if (isNewDay && currentDate) {
                  const today = new Date();
                  const yesterday = new Date();
                  yesterday.setDate(today.getDate() - 1);

                  if (currentDate.toDateString() === today.toDateString()) {
                    dateLabel = "Today";
                  } else if (currentDate.toDateString() === yesterday.toDateString()) {
                    dateLabel = "Yesterday";
                  } else {
                    dateLabel = currentDate.toLocaleDateString();
                  }
                }

                return (
                  <React.Fragment key={msg.id}>
                    {isNewDay && dateLabel && (
                      <div className="flex justify-center my-4">
                        <span className="bg-gray-300 text-gray-700 text-xs px-3 py-1 rounded-full shadow">
                          {dateLabel}
                        </span>
                      </div>
                    )}
                    <div
                      className={`flex ${
                        msg.senderId === userInfo?.id ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] flex flex-col ${
                          msg.senderId === userInfo?.id ? "items-end" : "items-start"
                        }`}
                      >
                        {msg.type === "text" ? (
                          <div
                            className={`px-4 py-2 rounded-xl ${
                              msg.senderId === userInfo?.id
                                ? "bg-blue-500 text-white"
                                : "bg-white text-gray-800 shadow-sm"
                            }`}
                          >
                            {msg.message}
                          </div>
                        ) : (
                          <Image
                            src={msg.imageUrl!}
                            alt="Sent Image"
                            width={200}
                            height={120}
                            className="rounded-lg object-cover"
                          />
                        )}
                        <span className="mt-1 text-xs text-gray-400">
                          {msg.timestamp?.toDate
                            ? msg.timestamp.toDate().toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="border-t border-gray-200 px-4 py-4 bg-white flex items-center space-x-2 sticky bottom-0">
              <input
                type="text"
                placeholder="Type a message"
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                }}
              />
              <button
                onClick={handleSendMessage}
                className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white"
              >
                <PaperAirplaneIcon className="h-5 w-5 transform rotate-90" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p>Pilih agent untuk memulai percakapan</p>
          </div>
        )}
      </div>

      {/* draggable button */}
      {!showSidebar && (
        <button
          className="fixed z-50 p-4 rounded-full bg-blue-600 text-white shadow-lg md:hidden"
          style={{ left: buttonPosition.x, top: buttonPosition.y }}
          onClick={() => setShowSidebar(true)}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
