"use client";

import { useCallback, useState } from "react";
import { Upload, X } from "lucide-react";
import { useDropzone } from "react-dropzone";
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
        className={`relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed px-6 py-12 cursor-pointer transition-colors duration-150 select-none
        ${disabled ? "opacity-50 pointer-events-none" : ""}
        ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-hairline-strong bg-surface-2 hover:border-primary/60 hover:bg-primary/[.03]"
        }
      `}
      >
        <input {...getInputProps()} />

        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors ${
            isDragActive ? "bg-primary/10" : "bg-card border border-hairline"
          }`}
        >
          <Upload
            className={`h-6 w-6 ${isDragActive ? "text-primary" : "text-ink-3"}`}
            strokeWidth={1.8}
          />
        </div>

        {isDragActive ? (
          <div className="text-center">
            <p className="text-sm font-semibold text-primary">
              Drop your files here
            </p>
            <p className="text-xs text-primary/70 mt-1">Release to add files</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm font-semibold text-ink">
              Drag &amp; drop files here, or{" "}
              <span className="text-primary underline underline-offset-2">
                browse
              </span>
            </p>
            <p className="text-xs text-ink-3 mt-2">
              Accepted formats: .csv, .xlsx, .xml
            </p>
            <p className="text-xs text-ink-3 mt-0.5">
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
              className="flex items-center gap-3 rounded-xl border border-hairline bg-card px-4 py-2.5"
            >
              <p className="text-sm text-ink truncate flex-1 min-w-0">
                {file.name}
              </p>
              <Badge variant="secondary">
                {getFileExtension(file.name)}
              </Badge>
              <span className="text-xs text-ink-3 shrink-0 mono-data">
                {formatBytes(file.size)}
              </span>
              {!disabled && onFileRemoved && (
                <button
                  type="button"
                  onClick={() => onFileRemoved(index)}
                  className="ml-1 w-6 h-6 rounded-md flex items-center justify-center text-ink-3 hover:text-neg hover:bg-neg/10 transition-colors shrink-0"
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
