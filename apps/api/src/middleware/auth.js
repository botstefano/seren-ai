import { supabase } from "../lib/supabase.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      return res.status(401).json({
        error: "AUTH_REQUIRED",
        message: "Inicia sesion para acceder a Seren AI.",
      });
    }

    if (!supabase) {
      return res.status(503).json({
        error: "SUPABASE_NOT_CONFIGURED",
        message: "La API aun no tiene configuradas las credenciales de Supabase.",
      });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({
        error: "INVALID_SESSION",
        message: "La sesion no es valida o ha caducado. Vuelve a iniciar sesion.",
      });
    }

    req.user = data.user;
    next();
  } catch (error) {
    next(error);
  }
}
