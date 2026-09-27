"use client";

import { TrashIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useState, ChangeEvent } from "react";

interface SingleImageUploadProps {
  image?: File | string;
  onChange?: (file: File | null) => void;
  uploadingProgress?: number | null;
}

export default function SingleImageUpload({
  onChange,
  uploadingProgress,
  image,
}: SingleImageUploadProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fileRef, setFileRef] = useState<File | null>(null);

  useEffect(() => {
    if (typeof image === "string") {
      setImagePreview(image);
      setFileRef(null);
    } else if (image instanceof File) {
      const objectUrl = URL.createObjectURL(image);
      setImagePreview(objectUrl);
      setFileRef(image);
      return () => URL.revokeObjectURL(objectUrl); // Clean up
    } else {
      setImagePreview(null);
      setFileRef(null);
    }
  }, [image]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);

    setImagePreview(url);
    setFileRef(file);
    onChange?.(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setFileRef(null);
    onChange?.(null);
  };

  return (
    <div>
      <label className="block mb-2 text-gray-700 dark:text-gray-400 font-semibold">Upload Gambar</label>

      {imagePreview ? (
        <div className="relative w-32 h-32 border rounded-md overflow-hidden">
          <img
            src={imagePreview}
            alt="preview"
            className={`object-cover w-full h-full ${uploadingProgress !== undefined ? "opacity-50" : ""}`}
          />

          {uploadingProgress !== undefined && (
            <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center">
              <div className="w-20">
                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadingProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-700 text-center">{uploadingProgress}%</p>
              </div>
            </div>
          )}

          {uploadingProgress === undefined && (
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      ) : (
        <label
          htmlFor="single-image-upload"
          className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-gray-400 rounded-md cursor-pointer hover:border-gray-600"
          title="Upload gambar"
        >
          <span className="text-4xl text-gray-400 select-none">+</span>
        </label>
      )}

      <input
        id="single-image-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
