import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

type SupabaseErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

export function getSupabaseErrorMessage(
  error: unknown,
  fallback: string
) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const maybeError = error as SupabaseErrorLike;
    const parts = [maybeError.message, maybeError.details, maybeError.hint].filter(
      (value): value is string => Boolean(value?.trim())
    );

    if (parts.length > 0) {
      return parts.join(' ');
    }
  }

  return fallback;
}

export function isMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as SupabaseErrorLike;
  const haystack = [maybeError.message, maybeError.details, maybeError.hint]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
  const target = columnName.toLowerCase();

  return (
    maybeError.code === 'PGRST204' ||
    haystack.includes(`'${target}'`) ||
    haystack.includes(`"${target}"`) ||
    haystack.includes(target)
  ) && (
    haystack.includes('schema cache') ||
    haystack.includes('does not exist') ||
    haystack.includes('could not find') ||
    haystack.includes('column')
  );
}
