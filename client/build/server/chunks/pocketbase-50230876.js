import PocketBase from 'pocketbase';
import { w as writable } from './index2-add8b348.js';

const PUBLIC_API = "https://api.debate.com.co";
const pb = new PocketBase(PUBLIC_API);
const currentUser = writable(pb.authStore.model);
const getImageURL = (collectionId, recordId, fileName) => {
  return `https://patient-tree-979.fly.dev/api/files/${collectionId}/${recordId}/${fileName}`;
};
pb.authStore.onChange((auth) => {
  console.log("authStore changed", auth);
  currentUser.set(pb.authStore.model);
});

export { currentUser as c, getImageURL as g, pb as p };
//# sourceMappingURL=pocketbase-50230876.js.map
