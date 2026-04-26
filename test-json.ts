import stringify from 'json-stringify-safe';
console.log(typeof stringify);
const obj: any = {};
obj.a = obj;
try {
  console.log(stringify(obj));
} catch (e: any) {
  console.error("Error:", e.message);
}
