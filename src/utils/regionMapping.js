import { normalize } from "./modelMapping.js";
export function extractRegion(value) {
  const text=normalize(value);
  const rules=[
    [["FECHAMENTO SUPERIOR"],"FECHAMENTO SUPERIOR"], [["TRASEIRA"],"TRASEIRA"],
    [["LATERAL ESQUERDA","LAT ESQ","LATERAL ESQ"],"LATERAL ESQUERDA"],
    [["LATERAL DIREITA","LAT DIR","LATERAL DIR"],"LATERAL DIREITA"],
    [["FRONTAL","FRENTE"],"FRONTAL"], [["ASSOALHO","PISO"],"ASSOALHO / PISO"],
    [["TETO","SUPERIOR"],"TETO / SUPERIOR"], [["PARALAMA"],"PARALAMAS"], [["INFERIOR"," INF "],"INFERIOR"],
  ];
  for(const [keys,label] of rules) if(keys.some(key=>text.includes(key))) return label;
  return "NÃO CLASSIFICADA";
}
