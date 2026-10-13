import { clean } from "./modelMapping.js";
export const iso = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
export const formatDate = date => new Intl.DateTimeFormat("pt-BR").format(date);
export function parseDate(value) {
  const parts=clean(value).split(" ")[0].split(/[/-]/).map(Number);
  if(parts.length!==3||parts.some(Number.isNaN)) return null;
  let day,month,year;
  if(parts[0]>1900) [year,month,day]=parts;
  else { year=parts[2]; if(parts[0]>12) [day,month]=parts; else [month,day]=parts; }
  const date=new Date(year,month-1,day);
  return Number.isNaN(date.getTime())?null:date;
}
export function monday(date){ const result=new Date(date); result.setDate(result.getDate()-((result.getDay()+6)%7)); result.setHours(0,0,0,0); return result; }
