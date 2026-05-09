import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: true,
    message: "照片上传请使用前端 Supabase Storage 客户端。此接口预留给服务端校验、审计和签名上传。"
  });
}
