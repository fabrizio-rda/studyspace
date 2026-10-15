import type { DocumentRef } from "../models/schema";
import { loadConfig } from "./config";
export type GoogleService = "drive" | "classroom";
export const SCOPES = {
  drive: ["https://www.googleapis.com/auth/drive.file"],
  classroom: [
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
    "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
  ],
};
let tokens: Partial<Record<GoogleService, { token: string; expires: number }>> =
  {};
const loaders = new Map<string, Promise<void>>();
function loadScript(src: string) {
  if (loaders.has(src)) return loaders.get(src)!;
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    const timeout = setTimeout(() => {
      loaders.delete(src);
      s.remove();
      reject(
        new Error(
          "Google no respondió. Revisa la conexión o los bloqueos de contenido y vuelve a guardar la configuración.",
        ),
      );
    }, 20000);
    s.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
    s.onerror = () => {
      clearTimeout(timeout);
      loaders.delete(src);
      s.remove();
      reject(new Error("No se pudo cargar Google. Comprueba tu conexión."));
    };
    document.head.append(s);
  });
  loaders.set(src, p);
  return p;
}
export async function prepareGoogle() {
  await loadScript("https://accounts.google.com/gsi/client");
}
export function googleConnected(service: GoogleService) {
  const t = tokens[service];
  return !!t && t.expires > Date.now() + 10000;
}
export function authorizeGoogle(service: GoogleService): Promise<void> {
  const c = loadConfig();
  if (!c.googleClientId || !(typeof google !== "undefined" && google.accounts))
    throw new Error(
      "Configura Google Cloud y espera a que cargue la autorización.",
    );
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: c.googleClientId,
      scope: SCOPES[service].join(" "),
      include_granted_scopes: false,
      callback: (r) => {
        if (r.error || !r.access_token) {
          reject(
            new Error(
              `Google no autorizó el acceso: ${r.error ?? "permiso denegado"}. La cuenta escolar puede requerir aprobación del administrador.`,
            ),
          );
          return;
        }
        if (
          !google.accounts.oauth2.hasGrantedAllScopes(
            r,
            SCOPES[service][0],
            ...SCOPES[service].slice(1),
          )
        ) {
          reject(
            new Error(
              "Faltan permisos de lectura requeridos. Vuelve a conectar o consulta al administrador escolar.",
            ),
          );
          return;
        }
        tokens[service] = {
          token: r.access_token,
          expires: Date.now() + Number(r.expires_in) * 1000,
        };
        resolve();
      },
      error_callback: (e) =>
        reject(
          new Error(
            e.type === "popup_closed"
              ? "Se cerró la ventana de Google."
              : "No se pudo abrir Google. Permite ventanas emergentes y vuelve a intentar.",
          ),
        ),
    });
    client.requestAccessToken({ prompt: "select_account" });
  });
}
export function forgetGoogle() {
  tokens = {};
}
export async function disconnectGoogle(service: GoogleService) {
  const t = tokens[service];
  try {
    if (t && typeof google !== "undefined" && google.accounts)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () =>
            reject(
              new Error(
                "La sesión se desconectó. Revisa o retira los permisos en myaccount.google.com/permissions.",
              ),
            ),
          10000,
        );
        google.accounts.oauth2.revoke(t.token, () => {
          clearTimeout(timeout);
          resolve();
        });
      });
  } finally {
    forgetGoogle();
  }
}
function tokenFor(service: GoogleService) {
  if (!googleConnected(service))
    throw new Error("La autorización de Google expiró. Vuelve a conectar.");
  return tokens[service]!.token;
}
export async function googleGet<T>(
  service: GoogleService,
  url: string,
): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokenFor(service)}` },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    if (res.status === 401) delete tokens[service];
    throw new Error(
      res.status === 401
        ? "La autorización expiró. Vuelve a conectar."
        : res.status === 403
          ? "Google denegó el acceso. Revisa los permisos, las APIs habilitadas y la aprobación de tu institución."
          : `Google respondió ${res.status}. Vuelve a intentar.`,
    );
  }
  return res.json();
}
export async function pickDrive(): Promise<DocumentRef[]> {
  const c = loadConfig();
  if (!c.googleApiKey || !c.googleAppId)
    throw new Error(
      "Falta la API key pública y el número de proyecto de Google Picker.",
    );
  const token = tokenFor("drive");
  await loadScript("https://apis.google.com/js/api.js");
  await new Promise<void>((resolve, reject) =>
    gapi.load("picker", {
      callback: resolve,
      onerror: () => reject(new Error("No se pudo cargar Google Picker.")),
    }),
  );
  const selected = await new Promise<google.picker.DocumentObject[]>(
    (resolve) => {
      const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);
      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(c.googleApiKey)
        .setAppId(c.googleAppId)
        .setOrigin(window.location.origin)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setCallback((result) => {
          if (result.action === google.picker.Action.PICKED)
            resolve(result.docs ?? []);
          else if (result.action === google.picker.Action.CANCEL) resolve([]);
        })
        .build();
      picker.setVisible(true);
    },
  );
  return Promise.all(
    selected.map(async (doc) => {
      const file = await googleGet<{
        id: string;
        name: string;
        mimeType: string;
        webViewLink?: string;
      }>(
        "drive",
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.id)}?fields=id,name,mimeType,webViewLink`,
      );
      return {
        id: crypto.randomUUID(),
        externalId: file.id,
        name: file.name.slice(0, 300),
        mimeType: file.mimeType,
        url:
          file.webViewLink ??
          `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`,
        source: "drive" as const,
        folderId: null,
        courseId: null,
        topicId: null,
        tags: [],
        createdAt: new Date().toISOString(),
      };
    }),
  );
}
