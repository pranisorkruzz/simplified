import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

function getSearchParams(value: string) {
  return new URLSearchParams(value.startsWith('#') ? value.slice(1) : value);
}

export function getPasswordResetRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/reset-password`;
  }

  return Linking.createURL('/reset-password');
}

export function getAuthParamsFromUrl(url: string) {
  const queryIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');
  const queryString =
    queryIndex >= 0
      ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
      : '';
  const hashString = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';

  const params = getSearchParams(queryString);
  const hashParams = getSearchParams(hashString);

  hashParams.forEach((value, key) => {
    params.set(key, value);
  });

  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    code: params.get('code'),
    type: params.get('type'),
    errorCode: params.get('error_code'),
    errorDescription: params.get('error_description'),
  };
}

export async function restoreSessionFromUrl(url: string) {
  const {
    accessToken,
    refreshToken,
    code,
    errorCode,
    errorDescription,
  } = getAuthParamsFromUrl(url);

  if (errorCode) {
    throw new Error(errorDescription || errorCode);
  }

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }

    return Boolean(data.session);
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    return Boolean(data.session);
  }

  return false;
}
