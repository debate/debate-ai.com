import PocketBase from 'pocketbase';

import { writable } from 'svelte/store';


// export const pb = new PocketBase(prodDatabase);
export const pb = new PocketBase('https://api.debate.com.co');

export const currentUser = writable(pb.authStore.model);

export const getImageURL = (collectionId: string, recordId: string, fileName:string) => {
    return `https://patient-tree-979.fly.dev/api/files/${collectionId}/${recordId}/${fileName}`
}

pb.authStore.onChange((auth) => {
    console.log('authStore changed', auth)
    currentUser.set(pb.authStore.model);
})
