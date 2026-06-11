"use client";

import { useState } from "react";
import { Camera, UploadCloud } from "lucide-react";
import { AUTH_NETWORK_ERROR_MESSAGE, createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export function PhotoUploader({ label = "上传照片" }: { label?: string }) {
  const [message, setMessage] = useState("支持材料、入库、出库照片");
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "warehouse-photos";
    const supabase = createSupabaseBrowserClient();

    if (!isSupabaseConfigured() || !supabase) {
      setMessage(`本地预览：已选择 ${file.name}`);
      setBusy(false);
      return;
    }

    const path = `photos/${Date.now()}-${file.name}`;
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false
      });
      setMessage(error ? `上传失败：${error.message}` : `已上传：${path}`);
    } catch {
      setMessage(`上传失败：${AUTH_NETWORK_ERROR_MESSAGE}`);
    }
    setBusy(false);
  }

  return (
    <div className="rounded-md border border-dashed border-line bg-field p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white text-action">
            <Camera size={22} />
          </div>
          <div>
            <div className="text-sm font-black text-ink">{label}</div>
            <div className="text-xs text-ink/58">{message}</div>
          </div>
        </div>
        <label className="btn-secondary cursor-pointer">
          <UploadCloud size={18} />
          {busy ? "上传中" : "选择照片"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
      </div>
    </div>
  );
}
