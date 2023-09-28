import PocketBase from "pocketbase";
import { w as writable } from "./index.js";
const pb = new PocketBase("https://db.debate.com.co");
const currentUser = writable(pb.authStore.model);
const getImageURL = (collectionId, recordId, fileName) => {
  return `https://patient-tree-979.fly.dev/api/files/${collectionId}/${recordId}/${fileName}`;
};
pb.authStore.onChange((auth) => {
  console.log("authStore changed", auth);
  currentUser.set(pb.authStore.model);
});
export {
  currentUser as c,
  getImageURL as g,
  pb as p
};
