import React, { useState, useEffect, useRef } from "react";
import { useTicketStore } from "../../store/ticketStore";
import { formatDistance } from "date-fns";
import { Send, Image as ImageIcon, X } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';

const TicketChat: React.FC = () => {
  const { selectedTicket, messages, fetchMessages, sendMessage, uploadImage } = useTicketStore();
  const { user } = useAuthStore();
  const [newMessage, setNewMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    maxSize: 5242880, // 5MB
    multiple: false,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  });

  useEffect(() => {
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
    }
  }, [selectedTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || (!newMessage.trim() && !selectedFile)) return;

    try {
      if (selectedFile) {
        setIsUploading(true);
        const imagePath = `ticket-images/${uuidv4()}-${selectedFile.name}`;
        const imageUrl = await uploadImage(selectedFile, imagePath);
        await sendMessage(selectedTicket.id, newMessage, false, imageUrl);
        setPreviewImage(null);
        setSelectedFile(null);
      } else {
        await sendMessage(selectedTicket.id, newMessage);
      }
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const cancelImage = () => {
    setPreviewImage(null);
    setSelectedFile(null);
  };

  if (!selectedTicket) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-400">
        Select a ticket to view the conversation
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isCurrentUser = message.sender_id === user?.id;

          return (
            <div
              key={message.id}
              className={`flex ${
                isCurrentUser ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  isCurrentUser
                    ? "bg-primary text-white"
                    : "bg-neutral-700 text-neutral-100"
                }`}
              >
                {message.image_url && (
                  <img 
                    src={message.image_url} 
                    alt="Attached" 
                    className="max-w-full rounded-lg mb-2 cursor-pointer"
                    onClick={() => window.open(message.image_url, '_blank')}
                  />
                )}
                <p className="text-sm">{message.message}</p>
                <p className="text-xs mt-1 opacity-75">
                  {formatDistance(new Date(message.created_at), new Date(), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-neutral-800">
        {previewImage && (
          <div className="relative mb-2">
            <img 
              src={previewImage} 
              alt="Preview" 
              className="w-20 h-20 object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={cancelImage}
              className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"
            >
              <X size={12} className="text-white" />
            </button>
          </div>
        )}
        <div className="flex space-x-2">
          <div {...getRootProps()} className="cursor-pointer">
            <input {...getInputProps()} />
            <button
              type="button"
              className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
            >
              <ImageIcon size={20} />
            </button>
          </div>
          <input
            type="text"
            className="input flex-1"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
            disabled={isUploading || (!newMessage.trim() && !selectedFile)}
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default TicketChat;