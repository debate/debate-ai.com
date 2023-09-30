import { j as json } from "../../../../chunks/index.js";
async function POST({ request }) {
  const data = request.body;
  console.log(data);
  return json({ data });
}
function GET({ url }) {
  const min = Number(url.searchParams.get("min") ?? "0");
  const max = Number(url.searchParams.get("max") ?? "1");
  const d = max - min;
  const random = min + Math.random() * d;
  return json({ random });
}
export {
  GET,
  POST
};
