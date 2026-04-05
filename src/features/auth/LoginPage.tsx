import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate } from "react-router-dom";

import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./auth-context";

interface LoginFormValues {
  email: string;
}

export function LoginPage() {
  const { user } = useAuth();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
    },
  });

  if (user) {
    return <Navigate to="/today" replace />;
  }

  async function onSubmit(values: LoginFormValues) {
    setStatusMessage(null);
    setErrorMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        emailRedirectTo: `${window.location.origin}/today`,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setStatusMessage("Magic link sent. Check your email to finish signing in.");
  }

  return (
    <main className="page-shell justify-center gap-6">
      <header className="space-y-2">
        <p className="section-label">Workout Tracker</p>
        <h1 className="page-title">Sign in</h1>
        <p className="text-base leading-6 text-muted">
          This app is private to one invited user. Enter the approved email address to
          receive a magic link.
        </p>
      </header>

      {!env.isSupabaseConfigured && (
        <section className="card space-y-2 p-5 text-sm leading-6">
          <p className="font-semibold text-ink">Supabase is not configured yet.</p>
          <p className="text-muted">
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to
            your environment before using auth.
          </p>
        </section>
      )}

      <form className="card space-y-4 p-5" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <label className="section-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            placeholder="you@example.com"
            {...register("email", {
              required: "Email is required",
              pattern: {
                value: /\S+@\S+\.\S+/,
                message: "Enter a valid email address",
              },
            })}
          />
          {errors.email && <p className="text-sm text-accent">{errors.email.message}</p>}
        </div>

        {statusMessage && <p className="text-sm text-success">{statusMessage}</p>}
        {errorMessage && <p className="text-sm text-accent">{errorMessage}</p>}

        <button className="primary-button w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Sending..." : "Send Magic Link"}
        </button>
      </form>
    </main>
  );
}
