"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AwsCredentialEntry {
  id: string;
  alias: string;
  accessKeyId: string;
  region: string;
  maskedKey: string;
  status: "untested" | "valid" | "invalid";
  createdAt: string;
  lastTestedAt?: string;
}

export interface AwsAccount {
  id: string;
  credentialId: string;
  accountId: string;
  alias: string;
  region: string;
  status: string;
  servicesCount: number;
  uptime: number;
  services?: { id: string; name: string; namespace: string }[];
}

interface SettingsState {
  // The list of configured AWS credentials
  credentials: AwsCredentialEntry[];
  // The list of discovered AWS accounts
  accounts: AwsAccount[];
  // Active credential being used
  activeCredentialId: string | null;
  // Loading states
  isLoading: boolean;
  isTesting: string | null; // credential id being tested
  error: string | null;

  // Actions
  fetchCredentials: () => Promise<void>;
  addCredential: (
    alias: string,
    accessKeyId: string,
    secretAccessKey: string,
    region: string
  ) => Promise<boolean>;
  deleteCredential: (id: string) => Promise<void>;
  testCredential: (id: string) => Promise<boolean>;
  testNewCredentials: (
    accessKeyId: string,
    secretAccessKey: string,
    region: string
  ) => Promise<{ valid: boolean; accountId?: string }>;
  setActiveCredential: (id: string | null) => void;
  fetchAwsAccounts: (credentialId: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      credentials: [],
      accounts: [],
      activeCredentialId: null,
      isLoading: false,
      isTesting: null,
      error: null,

      fetchCredentials: async () => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch("/api/credentials");
          if (!res.ok) throw new Error("Failed to fetch credentials");
          const data = await res.json();
          const currentActive = get().activeCredentialId;
          // If activeCredentialId points to a credential that no longer exists, clear it
          const activeStillValid = currentActive && data.some((c: { id: string }) => c.id === currentActive);
          set({
            credentials: data,
            isLoading: false,
            activeCredentialId: activeStillValid ? currentActive : null,
          });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      },

      addCredential: async (alias, accessKeyId, secretAccessKey, region) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch("/api/credentials", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ alias, accessKeyId, secretAccessKey, region }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed to create credential");
          }
          const created = await res.json();
          await get().fetchCredentials();
          // Set the newly created credential as active
          set({ activeCredentialId: created.id });
          return true;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
          return false;
        }
      },

      deleteCredential: async (id) => {
        set({ error: null });
        try {
          const res = await fetch(`/api/credentials?id=${id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("Failed to delete credential");
          set((state) => ({
            credentials: state.credentials.filter((c) => c.id !== id),
            accounts: state.accounts.filter((a) => a.credentialId !== id),
            activeCredentialId:
              state.activeCredentialId === id ? null : state.activeCredentialId,
          }));
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      },

      testCredential: async (id) => {
        const cred = get().credentials.find((c) => c.id === id);
        if (!cred) return false;
        set({ isTesting: id, error: null });
        try {
          const res = await fetch("/api/credentials/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          const data = await res.json();
          if (data.valid) {
            // Update local state
            set((state) => ({
              isTesting: null,
              credentials: state.credentials.map((c) =>
                c.id === id
                  ? { ...c, status: "valid", lastTestedAt: new Date().toISOString() }
                  : c
              ),
            }));
            return true;
          } else {
            set((state) => ({
              isTesting: null,
              credentials: state.credentials.map((c) =>
                c.id === id ? { ...c, status: "invalid" } : c
              ),
              error: data.details || "Invalid credentials",
            }));
            return false;
          }
        } catch (err) {
          set({
            isTesting: null,
            error: err instanceof Error ? err.message : "Test failed",
          });
          return false;
        }
      },

      testNewCredentials: async (accessKeyId, secretAccessKey, region) => {
        set({ error: null });
        try {
          const res = await fetch("/api/credentials/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessKeyId, secretAccessKey, region }),
          });
          const data = await res.json();
          return { valid: data.valid, accountId: data.accountId };
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Test failed",
          });
          return { valid: false };
        }
      },

      setActiveCredential: (id) => {
        set({ activeCredentialId: id });
      },

      fetchAwsAccounts: async (credentialId) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(
            `/api/aws/accounts?credentialId=${credentialId}`
          );
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            // If credential not found (404), it means the stored activeCredentialId is stale
            if (res.status === 404) {
              set({
                isLoading: false,
                activeCredentialId: null,
                accounts: [],
                error: errBody.error || "Credential not found — please re-select or re-add your AWS credential",
              });
              return;
            }
            throw new Error(errBody.error || "Failed to fetch accounts");
          }
          const data = await res.json();
          set((state) => ({
            isLoading: false,
            accounts: [
              ...state.accounts.filter((a) => a.credentialId !== credentialId),
              {
                id: data.id,
                credentialId,
                accountId: data.accountId,
                alias: data.alias,
                region: data.region,
                status: data.status,
                servicesCount: data.servicesCount,
                uptime: data.uptime,
                services: data.services,
              },
            ],
          }));
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      },
    }),
    {
      name: "obs-settings",
      partialize: (state) => ({
        activeCredentialId: state.activeCredentialId,
      }),
    }
  )
);
