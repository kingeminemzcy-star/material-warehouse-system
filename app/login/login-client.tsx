"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { AUTH_NETWORK_ERROR_MESSAGE, createSupabaseBrowserClient, getSupabaseConfigStatus } from "@/lib/supabase";
import { LogoMark } from "@/components/logo-mark";
import { APP_VERSION } from "@/lib/version";

export function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@warehouse.local");
  const [password, setPassword] = useState("Admin@2026-Warehouse");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    setBusy(true);
    setError(null);
    const config = getSupabaseConfigStatus();
    if (!config.ok) {
      setError(config.error);
      setBusy(false);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(AUTH_NETWORK_ERROR_MESSAGE);
      setBusy(false);
      return;
    }
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) {
        setError(loginError.message || AUTH_NETWORK_ERROR_MESSAGE);
        setBusy(false);
        return;
      }
    } catch {
      setError(AUTH_NETWORK_ERROR_MESSAGE);
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#061226] px-4 py-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(38,128,233,0.34),transparent_28%),radial-gradient(circle_at_12%_72%,rgba(24,103,190,0.22),transparent_34%),linear-gradient(135deg,#061226_0%,#08234b_44%,#050b16_100%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(105,178,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(105,178,255,0.14)_1px,transparent_1px)] [background-size:46px_46px]" />
      <div className="absolute left-1/2 top-12 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-500/22 blur-3xl login-pulse" />

      <svg className="pointer-events-none absolute left-[-60px] top-[18vh] hidden h-[58vh] w-[46vw] text-blue-100/22 lg:block" viewBox="0 0 620 620" fill="none" aria-hidden="true">
        <path d="M60 500H560" stroke="currentColor" strokeWidth="2" />
        <path d="M110 430L190 330H315L390 250H520" stroke="currentColor" strokeWidth="2" />
        <path d="M150 430H280L345 360H455" stroke="currentColor" strokeWidth="2" />
        <path d="M120 500V430M280 500V430M455 500V360" stroke="currentColor" strokeWidth="2" />
        <rect x="195" y="300" width="115" height="42" rx="5" stroke="currentColor" strokeWidth="2" />
        <rect x="398" y="226" width="126" height="48" rx="5" stroke="currentColor" strokeWidth="2" />
        <path d="M95 470H210M240 470H360M390 470H520" stroke="currentColor" strokeWidth="2" />
        <circle cx="150" cy="500" r="20" stroke="currentColor" strokeWidth="2" />
        <circle cx="455" cy="500" r="20" stroke="currentColor" strokeWidth="2" />
        <path d="M210 250C250 215 300 215 340 250C380 285 430 285 470 250" stroke="currentColor" strokeWidth="2" />
      </svg>

      <svg className="pointer-events-none absolute right-[-90px] top-[13vh] hidden h-[64vh] w-[44vw] text-sky-200/16 blur-[1px] lg:block" viewBox="0 0 620 680" fill="none" aria-hidden="true">
        <path d="M80 610H555" stroke="currentColor" strokeWidth="2" />
        <path d="M120 570V120H515V570M160 180H475M160 250H475M160 320H475M160 390H475M160 460H475M160 530H475" stroke="currentColor" strokeWidth="2" />
        <path d="M220 120V570M315 120V570M410 120V570" stroke="currentColor" strokeWidth="2" />
        <rect x="170" y="190" width="36" height="32" stroke="currentColor" />
        <rect x="335" y="260" width="48" height="34" stroke="currentColor" />
        <rect x="432" y="400" width="36" height="42" stroke="currentColor" />
        <path d="M90 90H530" stroke="currentColor" strokeWidth="2" />
      </svg>

      <svg className="pointer-events-none absolute bottom-0 left-0 h-[23vh] w-full text-blue-200/20" viewBox="0 0 1200 220" fill="none" aria-hidden="true">
        <path d="M0 140C120 85 220 85 340 140C460 195 560 195 680 140C800 85 900 85 1020 140C1090 172 1145 184 1200 176" stroke="currentColor" strokeWidth="2" />
        <path d="M0 174C120 119 220 119 340 174C460 229 560 229 680 174C800 119 900 119 1020 174C1090 206 1145 218 1200 210" stroke="currentColor" strokeWidth="2" opacity=".55" />
        <path d="M0 105C120 50 220 50 340 105C460 160 560 160 680 105C800 50 900 50 1020 105C1090 137 1145 149 1200 141" stroke="currentColor" strokeWidth="2" opacity=".38" />
      </svg>

      <section className="relative z-10 w-full max-w-[500px]">
        <div className="mb-7 flex justify-center">
          <div className="rounded-2xl border border-white/14 bg-white/94 px-6 py-4 shadow-[0_22px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <LogoMark />
          </div>
        </div>

        <div className="mb-7 text-center">
          <div className="mb-2 text-xs font-black tracking-[0.38em] text-sky-200/78">INTELLIGENT SURFACE SYSTEM</div>
          <h1 className="text-3xl font-black tracking-normal text-white drop-shadow-[0_8px_26px_rgba(36,129,230,0.25)] sm:text-5xl">擎天中瑞数字化供应链平台</h1>
          <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-blue-100/82 sm:text-sm">BOM｜采购｜审批｜执行｜验收｜仓储｜库存｜追溯</p>
        </div>

        <div className="rounded-3xl border border-white/20 bg-white/88 p-5 text-ink shadow-[0_28px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <ShieldCheck size={23} />
            </div>
            <div>
              <h2 className="text-xl font-black text-ink">安全登录</h2>
              <p className="text-xs font-semibold text-ink/52">内部试用版账号认证</p>
            </div>
          </div>

          <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-ink/78">手机号或邮箱</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-700/70" size={18} />
              <input className="field border-blue-100/80 bg-white/90 pl-10 shadow-inner shadow-blue-950/5 focus:border-blue-500 focus:ring-blue-500/20" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-ink/78">密码</span>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-700/70" size={18} />
              <input className="field border-blue-100/80 bg-white/90 pl-10 shadow-inner shadow-blue-950/5 focus:border-blue-500 focus:ring-blue-500/20" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
          </label>
          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</div> : null}
          <button
            className="relative mt-1 inline-flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-[#0b5eb1] via-[#1688e8] to-[#0b5eb1] px-4 py-3 text-base font-black text-white shadow-[0_16px_34px_rgba(18,103,179,0.34)] transition hover:brightness-110 disabled:opacity-65 login-button-glow"
            onClick={() => void login()}
            disabled={busy}
          >
            {busy ? <Loader2 className="animate-spin" size={18} /> : null}
            进入系统
          </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm font-semibold tracking-[0.2em] text-blue-100/70">智造未来 · 数据驱动 · 高效协同</p>
          <p className="mt-3 text-xs font-semibold text-blue-100/52">{APP_VERSION}</p>
        </div>
      </section>

      <style jsx>{`
        .login-pulse {
          animation: loginPulse 4.8s ease-in-out infinite;
        }
        .login-button-glow::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28), transparent);
          transform: translateX(-120%);
          animation: sweep 3.8s ease-in-out infinite;
        }
        @keyframes loginPulse {
          0%, 100% {
            opacity: 0.45;
            transform: translateX(-50%) scale(0.92);
          }
          50% {
            opacity: 0.85;
            transform: translateX(-50%) scale(1.08);
          }
        }
        @keyframes sweep {
          0%, 45% {
            transform: translateX(-120%);
          }
          72%, 100% {
            transform: translateX(120%);
          }
        }
      `}</style>
    </main>
  );
}
