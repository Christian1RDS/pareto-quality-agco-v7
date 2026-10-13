export const MODEL_MAP = {
  VTBAGFC: "VTBA",
  V2MFGFC: "V2 MF",
  V2VTGFC: "V2 VT",
  G7GFCAN: "G7",
  G8GFCAN: "G8",
  "GS MF SA": "G7",
  "GS VT SA": "G8",
};
export const clean = value => String(value ?? "").replace(/^﻿/, "").trim();
export const normalize = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
export const baseModelName = value => MODEL_MAP[normalize(value)] || normalize(value) || "NÃO INFORMADO";
