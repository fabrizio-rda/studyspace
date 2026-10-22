// Translate delivery/verification failures without hiding unknown server errors.
export function accountAccessError(error: unknown): string {
  const value = error as {
    code?: string;
    status?: number;
    message?: string;
  } | null;
  const message = value?.message ?? String(error);
  if (
    value?.code === "over_email_send_rate_limit" ||
    /email rate limit/i.test(message)
  )
    return "Se alcanzó el límite de correos del proyecto. Espera antes de reintentar; si se repite, el administrador debe revisar el servicio de correo de Supabase.";
  if (value?.code === "over_request_rate_limit" || value?.status === 429)
    return "Demasiados intentos. Espera unos minutos antes de solicitar otro correo.";
  if (
    value?.code === "email_address_not_authorized" ||
    /email address not authorized/i.test(message)
  )
    return "El servicio de correo de Supabase no permite enviar a esta dirección. El administrador debe configurar un proveedor SMTP para permitir el acceso de Catalina.";
  if (value?.code === "otp_expired" || /expired|invalid.*token/i.test(message))
    return "El código o enlace venció o ya se utilizó. Solicita otro correo y usa únicamente el más reciente.";
  if (/failed to fetch|network|load failed/i.test(message))
    return "No se pudo conectar con Supabase. Comprueba tu conexión y que la URL del proyecto sea la misma que usa la otra cuenta.";
  if (/error sending|smtp/i.test(message))
    return "El proveedor no pudo enviar el correo. El administrador debe revisar la configuración SMTP en Supabase.";
  return message;
}
