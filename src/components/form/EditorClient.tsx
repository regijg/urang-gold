"use client";

import { Editor } from "@tinymce/tinymce-react";
import type React from "react";

type EditorClientProps = React.ComponentProps<typeof Editor>;

export default function EditorClient(props: EditorClientProps) {
  return <Editor {...props} />;
}
