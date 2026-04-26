import stringify from 'json-stringify-safe';
const obj: any = {};
obj.a = obj;
try {
  JSON.stringify(obj);
} catch (e: any) {
  console.log("JSON.stringify error:", e.message);
}
try {
  stringify(obj);
  console.log("stringify success");
} catch (e: any) {
  console.log("stringify error:", e.message);
}
