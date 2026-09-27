"use client";

import { TrashIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useState, ChangeEvent } from "react";

type ImagePreview = {
  id: number;
  url: string;
  file?: File;
};

interface MultiImageUploadProps {
  onChange?: (files: File[]) => void;
  uploadingImages?: Record<string, number>; // Progress: 0–100
  images?: (File | string)[];
}

export default function MultiImageUpload({
  onChange,
  uploadingImages = {},
  images = [], // default []
}: MultiImageUploadProps) {
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);

  useEffect(() => {
    const newPreviews = images.map((img, index) => {
      if (typeof img === "string") {
        return { id: index, url: img }; // URL dari backend
      } else {
        return { id: Date.now() + index, url: URL.createObjectURL(img), file: img };
      }
    });

    setImagePreviews(newPreviews);
  }, [images]);

  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const filesArray = Array.from(e.target.files);

    const newImages = filesArray.map((file, index) => ({
      id: Date.now() + index,
      url: URL.createObjectURL(file),
      file,
    }));

    const updatedImages = [...imagePreviews, ...newImages];
    setImagePreviews(updatedImages);

    onChange?.(newImages.map((img) => img.file!));
  };

  const removeImage = (id: number) => {
    const updated = imagePreviews.filter((img) => img.id !== id);
    setImagePreviews(updated);

    onChange?.(updated.filter(img => img.file).map(img => img.file!));
  };

  return (
    <div>
      <label className="block mb-2 text-gray-700 dark:text-gray-400 font-semibold">Upload Gambar</label>
      <div className="flex flex-wrap gap-4">
        {imagePreviews.map((img) => {
          const progress = img.file ? uploadingImages[img.file.name] : undefined;
          const isUploading = typeof progress === "number";

          return (
            <div
              key={img.id}
              className="relative w-32 h-32 border rounded-md overflow-hidden"
            >
              <img
                src={img.url}
                alt="preview"
                className={`object-cover w-full h-full ${isUploading ? "opacity-50" : ""}`}
              />

              {isUploading && (
                <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center">
                  <div className="w-20">
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-700 text-center">{progress}%</p>
                  </div>
                </div>
              )}

              {!isUploading && (
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          );
        })}

        <label
          htmlFor="image-upload"
          className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-gray-400 rounded-md cursor-pointer hover:border-gray-600"
          title="Upload gambar"
        >
          <span className="text-4xl text-gray-400 select-none">+</span>
        </label>
      </div>

      <input
        id="image-upload"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFilesChange}
      />
    </div>
  );
}
