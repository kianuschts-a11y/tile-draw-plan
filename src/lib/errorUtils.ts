/**
 * Sanitizes database error messages to prevent information leakage.
 * Maps database error codes to user-friendly messages in German.
 * Detailed errors are logged to console for debugging.
 */

interface DatabaseError {
  code?: string;
  message: string;
}

const ERROR_CODE_MAP: Record<string, string> = {
  // PostgreSQL error codes
  '23505': 'Dieser Eintrag existiert bereits',
  '23503': 'Ungültige Referenz',
  '23502': 'Erforderliche Daten fehlen',
  '42501': 'Zugriff verweigert',
  '42P01': 'Ein Fehler ist aufgetreten',
  '22P02': 'Ungültiges Datenformat',
  '23514': 'Ungültige Daten',
  
  // PostgREST error codes
  'PGRST301': 'Zugriff verweigert',
  'PGRST116': 'Ein Fehler ist aufgetreten',
};

const AUTH_ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'Ungültige E-Mail oder Passwort',
  'User already registered': 'Diese E-Mail-Adresse ist bereits registriert',
  'Email not confirmed': 'E-Mail-Adresse wurde noch nicht bestätigt',
  'Invalid email or password': 'Ungültige E-Mail oder Passwort',
  'Password should be at least 6 characters': 'Passwort muss mindestens 6 Zeichen haben',
  'Signup requires a valid password': 'Ein gültiges Passwort ist erforderlich',
};

/**
 * Sanitizes a database error message for safe display to users.
 * Logs the original error to console for debugging purposes.
 */
export function sanitizeDatabaseError(error: DatabaseError): string {
  // Log detailed error for debugging (only visible in console)
  console.error('Database error:', error);

  // Check for PostgreSQL/PostgREST error codes
  if (error.code && error.code in ERROR_CODE_MAP) {
    return ERROR_CODE_MAP[error.code];
  }

  // Return generic error message to prevent information leakage
  return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
}

/**
 * Sanitizes an authentication error message for safe display to users.
 * Maps known auth error messages to German translations.
 */
export function sanitizeAuthError(errorMessage: string): string {
  // Check for known auth error patterns
  for (const [pattern, translation] of Object.entries(AUTH_ERROR_MAP)) {
    if (errorMessage.includes(pattern)) {
      return translation;
    }
  }

  // Check if it's already registered error
  if (errorMessage.toLowerCase().includes('already registered')) {
    return 'Diese E-Mail-Adresse ist bereits registriert';
  }

  // Return generic error message to prevent information leakage
  return 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
}
