"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

interface FileDropzoneProps {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
  files?: File[];
  onFileRemoved?: (index: number) => void;
}

export function FileDropzone({
  onFilesAdded,
  disabled,
  files,
  onFileRemoved,
}: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFilesAdded(acceptedFiles);
      }
      setIsDragActive(false);
    },
    [onFilesAdded]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "text/xml": [".xml"],
      "application/xml": [".xml"],
    },
    disabled,
    multiple: true,
  });

  const getFileExtension = (filename: string): string => {
    const dotIndex = filename.lastIndexOf(".");
    return dotIndex >= 0 ? filename.slice(dotIndex) : "";
  };

  return (
    <div>
      <div
        {...getRootProps()}
        className={`relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed px-6 py-12 cursor-pointer transition-all duration-150 select-none
        ${disabled ? "opacity-50 pointer-events-none" : ""}
        ${
          isDragActive
            ? "border-indigo-500 bg-indigo-50/70"
            : "border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/40"
        }
      `}
      >
        <input {...getInputProps()} />

        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors ${
            isDragActive ? "bg-indigo-100" : "bg-white border border-gray-200"
          }`}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isDragActive ? "text-indigo-600" : "text-gray-400"}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        {isDragActive ? (
          <div className="text-center">
            <p className="text-sm font-semibold text-indigo-700">
              Drop your files here
            </p>
            <p className="text-xs text-indigo-500 mt-1">Release to add files</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">
              Drag &amp; drop files here, or{" "}
              <span className="text-indigo-600 underline underline-offset-2">
                browse
              </span>
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Accepted formats: .csv, .xlsx, .xml
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Tradebook, Funds Statement, Holdings, Contract Notes
            </p>
          </div>
        )}
      </div>

      {files && files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5"
            >
              <p className="text-sm text-gray-900 truncate flex-1 min-w-0">
                {file.name}
              </p>
              <Badge variant="secondary">
                {getFileExtension(file.name)}
              </Badge>
              <span className="text-xs text-gray-500 shrink-0">
                {formatBytes(file.size)}
              </span>
              {!disabled && onFileRemoved && (
                <button
                  type="button"
                  onClick={() => onFileRemoved(index)}
                  className="ml-1 w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
