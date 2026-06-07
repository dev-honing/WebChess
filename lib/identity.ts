"use client";

import type { UserIdentity } from "@/lib/types";

const ID_KEY = "webchess-user-id";
const NAME_KEY = "webchess-nickname";

function fallbackId() {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") {
    return `guest-${webCrypto.randomUUID()}`;
  }

  if (typeof webCrypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);
    const random = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `guest-${random}`;
  }

  const random = Math.random().toString(36).slice(2);
  return `guest-${Date.now().toString(36)}-${random}`;
}

export function getIdentity(): UserIdentity {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = fallbackId();
    localStorage.setItem(ID_KEY, id);
  }

  let nickname = localStorage.getItem(NAME_KEY)?.trim();
  if (!nickname) {
    nickname = `Guest ${id.slice(-4).toUpperCase()}`;
    localStorage.setItem(NAME_KEY, nickname);
  }

  return { id, nickname };
}

export function saveNickname(nickname: string): UserIdentity {
  const identity = getIdentity();
  const clean = nickname.trim().slice(0, 18) || identity.nickname;
  localStorage.setItem(NAME_KEY, clean);
  return { ...identity, nickname: clean };
}

export function saveIdentity(identity: UserIdentity): UserIdentity {
  const clean = {
    id: String(identity.id).slice(0, 80),
    nickname: String(identity.nickname).trim().slice(0, 18) || "Kakao Player",
  };
  localStorage.setItem(ID_KEY, clean.id);
  localStorage.setItem(NAME_KEY, clean.nickname);
  return clean;
}

export function resetIdentity(): UserIdentity {
  localStorage.removeItem(ID_KEY);
  localStorage.removeItem(NAME_KEY);
  return getIdentity();
}
