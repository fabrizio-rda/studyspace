export type PublicConfig = {
  supabaseUrl: string;
  supabaseKey: string;
  googleClientId: string;
  googleApiKey: string;
  googleAppId: string;
};
const key = "studyspace:public-config:v1";
const empty: PublicConfig = {
  supabaseUrl: "",
  supabaseKey: "",
  googleClientId: "",
  googleApiKey: "",
  googleAppId: "",
};
export function loadConfig(): PublicConfig {
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(key) ?? "{}") };
  } catch {
    return empty;
  }
}
export function validateConfig(c: PublicConfig) {
  if (
    c.supabaseUrl &&
    !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(c.supabaseUrl)
  )
    throw new Error(
      "Usa la URL https://<proyecto>.supabase.co de tu proyecto.",
    );
  if (c.supabaseKey) {
    if (c.supabaseKey.startsWith("sb_secret_"))
      throw new Error(
        "Una clave secreta no puede usarse aquí. Usa la clave publishable o anon.",
      );
    if (!c.supabaseKey.startsWith("sb_publishable_")) {
      try {
        const token = JSON.parse(
          atob(
            c.supabaseKey.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"),
          ),
        );
        if (token.role !== "anon") throw new Error();
      } catch {
        throw new Error(
          "Usa una clave pública publishable o el JWT anon; nunca service_role.",
        );
      }
    }
  }
  if (
    c.googleClientId &&
    !/^[\w.-]+\.apps\.googleusercontent\.com$/.test(c.googleClientId)
  )
    throw new Error("Client ID de Google no válido.");
  if (c.googleApiKey && !/^AIza[0-9A-Za-z_-]{30,50}$/.test(c.googleApiKey))
    throw new Error(
      "Usa una API key pública de Google (AIza…), nunca un client secret.",
    );
  if (c.googleAppId && !/^\d+$/.test(c.googleAppId))
    throw new Error("El número de proyecto de Google debe ser numérico.");
  return c;
}
export function saveConfig(c: PublicConfig) {
  validateConfig(c);
  localStorage.setItem(key, JSON.stringify(c));
  window.dispatchEvent(new Event("studyspace:config"));
}
