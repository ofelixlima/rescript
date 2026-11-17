"use client";

import { useEffect, useId, useState } from "react";
import {
  Bug,
  ExternalLink,
  HomeIcon,
  Moon,
  RefreshCw,
  Settings,
  Sun,
} from "lucide-react";
import {
  DiscordIcon,
  DISCORD_INVITE_URL,
  GitHubIcon,
  GITHUB_REPO_URL,
  WEBSITE_URL,
  XIcon,
  X_PROFILE_URL,
} from "./SocialLinks";
import { useAppearance } from "@/hooks/useAppearance";
import { useTelemetryPref } from "@/hooks/useTelemetryPref";
import Popover, { PopoverContent, PopoverTrigger } from "./Popover";
import type { Appearance } from "@/lib/theme";
import { useI18n } from "./I18nProvider";
import {
  UI_LOCALES,
  UI_LOCALE_META,
  isUiLocalePreference,
} from "@/lib/i18n";
import {
  loadFreeLlmApiConfig,
  saveFreeLlmApiConfig,
  type FreeLlmApiConfig,
} from "@/lib/freellmapi";

const MENU_LINKS = [
  { labelKey: "settings.support", href: DISCORD_INVITE_URL, Icon: DiscordIcon },
  {
    labelKey: "settings.reportIssue",
    href: `${GITHUB_REPO_URL}/issues`,
    Icon: Bug,
  },
  { labelKey: "settings.homepage", href: WEBSITE_URL, Icon: HomeIcon },
  { labelKey: "settings.github", href: GITHUB_REPO_URL, Icon: GitHubIcon },
  { labelKey: "settings.followX", href: X_PROFILE_URL, Icon: XIcon },
] as const;

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { appearance, setAppearance } = useAppearance();
  const { enabled: telemetry, setEnabled: setTelemetry } = useTelemetryPref();
  const { t, preference, setPreference } = useI18n();
  const [hubConfig, setHubConfig] = useState<FreeLlmApiConfig>(() =>
    loadFreeLlmApiConfig()
  );
  const [testState, setTestState] = useState<{
    status: "idle" | "loading" | "ok" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  useEffect(() => {
    if (open) {
      setHubConfig(loadFreeLlmApiConfig());
      setTestState({ status: "idle", message: "" });
    }
  }, [open]);

  function updateHub(patch: Partial<FreeLlmApiConfig>) {
    const next = { ...hubConfig, ...patch };
    setHubConfig(next);
    saveFreeLlmApiConfig(next);
    if (testState.status !== "idle") {
      setTestState({ status: "idle", message: "" });
    }
  }

  async function testHubConnection() {
    if (!hubConfig.apiKey.trim()) {
      setTestState({ status: "error", message: "Cole a API Key primeiro." });
      return;
    }
    setTestState({ status: "loading", message: "Testando..." });
    try {
      const targetUrl = `${hubConfig.baseUrl.replace(/\/+$/, "")}/models`;
      const res = await fetch("/api/freellmapi", {
        headers: {
          Authorization: `Bearer ${hubConfig.apiKey.trim()}`,
          "x-target-url": targetUrl,
        },
      });
      if (!res.ok) {
        setTestState({
          status: "error",
          message: `Erro ${res.status}: chave inválida ou rota bloqueada`,
        });
        return;
      }
      const data = (await res.json()) as { data?: unknown[] };
      const count = Array.isArray(data.data) ? data.data.length : 0;
      setTestState({
        status: "ok",
        message: `Conectado (${count} modelos ativos)`,
      });
    } catch {
      setTestState({
        status: "error",
        message: "Servidor offline (verifique 127.0.0.1:31415)",
      });
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      backdrop
    >
      <div className="relative z-30 shrink-0">
        <PopoverTrigger>
          <button
            type="button"
            aria-label={t("common.settings")}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={panelId}
            title={t("common.settings")}
            onClick={() => setOpen((v) => !v)}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Settings size={16} />
          </button>
        </PopoverTrigger>

        <PopoverContent
          id={panelId}
          role="dialog"
          aria-label={t("common.settings")}
          className="z-40 w-[17.5rem] overflow-hidden"
        >
          <section className="border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
            <p className="mb-2 text-[11px] font-medium tracking-wide text-zinc-400 dark:text-zinc-500">
              {t("settings.appearance")}
            </p>
            <div
              className="grid grid-cols-2 gap-0.5 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800"
              role="radiogroup"
              aria-label={t("settings.appearance")}
            >
              <AppearanceOption
                value="light"
                label={t("settings.light")}
                icon={Sun}
                selected={appearance === "light"}
                onSelect={setAppearance}
              />
              <AppearanceOption
                value="dark"
                label={t("settings.dark")}
                icon={Moon}
                selected={appearance === "dark"}
                onSelect={setAppearance}
              />
            </div>
          </section>

          <section className="border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
            <label className="block text-[11px] font-medium tracking-wide text-zinc-400 dark:text-zinc-500">
              {t("settings.interfaceLanguage")}
              <select
                value={preference}
                onChange={(event) => {
                  const next = event.target.value;
                  if (isUiLocalePreference(next)) setPreference(next);
                }}
                className="mt-2 block h-8 w-full rounded-lg border border-zinc-200 bg-white px-2 text-[12px] text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <option value="system">{t("common.system")}</option>
                {UI_LOCALES.map((locale) => (
                  <option key={locale} value={locale}>
                    {UI_LOCALE_META[locale].nativeLabel}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section
            onPointerDown={(e) => e.stopPropagation()}
            className="border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800"
          >
            <p className="mb-2 text-[11px] font-medium tracking-wide text-zinc-400 dark:text-zinc-500">
              FreeLLMAPI (Hub de IA)
            </p>
            <div className="space-y-2">
              <label className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                URL Base
                <input
                  type="text"
                  value={hubConfig.baseUrl}
                  onChange={(e) => updateHub({ baseUrl: e.target.value })}
                  placeholder="http://127.0.0.1:31415/v1"
                  className="mt-1 block h-7 w-full rounded-md border border-zinc-200 bg-white px-2 text-[12px] text-zinc-700 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                />
              </label>
              <label className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                API Key
                <input
                  type="password"
                  value={hubConfig.apiKey}
                  onChange={(e) => updateHub({ apiKey: e.target.value })}
                  placeholder="Cole sua chave do FreeLLMAPI"
                  className="mt-1 block h-7 w-full rounded-md border border-zinc-200 bg-white px-2 text-[12px] text-zinc-700 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                />
              </label>
              <label className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                Modelo de Áudio
                <input
                  type="text"
                  value={hubConfig.audioModel}
                  onChange={(e) => updateHub({ audioModel: e.target.value })}
                  placeholder="whisper-large-v3-turbo"
                  className="mt-1 block h-7 w-full rounded-md border border-zinc-200 bg-white px-2 text-[12px] text-zinc-700 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                />
              </label>
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => void testHubConnection()}
                  disabled={testState.status === "loading"}
                  className="flex h-7 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <RefreshCw
                    size={12}
                    className={
                      testState.status === "loading" ? "animate-spin" : ""
                    }
                  />
                  Testar conexão
                </button>
                {testState.message && (
                  <p
                    className={`mt-1.5 text-[11px] leading-tight ${
                      testState.status === "ok"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : testState.status === "error"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-zinc-400"
                    }`}
                  >
                    {testState.message}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="border-b border-zinc-100 px-1.5 py-1.5 dark:border-zinc-800">
            {MENU_LINKS.map(({ labelKey, href, Icon }) => (
              <a
                key={labelKey}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-zinc-700 transition hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
              >
                <span className="shrink-0 text-zinc-400 dark:text-zinc-500">
                  <Icon size={14} />
                </span>
                <span className="flex-1">{t(labelKey)}</span>
                <ExternalLink
                  size={12}
                  className="shrink-0 text-zinc-300 dark:text-zinc-600"
                />
              </a>
            ))}
          </section>

          <section className="px-2 py-2.5">
            <p className="mb-2 text-[11px] font-medium tracking-wide text-zinc-400 dark:text-zinc-500">
              {t("settings.privacy")}
            </p>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={telemetry}
                onChange={(e) => setTelemetry(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-transparent"
              />
              <span>
                <span className="block text-[12px] text-zinc-700 dark:text-zinc-300">
                  {t("settings.helpImprove")}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-zinc-400 dark:text-zinc-500">
                  {t("settings.telemetryHelp")}
                </span>
              </span>
            </label>
          </section>
        </PopoverContent>
      </div>
    </Popover>
  );
}

function AppearanceOption({
  value,
  label,
  icon: Icon,
  selected,
  onSelect,
}: {
  value: Appearance;
  label: string;
  icon: typeof Sun;
  selected: boolean;
  onSelect: (value: Appearance) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(value)}
      className={`flex cursor-pointer items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[13px] font-medium transition ${
        selected
          ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
          : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
