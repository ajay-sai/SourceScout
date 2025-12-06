import { useState, useCallback } from "react";
import { Upload, Link, FileText, Image, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InputTypeValue } from "@shared/schema";

interface DropZoneProps {
  onFileSelect: (file: File, type: InputTypeValue) => void;
  onUrlSubmit: (url: string) => void;
  isLoading?: boolean;
}

export function DropZone({ onFileSelect, onUrlSubmit, isLoading = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [inputMode, setInputMode] = useState<"drop" | "url">("drop");

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        const type = getInputType(file);
        onFileSelect(file, type);
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const type = getInputType(file);
        onFileSelect(file, type);
      }
    },
    [onFileSelect]
  );

  const handleUrlSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (urlInput.trim()) {
        onUrlSubmit(urlInput.trim());
      }
    },
    [urlInput, onUrlSubmit]
  );

  const getInputType = (file: File): InputTypeValue => {
    if (file.type.startsWith("image/")) return "image";
    return "document";
  };

  if (isLoading) {
    return (
      <Card className="flex flex-col items-center justify-center min-h-[320px] p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">Analyzing your product...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Extracting specifications and features
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-4">
        <Button
          variant={inputMode === "drop" ? "default" : "outline"}
          onClick={() => setInputMode("drop")}
          className="gap-2"
          data-testid="button-mode-upload"
        >
          <Upload className="h-4 w-4" />
          Upload File
        </Button>
        <Button
          variant={inputMode === "url" ? "default" : "outline"}
          onClick={() => setInputMode("url")}
          className="gap-2"
          data-testid="button-mode-url"
        >
          <Link className="h-4 w-4" />
          Paste URL
        </Button>
      </div>

      {inputMode === "drop" ? (
        <Card
          className={cn(
            "relative flex flex-col items-center justify-center min-h-[320px] border-2 border-dashed transition-all duration-200 cursor-pointer",
            isDragging && "border-primary bg-primary/5 scale-[1.02]",
            !isDragging && "hover:border-primary/50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input")?.click()}
          data-testid="dropzone-area"
        >
          <input
            id="file-input"
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileInput}
            data-testid="input-file"
          />
          
          <div className="flex flex-col items-center gap-4 p-8">
            <div
              className={cn(
                "h-20 w-20 rounded-full bg-muted flex items-center justify-center transition-transform duration-200",
                isDragging && "scale-110"
              )}
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
            </div>
            
            <div className="text-center">
              <p className="text-xl font-semibold">
                {isDragging ? "Drop it here!" : "What are we sourcing today?"}
              </p>
              <p className="text-muted-foreground mt-2">
                Drag and drop an image, PDF, or spec sheet
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse files
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <Badge variant="secondary" className="gap-1">
                <Image className="h-3 w-3" />
                Images
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <FileText className="h-3 w-3" />
                PDF
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <FileText className="h-3 w-3" />
                Documents
              </Badge>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-8">
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div className="text-center mb-6">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Link className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-xl font-semibold">Paste a product URL</p>
              <p className="text-muted-foreground mt-2">
                Amazon, Alibaba, supplier pages, or any product listing
              </p>
            </div>
            
            <div className="flex gap-3 max-w-2xl mx-auto">
              <Input
                type="url"
                placeholder="https://www.example.com/product..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="flex-1"
                data-testid="input-url"
              />
              <Button type="submit" disabled={!urlInput.trim()} data-testid="button-analyze-url">
                Analyze
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
