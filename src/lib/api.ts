import { showErrorSession } from "@/utils/toastHelper";

// lib/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is not defined in your .env file.");
}

type RequestOptions = RequestInit & {
  params?: Record<string, string | number>;
};

type UploadOptions = Omit<RequestOptions, 'headers'> & {
  fieldName?: string;                           
  extraData?: Record<string, string | Blob>;    
};

type UploadOptionsProgressBar = {
  params?: Record<string, string>;
  fieldName?: string;
  extraData?: Record<string, string>;
  onUploadProgress?: (event: ProgressEvent) => void;
};

const buildURL = (url: string, params?: Record<string, string | number>) => {
  const queryString = params
    ? "?" + new URLSearchParams(params as Record<string, string>).toString()
    : "";
  return `${BASE_URL}${url}${queryString}`;
};

export const get = async <T = any>(url: string, options?: RequestOptions): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {})
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(buildURL(`${url}`, options?.params), {
    method: 'GET',
    headers,
    cache: 'no-store',
    next: { revalidate: 0 },
    credentials: 'include',
  });

  // if (!res.ok) {
  //   showErrorSession()
  //   throw new Error(`GET ${url} failed: ${res.statusText}`);
  // }

  return res.json();
};

export const post = async <T = any>(
  url: string,
  body: any,
  options?: RequestOptions
): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
  });

  // if (!res.ok) {
  //   showErrorSession()
  //   throw new Error(`POST ${url} failed: ${res.statusText}`);
  // }

  return res.json();
};

export const put = async <T = any>(
  url: string,
  body: any,
  options?: RequestOptions
): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(buildURL(`${url}`, options?.params), {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`PUT ${url} failed: ${res.status} ${res.statusText} - ${errorBody}`);
  }

  return res.json();
};

export const del = async <T = any>(
  url: string,
  options?: RequestOptions
): Promise<T> => {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> || {}),
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(buildURL(`${url}`, options?.params), {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`DELETE ${url} failed: ${res.status} ${res.statusText} - ${errorBody}`);
  }

  // Jika respons kosong, hindari error .json()
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
};

export const upload = async <T = any>(
  url: string,
  file: File,
  options?: UploadOptions
): Promise<T> => {
  const fullUrl = buildURL(`${url}`, options?.params);

  const formData = new FormData();
  const field = options?.fieldName ?? 'file';
  formData.append(field, file);

  if (options?.extraData) {
    for (const [key, value] of Object.entries(options.extraData)) {
      formData.append(key, value);
    }
  }

  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(fullUrl, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`UPLOAD ${url} failed: ${res.statusText}`);
  }

  return res.json();
};

export const uploadWithProgressBar = async <T = any>(
  url: string,
  file: File,
  options?: UploadOptionsProgressBar
): Promise<T> => {
  const fullUrl = buildURL(`${url}`, options?.params);

  const formData = new FormData();
  const field = options?.fieldName ?? 'file';
  formData.append(field, file);

  if (options?.extraData) {
    for (const [key, value] of Object.entries(options.extraData)) {
      formData.append(key, value);
    }
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', fullUrl, true);

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.withCredentials = true;

    xhr.upload.onprogress = options?.onUploadProgress || null;

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (err) {
          reject(new Error('Invalid JSON response'));
        }
      } else {
        reject(new Error(`UPLOAD ${url} failed: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error(`UPLOAD ${url} failed due to network error`));
    };

    xhr.send(formData);
  });
};

export const download = async (url: string, options?: RequestOptions & { fileName?: string }) => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ...(options?.headers as Record<string, string> || {})
  };

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(buildURL(`${url}`, options?.params), {
    method: "GET",
    headers,
    cache: "no-store",
    next: { revalidate: 0 },
    credentials: "include",
  });

  if (!res.ok) {
    showErrorSession();
    throw new Error(`Download ${url} failed: ${res.statusText}`);
  }

  const buffer = await res.arrayBuffer();

  let finalBuffer = buffer;
  const view = new Uint8Array(buffer);
  const prefix = String.fromCharCode(...view.slice(0, 6));
  if (prefix === "00000|") {
    finalBuffer = buffer.slice(6);
  }

  const blob = new Blob([finalBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = options?.fileName ?? "download.xlsx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
};
