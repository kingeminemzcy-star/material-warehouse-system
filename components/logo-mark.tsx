"use client";

import { useState } from "react";
import Image from "next/image";

export function LogoMark({ compact = false }: { compact?: boolean }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className={compact ? "text-lg font-black text-ink" : "text-2xl font-black text-ink"}>工程材料仓储</div>;
  }

  return (
    <Image
      src="/logo.png"
      alt="公司 LOGO"
      width={560}
      height={90}
      className={compact ? "max-h-12 w-auto max-w-[200px] object-contain" : "max-h-16 w-auto max-w-[280px] object-contain"}
      onError={() => setFailed(true)}
    />
  );
}
