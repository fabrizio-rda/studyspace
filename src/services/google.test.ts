import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authorizeGoogle,
  forgetGoogle,
  googleConnected,
  googleGet,
  SCOPES,
  pickDrive,
} from "./google";
import { fetchClassroomCourses, fetchCourseWork } from "./classroom";
let configuration: google.accounts.oauth2.TokenClientConfig;
function callback() {
  configuration.callback({
    access_token: "ephemeral-access",
    expires_in: 3600,
    scope: configuration.scope,
    token_type: "Bearer",
    hd: "",
    authuser: "0",
    prompt: "",
  } as unknown as google.accounts.oauth2.TokenResponse);
}
beforeEach(() => {
  localStorage.clear();
  forgetGoogle();
  localStorage.setItem(
    "studyspace:public-config:v1",
    JSON.stringify({
      googleClientId: "123.apps.googleusercontent.com",
      googleApiKey: "AIzaPublicExample",
      googleAppId: "123",
    }),
  );
  vi.stubGlobal("google", {
    accounts: {
      oauth2: {
        initTokenClient: vi.fn(
          (c: google.accounts.oauth2.TokenClientConfig) => {
            configuration = c;
            return { requestAccessToken: vi.fn(() => callback()) };
          },
        ),
        hasGrantedAllScopes: vi.fn(() => true),
        revoke: vi.fn((_t, cb) => cb()),
      },
    },
  });
});
afterEach(() => {
  forgetGoogle();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("Adaptadores Google con SDK y red sustituidos", () => {
  it("solicita drive.file por separado y mantiene el token fuera de la persistencia", async () => {
    const raw = JSON.stringify(localStorage);
    await authorizeGoogle("drive");
    expect(configuration.scope).toBe(SCOPES.drive[0]);
    expect(configuration.include_granted_scopes).toBe(false);
    expect(googleConnected("drive")).toBe(true);
    expect(googleConnected("classroom")).toBe(false);
    expect(JSON.stringify(localStorage)).toBe(raw);
    forgetGoogle();
    expect(googleConnected("drive")).toBe(false);
  });
  it("no da por conectada una autorización parcial", async () => {
    vi.mocked(google.accounts.oauth2.hasGrantedAllScopes).mockReturnValue(
      false,
    );
    await expect(authorizeGoogle("classroom")).rejects.toThrow(
      "Faltan permisos",
    );
    expect(googleConnected("classroom")).toBe(false);
  });
  it("consulta todas las páginas y solo usa GET al leer cursos y entregas del alumno", async () => {
    await authorizeGoogle("classroom");
    const request = vi.fn(async (input: string) => {
      const url = new URL(input);
      const result =
        url.pathname === "/v1/courses"
          ? url.searchParams.has("pageToken")
            ? { courses: [{ id: "c2", name: "Segundo" }] }
            : { courses: [{ id: "c1", name: "Primero" }], nextPageToken: "two" }
          : url.pathname.endsWith("studentSubmissions")
            ? {
                studentSubmissions: [
                  { courseWorkId: "w1", state: "TURNED_IN" },
                ],
              }
            : {
                courseWork: [
                  {
                    id: "w1",
                    courseId: "c1",
                    title: "Entrega",
                    alternateLink: "https://classroom.google.com/c/c1/a/w1",
                  },
                ],
              };
      return new Response(JSON.stringify(result), { status: 200 });
    });
    vi.stubGlobal("fetch", request);
    expect(await fetchClassroomCourses()).toHaveLength(2);
    expect((await fetchCourseWork("c1"))[0].submissionState).toBe("TURNED_IN");
    for (const call of request.mock.calls as unknown as [
      string,
      RequestInit,
    ][]) {
      expect(call[1].method ?? "GET").toBe("GET");
      expect(call[1].headers).toEqual({
        Authorization: "Bearer ephemeral-access",
      });
      expect(new URL(call[0]).hostname).toBe("classroom.googleapis.com");
    }
  });
  it("explica restricciones escolares y elimina una autorización expirada", async () => {
    await authorizeGoogle("classroom");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 403 })),
    );
    await expect(
      googleGet("classroom", "https://classroom.googleapis.com/v1/courses"),
    ).rejects.toThrow("institución");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 401 })),
    );
    await expect(
      googleGet("classroom", "https://classroom.googleapis.com/v1/courses"),
    ).rejects.toThrow("expiró");
    expect(googleConnected("classroom")).toBe(false);
  });
  it("Picker recoge selección explícita, verifica metadatos de Drive y devuelve solo una referencia", async () => {
    await authorizeGoogle("drive");
    const chain = {
      addView: vi.fn(() => chain),
      setOAuthToken: vi.fn(() => chain),
      setDeveloperKey: vi.fn(() => chain),
      setAppId: vi.fn(() => chain),
      setOrigin: vi.fn(() => chain),
      enableFeature: vi.fn(() => chain),
      setCallback: vi.fn(),
      build: vi.fn(() => ({
        setVisible: () =>
          selection({ action: "picked", docs: [{ id: "file1" }] }),
      })),
    };
    let selection: (r: unknown) => void = () => {};
    chain.setCallback.mockImplementation((cb) => {
      selection = cb;
      return chain;
    });
    Object.assign(google, {
      picker: {
        DocsView: class {
          setIncludeFolders() {
            return this;
          }
          setSelectFolderEnabled() {
            return this;
          }
        },
        ViewId: { DOCS: "docs" },
        PickerBuilder: class {
          constructor() {
            return chain;
          }
        },
        Feature: { MULTISELECT_ENABLED: "multi" },
        Action: { PICKED: "picked", CANCEL: "cancel" },
      },
    });
    vi.stubGlobal("gapi", {
      load: (_n: string, o: { callback: () => void }) => o.callback(),
    });
    const append = vi
      .spyOn(document.head, "append")
      .mockImplementation((...nodes) => {
        const script = nodes[0] as HTMLScriptElement;
        queueMicrotask(() => script.dispatchEvent(new Event("load")));
      });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: "file1",
              name: "Apuntes",
              mimeType: "application/pdf",
              webViewLink: "https://drive.google.com/file/d/file1/view",
            }),
            { status: 200 },
          ),
      ),
    );
    const docs = await pickDrive();
    expect(append).toHaveBeenCalled();
    expect(chain.setOrigin).toHaveBeenCalledWith(window.location.origin);
    expect(chain.setAppId).toHaveBeenCalledWith("123");
    expect(docs[0]).toMatchObject({
      externalId: "file1",
      name: "Apuntes",
      source: "drive",
      mimeType: "application/pdf",
      folderId: null,
    });
    expect(docs[0]).not.toHaveProperty("content");
    expect(localStorage.getItem("ephemeral-access")).toBeNull();
  });
  it("rechaza una respuesta OAuth tardía si la cuenta cambió durante el popup", async () => {
    vi.mocked(google.accounts.oauth2.initTokenClient).mockImplementation(
      (c) => {
        configuration = c;
        return {
          requestAccessToken: vi.fn(),
        } as google.accounts.oauth2.TokenClient;
      },
    );
    const authorization = authorizeGoogle("drive");
    forgetGoogle();
    callback();
    await expect(authorization).rejects.toThrow("cuenta cambió");
    expect(googleConnected("drive")).toBe(false);
  });
});
