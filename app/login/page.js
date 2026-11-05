"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Code2, User } from "lucide-react";
import PasswordInput from "../components/PasswordInput";
import FixeaLoader from "../components/FixeaLoader";

const HOME_BY_ROLE = {
  dev: "/",
  client: "/cliente",
};

const ROLE_OPTIONS = [
  {
    value: "dev",
    label: "Desarrollador",
    description: "Dashboard y gestión de tickets",
    icon: Code2,
  },
  {
    value: "client",
    label: "Cliente",
    description: "Vista de validación de cambios",
    icon: User,
  },
];

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-700 bg-[#1F2029] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#00E5FF] focus:outline-none";

const LABEL_CLASS =
  "mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400";

// Solo aceptamos rutas internas: evita redirecciones a otro origen.
// También rechazamos "\" porque el navegador lo normaliza a "/", y "/\evil.com"
// terminaría siendo un redirect externo.
function sanitizeNext(value) {
  if (typeof value !== "string") return "";
  if (!value.startsWith("/") || value.startsWith("//")) return "";
  if (value.includes("\\")) return "";
  return value;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const safeNext = sanitizeNext(searchParams.get("next"));

  const [mode, setMode] = useState(
    searchParams.get("tab") === "crear" ? "register" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("client");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  const switchMode = (nextMode) => {
    if (loading || nextMode === mode) return;
    setMode(nextMode);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";

      // Leemos lo que realmente muestra el formulario: el autocompletado del
      // navegador (contraseñas guardadas) a veces no dispara onChange y el
      // estado de React queda desfasado de lo que el usuario ve.
      const form = new FormData(event.currentTarget);
      const fromForm = (field, fallback) => {
        const value = form.get(field);
        return typeof value === "string" ? value : fallback;
      };
      const formEmail = fromForm("email", email).trim();
      const formPassword = fromForm("password", password);

      const payload = isRegister
        ? {
            email: formEmail,
            password: formPassword,
            name: fromForm("name", name).trim(),
            role,
            inviteCode: fromForm("inviteCode", inviteCode).trim(),
          }
        : { email: formEmail, password: formPassword };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success || !data?.user) {
        setError(data?.error || "No se pudo completar la operación");
        return;
      }

      const destination = safeNext || HOME_BY_ROLE[data.user.role] || "/";
      router.replace(destination);
      router.refresh();
    } catch (fetchError) {
      console.error("Error al autenticar:", fetchError);
      setError("No se pudo conectar con el servidor. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--Negro-fondo-1,#0B0C10)] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-[#00E5FF]/40 bg-[#1F2029] p-6 shadow-[0_0_40px_rgba(0,229,255,0.18)]">
        <div className="mb-6 text-center">
          <Image
            src="/Logo.png"
            alt="FIXEA"
            width={168}
            height={44}
            priority
            className="h-11 w-auto object-contain"
          />
          <p className="mt-1 text-xs text-slate-400">
            Feedback visual para tu equipo
          </p>
          <Link
            href="/inicio"
            className="mt-2 inline-block text-[10px] font-semibold text-[#00E5FF] hover:underline"
          >
            Conocé cómo funciona FIXEA
          </Link>
        </div>

        <div
          role="tablist"
          aria-label="Modo de acceso"
          className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-slate-700 bg-[#1F2029] p-1"
        >
          <button
            type="button"
            role="tab"
            id="tab-login"
            aria-selected={!isRegister}
            aria-controls="auth-form"
            onClick={() => switchMode("login")}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
              !isRegister
                ? "bg-[#00E5FF]/15 text-[#00E5FF]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            role="tab"
            id="tab-register"
            aria-selected={isRegister}
            aria-controls="auth-form"
            onClick={() => switchMode("register")}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
              isRegister
                ? "bg-[#00E5FF]/15 text-[#00E5FF]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form
          id="auth-form"
          aria-labelledby={isRegister ? "tab-register" : "tab-login"}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {isRegister && (
            <div>
              <label htmlFor="name" className={LABEL_CLASS}>
                Nombre
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={INPUT_CLASS}
                placeholder="Tu nombre"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className={LABEL_CLASS}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={INPUT_CLASS}
              placeholder="vos@equipo.com"
            />
          </div>

          <div>
            <label htmlFor="password" className={LABEL_CLASS}>
              Contraseña
            </label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={isRegister ? 8 : undefined}
              maxLength={72}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={INPUT_CLASS}
              placeholder="••••••••"
            />
          </div>

          {/* El rol solo se elige al crear la cuenta. En el login lo define la
              base de datos: permitir elegirlo acá sería un bug de escalada de
              privilegios. */}
          {isRegister && (
            <div>
              <span className={LABEL_CLASS}>Rol</span>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = role === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setRole(option.value)}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        selected
                          ? "border-[#00E5FF]/60 bg-[#00E5FF]/10 text-[#00E5FF]"
                          : "border-slate-700 bg-[#1F2029] text-slate-400 hover:border-slate-500 hover:text-white"
                      }`}
                    >
                      <Icon className="mb-2 h-4 w-4" />
                      <span className="block text-xs font-bold">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-snug">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500">
                El rol se elige únicamente al crear la cuenta.
              </p>
            </div>
          )}

          {isRegister && role === "dev" && (
            <div>
              <label htmlFor="inviteCode" className={LABEL_CLASS}>
                Código de invitación
              </label>
              <PasswordInput
                id="inviteCode"
                name="inviteCode"
                autoComplete="off"
                maxLength={128}
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                className={INPUT_CLASS}
                placeholder="Código para cuentas Dev"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                El alta de desarrolladores requiere el código configurado en el
                servidor.
                {process.env.NODE_ENV !== "production" &&
                  " En desarrollo, el código por defecto es FIXEA2026."}
              </p>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-[#FF003C]/50 bg-[#0B0C10]/40 px-3 py-2 text-xs font-semibold text-[#FF003C]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border border-[#00E5FF]/60 bg-[#1F2029] px-4 py-2 text-xs font-bold text-[#00E5FF] transition-colors hover:border-[#00E5FF] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <FixeaLoader size={14} />
                {isRegister ? "Creando cuenta…" : "Ingresando…"}
              </span>
            ) : isRegister ? (
              "Crear cuenta"
            ) : (
              "Iniciar sesión"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen w-full bg-[var(--Negro-fondo-1,#0B0C10)]"
          aria-hidden="true"
        />
      }
    >
      <LoginForm />
    </Suspense>
  );
}
