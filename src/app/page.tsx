"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type Protocol = "vscode" | "vscode-insiders";
const DEFAULT_AGENT = "agent";



function decodeLegacyBase64(text: string): string {
  try {
    const binary = atob(text);
    const bytes = Uint8Array.from(binary, (char: string) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function ensureAtVscode(prompt: string): string {
  return prompt.startsWith("@vscode") ? prompt : `@vscode ${prompt}`;
}

function buildDeepLink(prompt: string, agent: string, protocol: Protocol): string {
  const encodedAgent = encodeURIComponent(agent || "agent");
  const encodedPrompt = encodeURIComponent(ensureAtVscode(prompt));
  return `${protocol}://GitHub.Copilot-Chat/chat?agent=${encodedAgent}&prompt=${encodedPrompt}`;
}

function getShareUrl(prompt: string, protocol: Protocol): string {
  const url = new URL(window.location.href);
  url.search = "";
  const params = new URLSearchParams();
  params.set("q", prompt);
  if (protocol !== "vscode") {
    params.set("proto", protocol);
  }
  return `${url.toString()}?${params.toString()}`;
}

function getPlaybackPayload(): { prompt: string; agent: string; protocol: Protocol } | null {
  const params = new URLSearchParams(window.location.search);
  const rawPrompt = params.get("q");
  const legacyPrompt = params.get("p");

  const prompt =
    typeof rawPrompt === "string" && rawPrompt.length > 0
      ? rawPrompt
      : legacyPrompt
        ? decodeLegacyBase64(legacyPrompt)
        : "";

  if (!prompt) {
    return null;
  }

  return {
    prompt,
    agent: params.get("a") || DEFAULT_AGENT,
    protocol: params.get("proto") === "vscode-insiders" ? "vscode-insiders" : "vscode",
  };
}

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [protocol, setProtocol] = useState<Protocol>("vscode");
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);

  const [isPlayback, setIsPlayback] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [showLaunchNotice, setShowLaunchNotice] = useState(false);
  const [clickedAction, setClickedAction] = useState(false);
  const autoLaunchedRef = useRef(false);

  const deepLink = useMemo(() => buildDeepLink(prompt, DEFAULT_AGENT, protocol), [prompt, protocol]);

  useEffect(() => {
    const payload = getPlaybackPayload();
    if (!payload) {
      return;
    }

    setPrompt(payload.prompt);
    setProtocol(payload.protocol);
    setIsPlayback(true);
  }, []);

  useEffect(() => {
    if (!isPlayback || !prompt) {
      return;
    }

    let cancelled = false;
    let index = 0;
    setTypedText("");
    setClickedAction(false);
    setShowLaunchNotice(false);

    const tick = () => {
      if (cancelled) {
        return;
      }
      if (index < prompt.length) {
        const nextChar = prompt[index];
        index += 1;
        setTypedText((prev: string) => prev + nextChar);

        let delay = 20 + Math.random() * 35;
        if (nextChar === " ") {
          delay += 25;
        }
        if (".,!?\n".includes(nextChar)) {
          delay += 90;
        }
        window.setTimeout(tick, delay);
      } else {
        window.setTimeout(() => {
          setClickedAction(true);
          window.setTimeout(() => {
            setShowLaunchNotice(true);
            if (!autoLaunchedRef.current) {
              autoLaunchedRef.current = true;
              window.location.assign(buildDeepLink(prompt, DEFAULT_AGENT, protocol));
            }
          }, 420);
        }, 380);
      }
    };

    tick();

    return () => {
      cancelled = true;
    };
  }, [isPlayback, prompt, protocol]);

  const normalizeInputs = (): { prompt: string } | null => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      return null;
    }

    return {
      prompt: trimmedPrompt,
    };
  };

  const handleCreateShareLink = async () => {
    const values = normalizeInputs();
    if (!values) {
      return;
    }

    setPrompt(values.prompt);
    const link = getShareUrl(values.prompt, protocol);
    setShareLink(link);
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitPrompt = () => {
    const values = normalizeInputs();
    if (!values) {
      return;
    }

    setPrompt(values.prompt);
    setShareLink(getShareUrl(values.prompt, protocol));
    window.location.assign(buildDeepLink(values.prompt, DEFAULT_AGENT, protocol));
  };

  const handlePreviewTypingLink = () => {
    const values = normalizeInputs();
    if (!values) {
      return;
    }

    window.location.assign(getShareUrl(values.prompt, protocol));
  };

  const handleCopy = async () => {
    if (!shareLink) {
      return;
    }
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleReset = () => {
    autoLaunchedRef.current = false;
    setIsPlayback(false);
    setTypedText("");
    setClickedAction(false);
    setShowLaunchNotice(false);
    window.history.replaceState({}, "", window.location.pathname);
  };

  const handleOpenDeepLink = () => {
    if (!prompt) {
      return;
    }

    window.location.assign(deepLink);
  };

  return (
    <main className="vscode-shell">
      <div className="atmosphere atmosphere-left" aria-hidden="true" />
      <div className="atmosphere atmosphere-right" aria-hidden="true" />

      <section className="vscode-card" data-insiders={protocol === "vscode-insiders" ? "" : undefined}>
        <header className="hero">
          <div className="brand-row">
            <img
              className={`brand-icon ${protocol === "vscode-insiders" ? "insiders" : ""}`}
              src="/vscode-stable.png"
              alt=""
              aria-hidden="true"
              width={32}
              height={32}
            />
            <span className="brand-chip">VS Code + GitHub Copilot</span>
          </div>

          <h1>Let Me Prompt That For You</h1>
          <p>
            Answer your friends questions about VS Code
          </p>
        </header>

        {!isPlayback ? (
          <>
            <div className="editor-panel">
              <div className="editor-frame">
                <span className="line-numbers" aria-hidden="true">
                  1
                </span>

                <textarea
                  id="prompt-text"
                  className="prompt-editor"
                  rows={8}
                  value={prompt}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                    setPrompt(event.target.value)
                  }
                  placeholder="@vscode how do prompts work in VS Code"
                />
              </div>
            </div>

            <div className="action-row">
              <button type="button" className="btn btn-primary" onClick={handleCreateShareLink}>
                {copied ? "Copied!" : "Create Share Link"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleSubmitPrompt}>
                Submit Prompt
              </button>
            </div>

            <div className="config-grid">
              <div className="field-block">
                <span>Protocol</span>
                <div className="protocol-toggle" role="group" aria-label="Protocol">
                  <button
                    type="button"
                    className={`protocol-button ${protocol === "vscode" ? "active" : ""}`}
                    aria-pressed={protocol === "vscode"}
                    onClick={() => setProtocol("vscode")}
                  >
                    <img
                      className="protocol-logo"
                      src="/vscode-stable.png"
                      alt=""
                      width={20}
                      height={20}
                    />
                    <span>VS Code</span>
                  </button>

                  <button
                    type="button"
                    className={`protocol-button ${protocol === "vscode-insiders" ? "active" : ""}`}
                    aria-pressed={protocol === "vscode-insiders"}
                    onClick={() => setProtocol("vscode-insiders")}
                  >
                    <img
                      className="protocol-logo insiders"
                      src="/vscode-stable.png"
                      alt=""
                      width={20}
                      height={20}
                    />
                    <span>Insiders</span>
                  </button>
                </div>
              </div>
            </div>

            {shareLink ? (
              <div className="share-inline" aria-live="polite">
                <input className="share-input" readOnly value={shareLink} />
                <button type="button" className="btn btn-small" onClick={handleCopy}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            ) : null}


          </>
        ) : (
          <>
            <div className="demo-window">
              <div className="editor-frame demo-body" aria-live="polite">
                <span className="line-numbers" aria-hidden="true">
                  1
                </span>

                <div className="typed-editor" role="status" aria-label="Typing prompt">
                  {typedText}
                  <span className="cursor" aria-hidden="true">
                    |
                  </span>
                </div>
              </div>
            </div>

            <div className="action-row">
              <button
                type="button"
                className={`btn btn-primary ${clickedAction ? "clicked" : ""}`}
                onClick={handleOpenDeepLink}
                disabled={!clickedAction}
              >
                Send Prompt
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleReset}>
                Edit Prompt
              </button>
            </div>

            <div className="status-card">
              {!showLaunchNotice ? (
                <p className="status-title">Typing prompt and opening VS Code...</p>
              ) : (
                <>
                  <p className="status-title">Done. Was that so hard?</p>
                  <div className="share-row">
                    <a className="btn btn-small" href={deepLink}>
                      Open Manually
                    </a>
                    <button type="button" className="btn btn-small btn-quiet" onClick={handleReset}>
                      Back
                    </button>
                  </div>
                </>
              )}
            </div>

            <footer className="footer-links muted">
              <span>Not affiliated with Microsoft or GitHub.</span>
            </footer>
          </>
        )}
      </section>
    </main>
  );
}
