"use client";

import React, { useRef } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Label from "@/components/form/Label";
import dynamic from "next/dynamic";

// Import the TinyMCE editor‐instance type:
import type { Editor as TinyMCEEditor } from "tinymce";

const Editor = dynamic(
  () => import("@tinymce/tinymce-react").then((mod) => mod.Editor),
  { ssr: false }
);

export default function KebijakanPrivasiPage() {
  // Give the ref the correct type instead of `any`:
  const editorRef = useRef<TinyMCEEditor | null>(null);

  return (
    <div>
      <PageBreadcrumb pageTitle={`Form Kebijakan Privasi`} />

      <form className="bg-white rounded-xl shadow p-6 space-y-6 max-w-6xl mx-auto mt-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="xl:col-span-2">
            <Label htmlFor="itinerary">Kebijakan Privasi</Label>
            <Editor
              apiKey="u7yl9v9ojrcs5awk99d2o42hgnrcy6v0ln805blsr0elk1kc"
              onInit={(_evt, editor) => {
                // Now `editor` is correctly typed as `tinymce.Editor`
                editorRef.current = editor;
              }}
              initialValue=""
              init={{
                height: 500,
                menubar: false,
                plugins: [
                  "advlist",
                  "autolink",
                  "lists",
                  "link",
                  "image",
                  "charmap",
                  "preview",
                  "anchor",
                  "searchreplace",
                  "visualblocks",
                  "code",
                  "fullscreen",
                  "insertdatetime",
                  "media",
                  "table",
                  "code",
                  "help",
                  "wordcount",
                ],
                toolbar:
                  "undo redo | blocks | bold italic forecolor | alignleft aligncenter " +
                  "alignright alignjustify | bullist numlist outdent indent | removeformat | help",
                content_style:
                  "body { font-family:Helvetica,Arial,sans-serif; font-size:14px }",
              }}
            />
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            className="px-4 py-2 bg-brand-600 text-white font-semibold rounded-md hover:bg-brand-700 transition"
          >
            Simpan Data
          </button>
        </div>
      </form>
    </div>
  );
}
