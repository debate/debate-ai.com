import type { IPara, IRun } from 'src/cite/types';
import { get, writable } from 'svelte/store';

export let auth = writable({
  loggedIn: false,
});

let authInit = false;

chrome.storage.local.get(['loggedIn'], (result) => {
  auth.set({ loggedIn: result.loggedIn });
  authInit = true;
});

type UserInfo = {
  id: string;
  email: string;
  username: string;
  website: string;
  visible_email: boolean;
};

auth.subscribe((value) => {
  if (!authInit) return;

  chrome.storage.local.set({ loggedIn: value.loggedIn });
});

export const URL = 'https://vault.arguflow.ai/';
export const URL_USER = URL + 'user/';
const API_URL = 'https://api.arguflow.ai/api/';
const AUTH_URL = API_URL + 'auth';
const AUTO_CUT_URL = API_URL + 'card/cut';
const CARD_URL = API_URL + 'card';
const COLLECTIONS_URL = API_URL + 'user/collections/';

const ADD_CARD_TO_COLLECTION_URL = API_URL + 'card_collection/';

function makeRequest(
  url: string,
  method: 'POST' | 'GET' | 'DELETE',
  body: any,
  expectedStatus = 200,
  parseResponse = true,
  callbacks: {
    onSuccess?: (response: Response | any) => void;
    onError?: (response: Response) => void;
  } = {}
): Promise<any> {
  return new Promise((resolve, reject) => {
    let fetchInit: RequestInit = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (method !== 'GET') {
      fetchInit.body = JSON.stringify(body);
    }
    fetch(url, fetchInit)
      .then((res) => {
        if (res.ok && res.status === expectedStatus) {
          if (parseResponse) {
            res
              .json()
              .then((json) => {
                callbacks.onSuccess?.(json);
                resolve(json);
              })
              .catch((err) => {
                callbacks.onError?.(err);
                reject(err);
              });
          } else {
            callbacks.onSuccess?.(res);
            resolve(res);
          }
        } else {
          if (res.status === 401) {
            auth.set({ loggedIn: false });
          }
          callbacks.onError?.(res);
          reject('Unauthorized');
        }
      })
      .catch((err) => {
        callbacks.onError?.(err);
        reject(err);
      });
  });
}

export function login(
  email: string,
  password: string,
  saveLogin = true
): Promise<void> {
  return makeRequest(AUTH_URL, 'POST', { email, password }, 204, false, {
    onSuccess: () => {
      auth.set({ loggedIn: true });
      if (saveLogin) {
        chrome.storage.local.set({ arguflowLogin: { email, password } });
      }
    },
  });
}
export function logout(): Promise<void> {
  return makeRequest(AUTH_URL, 'DELETE', {}, 204, false, {
    onSuccess: () => {
      auth.set({ loggedIn: false });
    },
  });
}

export function autoCut(text: string): Promise<{ completion: string }> {
  return makeRequest(AUTO_CUT_URL, 'POST', { uncut_card: text }, 200, true);
}

export function getUserInfo(): Promise<UserInfo> {
  return makeRequest(AUTH_URL, 'GET', {}, 200, true);
}

export function getUserId(): Promise<string> {
  return new Promise((resolve, reject) => {
    getUserInfo()
      .then((info) => {
        resolve(info.id);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

export function htmlToParas(html: string): IPara[] {
  html = cleanHtml(html);
  // parse html
  let node = document.createElement('div');
  node.innerHTML = html;
  // convert to paras
  let paras: IPara[] = [];
  for (let paraNode of node.querySelectorAll('p')) {
    let para: IPara = [];
    para.push(...nodeToRuns(paraNode));
    paras.push(para);
  }
  return paras;
}

function cleanHtml(html: string): string {
  // remove newlines
  html = html.replace(/\n/g, ' ');
  return html;
}

function nodeToRuns(
  node: Node,
  style: { underline: boolean; highlight: boolean } = {
    underline: false,
    highlight: false,
  }
): IRun[] {
  let runs: IRun[] = [];
  if (node instanceof Text) {
    runs.push({
      text: node.textContent,
      ...style,
    });
  } else if (node instanceof HTMLElement) {
    if (node.style.textDecoration === 'underline' || node.tagName === 'U') {
      style.underline = true;
    }
    if (node.style.fontWeight === 'bold' || node.tagName === 'B') {
      style.highlight = true;
    }

    for (let child of node.childNodes) {
      runs.push(...nodeToRuns(child, { ...style }));
    }
  }
  return runs;
}

export function uploadCard(
  cardHtml: string,
  link: string,
  isPrivate: boolean
): Promise<{
  card_metadata: {
    id: string;
    content: string;
    link: string;
    author_id: string;
    qdrant_point_id: string;
    created_at: string;
    updated_at: string;
    oc_file_path: string;
    card_html: string;
    private: boolean;
  };
  duplicate: boolean;
}> {
  return makeRequest(
    CARD_URL,
    'POST',
    {
      link: link,
      card_html: cardHtml,
      private: isPrivate,
    },
    200,
    true
  );
}

export type Collection = {
  id: string;
  author_id: string;
  name: string;
  is_public: boolean;
  description: string;
  created_at: string;
  updated_at: string;
  file_id: string;
};

export async function getCollections(
  page: number
): Promise<{ collections: Collection[]; total_pages: number }> {
  try {
    const info = await getUserInfo();
    return await makeRequest(
      COLLECTIONS_URL + info.id + '/' + page.toString(),
      'GET',
      {},
      200,
      true
    );
  } catch (err) {
    return await Promise.reject(err);
  }
}

export function addCardToCollection(cardId: string, collectionId: string) {
  return makeRequest(
    ADD_CARD_TO_COLLECTION_URL + collectionId,
    'POST',
    {
      card_metadata_id: cardId,
    },
    204,
    false
  );
}
